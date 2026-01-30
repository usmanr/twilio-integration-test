import { Request, Response } from "express";
import VoiceResponse from "twilio/lib/twiml/VoiceResponse";
import { db, aiService, smsService, s3Service, presignedUrlService } from "./services";

const BASE_URL = 'https://twilio-integration-test-production.up.railway.app';

/**
 * 1. INCOMING CALL HANDLER
 * Triggered when Customer calls Virtual Number.
 */
export const handleIncomingCall = async (req: Request, res: Response) => {
  const { callsid, from, to } = req.body;
  
  // A. Lookup who this virtual number belongs to
  const tradie = await db.getTradieByVirtualNumber(to);

  const twiml = new VoiceResponse();

  if (!tradie) {
    // Fallback if number is unassigned
    twiml.say({ voice: "Polly.Nicole", language: "en-AU" }, 
      "We could not connect your call. Please check the number."
    );
    return res.type("text/xml").send(twiml.toString());
  }

  // B. Log the call start
  await db.logCall(callsid, from, to, "RECEIVED");

  // C. Construct TwiML
  //    - Record the call
  //    - Transcribe it (Async)
  //    - If call ends/fails, hit the 'action' URL
  const dial = twiml.dial({
    action: `${BASE_URL}/webhooks/voice/completed`, // Handles busy/no-answer
    timeout: 20, // Ring for 20 seconds before giving up
  });

  dial.number(tradie.realMobile);

  // Add recording with transcription as a separate element
  twiml.record({
    transcribe: true,
    transcribeCallback: `${BASE_URL}/webhooks/voice/transcription`,
    playBeep: false,
  });

  res.type("text/xml").send(twiml.toString());
};

/**
 * 3. TRANSCRIPTION HANDLER (Async)
 * Triggered by Twilio when text is ready (could be 1 min later).
 */
export const handleTranscription = async (req: Request, res: Response) => {
  const { callsid, transcriptiontext, to } = req.body;

  console.log(`[WEBHOOK] Received transcription for ${callsid}`);

  // A. Update DB
  await db.updateCallRecord(callsid, { 
    transcript: transcriptiontext, 
    status: "PROCESSED" 
  });

  // B. AI Analysis
  const analysis = await aiService.analyzeTranscript(transcriptiontext);

  if (analysis.isJob) {
    const tradie = await db.getTradieByVirtualNumber(to);
    
    if (tradie) {
      if (tradie.autoCreateJobs) {
        // Auto-Create
        // await db.createJob(tradie.id, analysis.summary);
      } else {
        // Manual Confirm via SMS
        await smsService.sendConfirmation(
          tradie.realMobile, 
          `New Lead detected: "${analysis.summary}". Reply YES to create job.`
        );
      }
    }
  }

  res.sendStatus(200); // Acknowledge Twilio
};

/**
 * 4. GOODBYE HANDLER
 * Just a clean exit for voicemail
 */
export const handleGoodbye = (req: Request, res: Response) => {
  const twiml = new VoiceResponse();
  twiml.say("Thank you. Goodbye.");
  twiml.hangup();
  res.type("text/xml").send(twiml.toString());
};

/**
 * 5. IVR INCOMING CALL HANDLER
 * Returns a TwiML response with a <Gather> to collect user input.
 */
export const getIncomingCallWithIVRResponse = (req: Request, res: Response) => {
  const twiml = new VoiceResponse();
  const gather = twiml.gather({
    numDigits: 1,
    action: `${BASE_URL}/webhooks/voice/ivr-selection`,
    method: 'POST',
  });
  gather.say(
    { voice: "Polly.Nicole", language: "en-AU" },
    "Thanks for calling Micro electrician, please press 1 if you want to auto log a call, press 2 if you wish to speak to us directly"
  );

  // If the user doesn't enter anything, loop back to the beginning.
  twiml.redirect(`${BASE_URL}/webhooks/voice/ivr-incoming`);

  res.type("text/xml").send(twiml.toString());
};

/**
 * 6. IVR SELECTION HANDLER
 * Handles the digit pressed by the user from the <Gather> verb.
 */
export const handleIvrSelection = async (req: Request, res: Response) => {
  const { digits = '0', to = '' } = req.body || {};
  const twiml = new VoiceResponse();

  if (digits === '1') {
    twiml.say(
      { voice: "Polly.Nicole", language: "en-AU" },
      "record your message after the beep. when you are done, hangup"
    );
    twiml.record({
      action: `${BASE_URL}/webhooks/voice/completed`,
      method: 'POST',
      transcribe: true,
      recordingStatusCallback: `${BASE_URL}/webhooks/voice/ivr-recording-completed`,
      recordingStatusCallbackEvent: ['completed'],
      recordingStatusCallbackMethod: 'POST',
      transcribeCallback: `${BASE_URL}/webhooks/voice/ivr-transcription-completed`,
      playBeep: true,
    });
  } else if (digits === '2') {
    twiml.dial().number(to);
    /*
    // Forward the call to the tradie if found, otherwise hang up.
    const tradie = await db.getTradieByVirtualNumber(to);
    if (tradie) {
      twiml.say(
        { voice: "Polly.Nicole", language: "en-AU" },
        `Connecting you to ${tradie.name}.`
      );
      twiml.dial().number(tradie.realMobile);
    } else {
      // As requested, hang up if the number is not assigned to a tradie.
      twiml.hangup();
    }*/
  } else {
    // Handle invalid input
    twiml.say(
      { voice: "Polly.Nicole", language: "en-AU" },
      "Sorry, that's not a valid choice."
    );
    twiml.redirect(`${BASE_URL}/webhooks/voice/ivr-incoming`);
  }

  res.type("text/xml").send(twiml.toString());
};

export const handleIvrRecordingCompleted = async (req: Request, res: Response) => {
  // const { from, recordingurl: recordingUrl, transcriptiontext: transcript, transcriptionUrl: transcriptUrl, allsid: callSid, to, recordingduration: recordingDuration } = req.body;
  // onsole.log(`[WEBHOOK] IVR Recording completed from ${from} for call ${callSid}, recording URL: ${recordingUrl}, duration: ${recordingDuration}, transcript URL: ${transcriptUrl}, transcript: ${transcript}`);
  console.log("IVR Recording completed: Full request body:", JSON.stringify(req.body, null, 2));
  
  // End the call
  const twiml = new VoiceResponse();
  twiml.say({ voice: "Polly.Nicole", language: "en-AU" }, "Thank you, your message has been saved. Goodbye.");
  twiml.hangup();
  res.type("text/xml").send(twiml.toString());
};


export const handleIvrTranscriptionCompleted = async (req: Request, res: Response) => {
  // const { from, recordingurl: recordingUrl, transcriptiontext: transcript, transcriptionUrl: transcriptUrl, allsid: callSid, to, recordingduration: recordingDuration } = req.body;
  // onsole.log(`[WEBHOOK] IVR Recording completed from ${from} for call ${callSid}, recording URL: ${recordingUrl}, duration: ${recordingDuration}, transcript URL: ${transcriptUrl}, transcript: ${transcript}`);
  console.log("IVR Transcription completed: Full request body:", JSON.stringify(req.body, null, 2));
  
  const twiml = new VoiceResponse();
  twiml.say({ voice: "Polly.Nicole", language: "en-AU" }, "Thank you, transcriptionß received. Goodbye.");
  twiml.hangup();
  res.type("text/xml").send(twiml.toString());
};
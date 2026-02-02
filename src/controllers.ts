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
    twiml.say({ voice: "Google.en-AU-Neural2-C", language: "en-AU" }, 
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
  console.log("IVR Incoming Call: Full request body:", JSON.stringify(req.body, null, 2));
  const twiml = new VoiceResponse();
  const gather = twiml.gather({
    numDigits: 1,
    action: `${BASE_URL}/webhooks/voice/ivr-selection`,
    method: 'POST',
  });
  gather.say(
    { voice: "Google.en-AU-Neural2-C", language: "en-AU" },
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
  console.log("IVR Selection received: Full request body:", JSON.stringify(req.body, null, 2));
  const { digits = '0', to = '' } = req.body || {};
  const twiml = new VoiceResponse();

  if (digits === '1') {
    twiml.say(
      { voice: "Google.en-AU-Neural2-C", language: "en-AU" },
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
        { voice: "Google.en-AU-Neural2-C", language: "en-AU" },
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
      { voice: "Google.en-AU-Neural2-C", language: "en-AU" },
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
  twiml.say({ voice: "Google.en-AU-Neural2-C", language: "en-AU" }, "Thank you, your message has been saved. Goodbye.");
  twiml.hangup();
  res.type("text/xml").send(twiml.toString());
};


export const handleIvrTranscriptionCompleted = async (req: Request, res: Response) => {
  // const { from, recordingurl: recordingUrl, transcriptiontext: transcript, transcriptionUrl: transcriptUrl, allsid: callSid, to, recordingduration: recordingDuration } = req.body;
  // onsole.log(`[WEBHOOK] IVR Recording completed from ${from} for call ${callSid}, recording URL: ${recordingUrl}, duration: ${recordingDuration}, transcript URL: ${transcriptUrl}, transcript: ${transcript}`);
  console.log("IVR Transcription completed: Full request body:", JSON.stringify(req.body, null, 2));
  
  const twiml = new VoiceResponse();
  twiml.say({ voice: "Google.en-AU-Neural2-C", language: "en-AU" }, "Thank you, transcriptionß received. Goodbye.");
  twiml.hangup();
  res.type("text/xml").send(twiml.toString());
};

/**
 * =================================================================
 * VIRTUAL ASSISTANT (VA) FLOW
 * =================================================================
 */

/**
 * VA: INCOMING CALL HANDLER
 * This is triggered when a customer calls a virtual number assigned to the VA.
 * It plays a greeting and records the caller's message for transcription and analysis.
 */
export const handleVaIncomingCall = async (req: Request, res: Response) => {
  console.log("handleVaIncomingCall: Full request body:", JSON.stringify(req.body, null, 2));
  // Parameters are lowercase due to the `lowercaseBodyKeys` middleware
  const { from, to, callsid: callSid } = req.body;

  // A. Lookup the tradie this virtual number belongs to
  const tradie = await db.getTradieByVirtualNumber(to);

  const twiml = new VoiceResponse();
  const twimlRecord = twiml.start();

  twimlRecord.recording({
    track: 'both',
    trim: 'do-not-trim',
    channels: 'dual',
    recordingStatusCallback: `${BASE_URL}/webhooks/va-recording-post`,
    recordingStatusCallbackEvent: ['in-progress', 'completed', 'absent'],
  });

  if (!tradie) {
    // Fallback if number is unassigned
    twiml.say({ voice: "Google.en-AU-Neural2-C", language: "en-AU" }, "We could not connect your call. Please check the number.");
    return res.type("text/xml").send(twiml.toString());
  }

  // B. Get hints for transcription accuracy.
  // NOTE: You would need to implement functions to get relevant hints,
  // for example, from past jobs with this caller or job-specific terminology.
  const hints = ["electrician", "power point", "switchboard", "lighting", "rewire", "safety switch", tradie.name].join(',');

  // C. Log the call start
  await db.logCall(callSid, from, to, "VA_RECEIVED");

  // D. Construct TwiML to greet, explain, and gather speech.
  const greeting = `Thank you for calling ${tradie.name || 'the service'}. We are currently unavailable.`;
  const instructions = `Please leave a detailed message and we will ensure we could get back to you as soon as possible. You may hang up if you do not wish to leave a message.`;

  twiml.say({ voice: "Google.en-AU-Neural2-C", language: "en-AU" }, greeting);
  twiml.say({ voice: "Google.en-AU-Neural2-C", language: "en-AU" }, instructions);

  // Play a beep sound since <Gather> doesn't have a playBeep attribute
  // twiml.play({}, 'http://com.twilio.sounds.beep.mp3');

  // Using <Gather> for speech-to-text as requested.
  // The 'any' cast is used to include advanced speech recognition parameters
  // that may not be in the current version of the Twilio SDK's TypeScript types.
  // Note: <Gather> does not support a `maxLength` attribute like <Record>.
  // The recording will stop after a period of silence, determined by `speechTimeout`.
  const gatherOptions: VoiceResponse.GatherAttributes = {
    input: ['speech'],
    action: `${BASE_URL}/webhooks/voice/va-transcription-available`,
    actionOnEmptyResult: true,
    method: 'POST',
    language: "en-AU",
    speechModel: "phone_call",
    enhanced: true,
    hints: hints,
    speechTimeout: '5',
  };
  twiml.gather(gatherOptions);

  // Fallback if the user doesn't say anything and <Gather> times out.
  // This is executed because the default for `actionOnEmptyResult` is false.
  twiml.say({ voice: "Google.en-AU-Neural2-C", language: "en-AU" }, "We did not receive a message. Goodbye.");
  twiml.hangup();

  res.type("text/xml").send(twiml.toString());
};

export const handleVaRecordingAvailable = async (req: Request, res: Response) => {
    console.log("handleVaRecordingAvailable: Full request body:", JSON.stringify(req.body, null, 2));
  res.sendStatus(200); // Acknowledge Twilio
};

/**
 * VA: TRANSCRIPTION HANDLER (Async)
 * Triggered by the <Gather> verb's action. It analyzes the transcribed text
 * and takes action.
 */
export const handleVaTranscriptionAvailable = async (req: Request, res: Response) => {
    console.log("handleVaTranscriptionAvailable: Full request body:", JSON.stringify(req.body, null, 2));

  // Parameters are lowercase due to middleware.
  // `speechresult` from <Gather> is used instead of `transcriptiontext` from <Record>.
  const { callsid: callSid, speechresult: transcriptionText, to } = req.body;

  if (!transcriptionText) {
    console.log(`[VA WEBHOOK] Received empty transcription for ${callSid}. Ignoring.`);
    return res.sendStatus(200);
  }

  console.log(`[VA WEBHOOK] Received transcription for ${callSid}: "${transcriptionText}"`);

  await db.updateCallRecord(callSid, {
    transcript: transcriptionText,
    status: "VA_PROCESSED",
  });

  const analysis = await aiService.analyzeTranscript(transcriptionText);

  if (analysis.isJob) {
    const tradie = await db.getTradieByVirtualNumber(to);
    if (tradie) {
      const message = `New Lead (from VA): "${analysis.summary}". Reply YES to create job.`;
      await smsService.sendConfirmation(tradie.realMobile, message);
    }
  }

  res.sendStatus(200); // Acknowledge Twilio
};
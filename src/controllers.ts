import { Request, Response } from "express";
import VoiceResponse from "twilio/lib/twiml/VoiceResponse";
import { db, aiService, smsService } from "./services";

const BASE_URL = process.env.BASE_URL || "https://twilio-integration-test-production.up.railway.app";

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
 * 2. CALL COMPLETION HANDLER (The 'Action' URL)
 * Triggered when the <Dial> finishes (either answered or missed).
 */
export const handleCallCompleted = async (req: Request, res: Response) => {
  const { dialcallstatus, to } = req.body;
  const twiml = new VoiceResponse();

  // If the Tradie didn't pick up (busy, no-answer, failed)
  if (["busy", "no-answer", "failed", "canceled"].includes(dialcallstatus)) {
    
    twiml.say({ voice: "Polly.Nicole", language: "en-AU" }, 
      "The tradie is currently unavailable. Please leave a message after the beep."
    );

    // Record Voicemail
    twiml.record({
      transcribe: true,
      transcribeCallback: `${BASE_URL}/webhooks/voice/transcription`,
      maxLength: 120,
      playBeep: true,
      action: `${BASE_URL}/webhooks/voice/goodbye` // Just hangup after recording
    });

  } else {
    // Call was successful, just hangup
    twiml.hangup();
  }

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
        await db.createJob(tradie.id, analysis.summary);
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
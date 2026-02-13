import { Request, Response } from "express";
import VoiceResponse from "twilio/lib/twiml/VoiceResponse";
import { db, aiService, smsService } from "./services";
import { polishTranscript } from "../ai-polisher";

const BASE_URL =
  process.env.BASE_URL ||
  "https://twilio-integration-test-production.up.railway.app";

const PROMPTS: Record<number, string> = {
  1: "Hi, thanks for calling ${tradie.name}. In a few words, please describe the work you want done.",
  2: "Thank you. To make sure we log your job with the correct details, please clearly state your full name, best contact number, and the property address.",
  3: "Right. Anything else you want me to note ?",
};

// IVR Call Handling
export const getIncomingCallWithIVRResponse = (req: Request, res: Response) => {
  console.log(
    "IVR Incoming Call: Full request body:",
    JSON.stringify(req.body, null, 2),
  );
  const twiml = new VoiceResponse();
  const gather = twiml.gather({
    numDigits: 1,
    action: `${BASE_URL}/webhooks/voice/ivr-selection`,
    method: "POST",
  });
  gather.say(
    { voice: "Google.en-AU-Neural2-C", language: "en-AU" },
    "Thanks for calling Micro electrician, please press 1 if you want to auto log a call, press 2 if you wish to speak to us directly",
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
  console.log(
    "IVR Selection received: Full request body:",
    JSON.stringify(req.body, null, 2),
  );
  const { digits = "0", to = "" } = req.body || {};
  const twiml = new VoiceResponse();

  if (digits === "1") {
    twiml.say(
      { voice: "Google.en-AU-Neural2-C", language: "en-AU" },
      "record your message after the beep. when you are done, hangup",
    );
    twiml.record({
      action: `${BASE_URL}/webhooks/voice/completed`,
      method: "POST",
      transcribe: true,
      recordingStatusCallback: `${BASE_URL}/webhooks/voice/ivr-recording-completed`,
      recordingStatusCallbackEvent: ["completed"],
      recordingStatusCallbackMethod: "POST",
      transcribeCallback: `${BASE_URL}/webhooks/voice/ivr-transcription-completed`,
      playBeep: true,
    });
  } else if (digits === "2") {
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
      "Sorry, that's not a valid choice.",
    );
    twiml.redirect(`${BASE_URL}/webhooks/voice/ivr-incoming`);
  }

  res.type("text/xml").send(twiml.toString());
};

export const handleIvrRecordingCompleted = async (
  req: Request,
  res: Response,
) => {
  // const { from, recordingurl: recordingUrl, transcriptiontext: transcript, transcriptionUrl: transcriptUrl, allsid: callSid, to, recordingduration: recordingDuration } = req.body;
  // onsole.log(`[WEBHOOK] IVR Recording completed from ${from} for call ${callSid}, recording URL: ${recordingUrl}, duration: ${recordingDuration}, transcript URL: ${transcriptUrl}, transcript: ${transcript}`);
  console.log(
    "IVR Recording completed: Full request body:",
    JSON.stringify(req.body, null, 2),
  );

  // End the call
  const twiml = new VoiceResponse();
  twiml.say(
    { voice: "Google.en-AU-Neural2-C", language: "en-AU" },
    "Thank you, your message has been saved. Goodbye.",
  );
  twiml.hangup();
  res.type("text/xml").send(twiml.toString());
};

export const handleIvrTranscriptionCompleted = async (
  req: Request,
  res: Response,
) => {
  // const { from, recordingurl: recordingUrl, transcriptiontext: transcript, transcriptionUrl: transcriptUrl, allsid: callSid, to, recordingduration: recordingDuration } = req.body;
  // onsole.log(`[WEBHOOK] IVR Recording completed from ${from} for call ${callSid}, recording URL: ${recordingUrl}, duration: ${recordingDuration}, transcript URL: ${transcriptUrl}, transcript: ${transcript}`);
  console.log(
    "IVR Transcription completed: Full request body:",
    JSON.stringify(req.body, null, 2),
  );

  const twiml = new VoiceResponse();
  twiml.say(
    { voice: "Google.en-AU-Neural2-C", language: "en-AU" },
    "Thank you, transcriptionß received. Goodbye.",
  );
  twiml.hangup();
  res.type("text/xml").send(twiml.toString());
};

/* =================================================================
 * VIRTUAL ASSISTANT (VA) FLOW
 * =================================================================*/

export const handleVaIncomingCall = async (req: Request, res: Response) => {
  console.log(
    "handleVaIncomingCall: Full request body:",
    JSON.stringify(req.body, null, 2),
  );
  // Parameters are lowercase due to the `lowercaseBodyKeys` middleware
  const { from, to, callsid: callSid } = req.body;

  // A. Lookup the tradie this virtual number belongs to
  const tradie = await db.getTradieByVirtualNumber(to);

  const twiml = new VoiceResponse();
  const twimlRecord = twiml.start();

  twimlRecord.recording({
    track: "both",
    trim: "do-not-trim",
    channels: "dual",
    recordingStatusCallback: `${BASE_URL}/webhooks/voice/va-recording-post`,
    recordingStatusCallbackEvent: ["in-progress", "completed", "absent"],
  });

  if (!tradie) {
    // Fallback if number is unassigned
    twiml.say(
      { voice: "Google.en-AU-Neural2-C", language: "en-AU" },
      "We could not connect your call. Please check the number.",
    );
    return res.type("text/xml").send(twiml.toString());
  }

  const hints = [
    "electrician",
    "power point",
    "switchboard",
    "lighting",
    "rewire",
    "safety switch",
    tradie.name,
  ].join(",");

  // C. Log the call start
  await db.logCall(callSid, from, to, "VA_RECEIVED");

  // D. Use the first prompt for the initial gathering of speech.
  const prompt1 = PROMPTS[1].replace(
    "${tradie.name}",
    tradie.name || "the service",
  );
  twiml.say({ voice: "Google.en-AU-Neural2-C", language: "en-AU" }, prompt1);

  const gatherOptions: VoiceResponse.GatherAttributes = {
    input: ["speech"],
    action: `${BASE_URL}/webhooks/voice/va-transcription-available?step=job-details`,
    actionOnEmptyResult: true,
    method: "POST",
    language: "en-AU",
    speechModel: "phone_call",
    enhanced: true,
    hints,
    speechTimeout: "3",
  };
  twiml.gather(gatherOptions);

  res.type("text/xml").send(twiml.toString());
};

export const handleVaRecordingAvailable = async (
  req: Request,
  res: Response,
) => {
  console.log(
    "handleVaRecordingAvailable: Full request body:",
    JSON.stringify(req.body, null, 2),
  );
  const { callsid, recordingurl, recordingstatus } = req.body;
  if (callsid) {
    await db.addRecording(callsid, recordingurl, recordingstatus);
  } else {
    console.error(
      "[VA Recording] CallSid not found in recording callback body.",
    );
  }

  res.sendStatus(200); // Acknowledge Twilio
};

/**
 * VA: TRANSCRIPTION HANDLER (Async)
 * Triggered by the <Gather> verb's action. It analyzes the transcribed text
 * and takes action.
 */
export const handleVaTranscriptionAvailable = async (
  req: Request,
  res: Response,
) => {
  console.log(
    "handleVaTranscriptionAvailable: Full request body:",
    JSON.stringify(req.body, null, 2),
  );
  const { step } = req.query;

  // Parameters are lowercase due to middleware.
  // `speechresult` from <Gather> is used instead of `transcriptiontext` from <Record>.
  const { callsid: callSid, speechresult: transcriptionText, to } = req.body;
  const twiml = new VoiceResponse();

  if (!transcriptionText) {
    console.log(
      `[VA WEBHOOK] Received empty transcription for ${callSid}. Ignoring.`,
    );

    // If the first step is empty, we can just hang up.
    twiml.say(
      { voice: "Google.en-AU-Neural2-C", language: "en-AU" },
      "We did not receive a message. Goodbye.",
    );
    twiml.hangup();
    return res.type("text/xml").send(twiml.toString());
  }

  console.log(
    `[VA WEBHOOK] Step: ${step}, Received transcription for ${callSid}: "${transcriptionText}"`,
  );

  if (step === "job-details") {
    // 1. Store the first piece of information (job details)
    await db.updateCallRecord(callSid, {
      steps: [{ name: "job-details", text: transcriptionText }],
    });

    // 2. Ask for the next piece of information (contact/address)
    const gather = twiml.gather({
      input: ["speech"],
      action: `${BASE_URL}/webhooks/voice/va-transcription-available?step=address-details`,
      method: "POST",
      language: "en-AU",
      speechModel: "phone_call",
      enhanced: true,
      speechTimeout: "3",
    });
    gather.say(
      { voice: "Google.en-AU-Neural2-C", language: "en-AU" },
      PROMPTS[2],
    );
  } else if (step === "address-details") {
    // 1. Store the second piece of information
    await db.updateCallRecord(callSid, {
      steps: [{ name: "address-details", text: transcriptionText }],
    });

    // 2. Ask for the final piece of information
    const gather = twiml.gather({
      input: ["speech"],
      action: `${BASE_URL}/webhooks/voice/va-transcription-available?step=final-notes`,
      method: "POST",
      language: "en-AU",
      speechModel: "phone_call",
      enhanced: true,
      speechTimeout: "3",
    });
    gather.say(
      { voice: "Google.en-AU-Neural2-C", language: "en-AU" },
      PROMPTS[3],
    );
  } else if (step === "final-notes") {
    // 1. Store the final piece of information
    await db.updateCallRecord(callSid, {
      steps: [{ name: "final-notes", text: transcriptionText }],
    });

    // 2. Consolidate all info, process with AI, and notify tradie
    const callRecord = await db.getCallRecord(callSid);
    const fullTranscript =
      callRecord?.steps?.map((s) => s.text).join(" \n ") || transcriptionText;

    await db.updateCallRecord(callSid, {
      transcript: fullTranscript,
      status: "VA_PROCESSED",
    });

    // 3. Create the enquiry via API
    await fetch(`${process.env.ENQUIRIES_API_URL!}/enquiries`, {
      method: "POST",
      headers: {
        "x-api-key": "TMFUnTI9T41Ka2FDEZZnPYXnDmuN44JNiheIToJhVSgAzwE2",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(callRecord),
    });

    // 4. End the call gracefully
    twiml.say(
      { voice: "Google.en-AU-Neural2-C", language: "en-AU" },
      "Thank you for the details. We will be in touch shortly. Goodbye.",
    );
    twiml.hangup();
  } else {
    // Fallback for unknown step
    twiml.say(
      { voice: "Google.en-AU-Neural2-C", language: "en-AU" },
      "An error occurred. Goodbye.",
    );
    twiml.hangup();
  }

  res.type("text/xml").send(twiml.toString());
};

export const getPolishedDescription = async (req: Request, res: Response) => {
  const allCalls = await db.getAllCalls();
  if (!allCalls || allCalls.length === 0) {
    return res.status(200).json({ error: "No calls found" });
  }

  var response = "";
  for (const call of allCalls) {
    const ai_response = await polishTranscript(
      call?.steps?.[0]?.text || "",
      call?.steps?.[1]?.text || "",
      call?.steps?.[2]?.text || "",
    );

    if (ai_response) {
      response += JSON.stringify(ai_response) + "\n";
    }
  }
  res.type("application/json").send(response);
};

export const getAllCalls = async (req: Request, res: Response) =>
  res.type("application/json").send(await db.getAllCalls());

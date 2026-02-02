import { Router } from "express";
import { 
  handleIncomingCall, 
  handleTranscription,
  handleGoodbye,
  getIncomingCallWithIVRResponse,
  handleIvrSelection,
  handleIvrRecordingCompleted,
  handleIvrTranscriptionCompleted,
  handleVaIncomingCall,
  handleVaTranscriptionAvailable
} from "./controllers";

const router = Router();

// Endpoint for Twilio "Voice Webhook"
router.post("/voice/incoming", handleIncomingCall);

// Endpoint for <Dial> action (Missed call logic)
router.post("/voice/completed", handleGoodbye);

// Endpoint for Transcription Callback
router.post("/voice/transcription", handleTranscription);

// Endpoint for Voicemail finish
router.post("/voice/goodbye", handleGoodbye);

// --- IVR Flow ---
// 1. Entry point for the IVR
router.post("/voice/ivr-incoming", getIncomingCallWithIVRResponse);

// 2. Handles the digit pressed by the user
router.post("/voice/ivr-selection", handleIvrSelection);

// 3. Webhook for when the recording from the IVR is complete
router.post("/voice/ivr-recording-completed", handleIvrRecordingCompleted);

// 4. Webhook for when the transcription from the IVR is complete
router.post("/voice/ivr-transcription-completed", handleIvrTranscriptionCompleted);

// --- VA Flow ---
// 1. Entry point for the VA, gathers speech
router.post("/voice/va-incoming", handleVaIncomingCall);
// 2. Webhook for when the transcription from <Gather> is complete
router.post("/voice/va-transcription-available", handleVaTranscriptionAvailable);

export default router;
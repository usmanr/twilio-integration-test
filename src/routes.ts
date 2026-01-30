import { Router } from "express";
import { 
  handleIncomingCall, 
  handleCallCompleted, 
  handleTranscription,
  handleGoodbye,
  getIncomingCallWithIVRResponse,
  handleIvrSelection,
  handleIvrRecordingCompleted
} from "./controllers";

const router = Router();

// Endpoint for Twilio "Voice Webhook"
router.post("/voice/incoming", handleIncomingCall);

// Endpoint for <Dial> action (Missed call logic)
router.post("/voice/completed", handleCallCompleted);

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

export default router;
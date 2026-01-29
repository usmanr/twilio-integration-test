import { Router } from "express";
import { 
  handleIncomingCall, 
  handleCallCompleted, 
  handleTranscription,
  handleGoodbye 
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

export default router;
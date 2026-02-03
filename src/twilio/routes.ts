import { Router } from "express";
import { 
  getIncomingCallWithIVRResponse,
  handleIvrSelection,
  handleIvrRecordingCompleted,
  handleIvrTranscriptionCompleted,
  handleVaIncomingCall,
  handleVaRecordingAvailable,
  handleVaTranscriptionAvailable,
  getAllCalls,
  getPolishedDescription
} from "./controller";

const router = Router();


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

router.post("/voice/va-recording-post", handleVaRecordingAvailable);

router.get('/voice/all-calls', getAllCalls);

router.get('/voice/all-calls/polished', getPolishedDescription);

export default router;
import { Router } from "express";
import { 
  handleSinchEvent,
  getAllCalls
} from "./controller";

const router = Router();


// --- IVR Flow ---
// 1. Entry point for the IVR
router.post("/voice/incoming-call", handleSinchEvent);
router.get('/voice/all-calls', getAllCalls);

export default router;
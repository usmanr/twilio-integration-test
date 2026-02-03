import { Request, Response } from "express";

interface CallSession {
  data: {
    step: number;
    text: string;
    description: string;
  }[];
  recording?: string;
  transcript?: string;
  callId: string;
}

interface SinchEvent {
  event: string;
  callId: string;
  cli?: { identity: string };
  destination?: string;
  input?: { value: string } | { speech: string };
  custom?: Record<string, any>;
  cookie?: string;
  aiAnalysis?: any; // Sinch AI metadata
}

const PROMPTS: Record<number, string> = {
  1: 'Hi, thanks for calling ${tradie.name}. In a few words, please describe the work you want done.',
  2: 'Thank you. To make sure we log your job with the correct details, please clearly state your full name, best contact number, and the property address.',
  3: 'Right. Anything else you want me to note ?'
};

const callSessions = new Map<string, CallSession>();

export const handleSinchEvent = async (req: Request, res: Response) => {
  console.log("Sinch Incoming Call: Full request body:", JSON.stringify(req.body, null, 2));

  const event: SinchEvent = req.body as SinchEvent;

  try {
    switch (event.event?.toLowerCase()) {
      case 'ice': // Incoming Call Event
        return handleIncomingCall(event, res);
      case 'pie': // Prompt Input Event
        return handlePromptInput(event, res);
      // case 'recordingEvent':
        // handleRecording(event);
        // break;
      // case 'transcriptionEvent':
        // handleTranscription(event);
        // break;
      case 'dice':
        console.log(`Disconnection request received. Body: ${JSON.stringify(req.body, null, 2)}`)
        break;
      case 'notify':
        console.log(`Notify request received. Body: ${JSON.stringify(req.body, null, 2)}`)
        break;
    }
  } catch (error) {
    console.error('Error:', error);
  }
  res.sendStatus(200);
}

// 1. STEP 1: Incoming call → Tradie lookup → Prompt 1 + set cookie
function handleIncomingCall(event: SinchEvent, res: Response): void {
  const toNumber = event.destination || event.cli?.identity || '';
  const tradie = { id: 'John-Smith', name: 'John Plumbing' }

  if (!tradie) {
    res.status(400).json({ error: 'Unknown tradie number' });
    return;
  }

  const callId = event.callId;

  callSessions.set(callId, createSession(callId));

  const svaml = {
    instructions: [
      { name: 'answer' },
      { name: 'startRecording', options: { stereo: true } },
      { name: 'say', text: PROMPTS[1].replace('${tradie.name}', tradie.name || ' the service ') }
    ],
    action: {
      name: 'runMenu',
      prompts: [{ type: 'tts' }],
      maxDigits: 0,
      barge: true,
      aiEnabled: true
    },
    custom: { 
      step: 1
    },
  };

  res.json(svaml);
}


// 2. PROMPT RESPONSE: Process input → Advance step via custom/cookie
function handlePromptInput(event: SinchEvent, res: Response): void {
  const callId = event.callId;
  const step = event.custom?.step as number; // e.g. 1

  if (!step || step > 3) {
    res.status(400).send('Missing custom params');
    return;
  }

  const inputText = (event.input && 'value' in event.input ? event.input.value : (event.input && 'speech' in event.input ? event.input.speech : '')) || '';
  const session = callSessions.get(callId) || createSession(callId);

  // Store by currentStep
  session.data.push({ step, text: inputText, description: '' });
  callSessions.set(callId, session);

  if (step < 3) {
    sendPromptForStep(step + 1, session, res);
  } else {
    completeCall(session, res);
  }
}

function createSession(callId: string): CallSession {
  return {
    data: [],
    callId
  };
}

function sendPromptForStep(step: number, session: CallSession, res: Response): void {
  const tradie = { id: 'John-Smith', name: 'John Plumbing' }
  const svaml = {
    instructions: [
      { name: 'continue' },
      { name: 'say', text: PROMPTS[step].replace('${tradie.name}', tradie.name || ' the service ') }
    ],
    action: { name: 'runMenu', maxDigits: 0, barge: true, aiEnabled: true },
    custom: {
      step
    }
  };
  res.json(svaml);
}


// 3. STEP 4: Log + hangup
function completeCall(session: CallSession, res: Response): void {
  const tradie = { id: 'John-Smith', name: 'John Plumbing' }
 /* const jobData = {
    callId: session.callId,
    step1_jobDesc: session.data.jobDesc,
    step2_contact: session.data.contact,
    step3_notes: session.data.notes
  };

  // Backend POST (your LLM extraction here)
  fetch('https://your-backend.com/api/log-job', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(jobData)
  }).catch(console.error);*/

  const svaml = {
    instructions: [
      { name: 'say', text: `Thanks! Job logged for ${tradie.name}. Goodbye.` },
      { name: 'stopRecording' },
      { name: 'hangup' }
    ]
  };

  callSessions.delete(session.callId);
  res.json(svaml);
}

// Recording/transcription handlers (unchanged)
function handleRecording(event: any): void {
  var session = callSessions.get(event.callId);
  if (!session) return;
  session.recording = event.url;
  callSessions.set(event.callId, session);
  console.log('Recording:', event.url);
}

function handleTranscription(event: any): void {
  var session = callSessions.get(event.callId);
  if (!session) return;
  session.transcript = event.text;
  callSessions.set(event.callId, session);
  console.log('Transcription:', event.text);
}

export const getAllCalls = async (req: Request, res: Response) => res.type("application/json").send(callSessions);
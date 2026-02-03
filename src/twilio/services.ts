import axios from "axios";

// MOCK STATEFUL DATABASE
interface CallRecord {
  callSid: string;
  from: string;
  to: string;
  status: string;
  recordingUrl?: string;
  recordingStatus?: string;
  transcript?: string;
  steps?: { name: string, text: string}[]
}

// MOCK DATABASE
interface Tradie {
  id: string;
  name: string;
  virtualNumber: string;
  realMobile: string;
  autoCreateJobs: boolean;
}

const MOCK_CALLS: CallRecord[] = [];

const MOCK_TRADIES: Tradie[] = [
  {
    id: "TRADIE_101",
    name: "Tom's Plumbing",
    virtualNumber: "+61400555666",
    realMobile: "+61499888777", // The number we forward to
    autoCreateJobs: false, // Force manual SMS confirmation
  },
];

export const db = {
  getTradieByVirtualNumber: async (virtualNumber: string): Promise<Tradie | null> => {
    return MOCK_TRADIES[0];
  },

  logCall: async (callSid: string, from: string, to: string, status: string) => {
    console.log(`[DB] Logged Call ${callSid}: ${status}. From: ${from}, To: ${to}`);
    const existing = MOCK_CALLS.find(c => c.callSid === callSid);
    if (existing) {
      existing.status = status;
    } else {
      MOCK_CALLS.push({ callSid, from, to, status });
    }
  },

  addRecording: async (callSid: string, recordingUrl: string, recordingStatus: string) => {
    console.log(`[DB] Added recording for ${callSid}: ${recordingUrl}`);
    const call = MOCK_CALLS.find(c => c.callSid === callSid);
    if (call) {
      call.recordingUrl = recordingUrl;
      call.recordingStatus = recordingStatus;
    }
  },

  updateCallRecord: async (callSid: string, data: Partial<CallRecord>) => {
    console.log(`[DB] Updated Call ${callSid}:`, data);
    const call = MOCK_CALLS.find(c => c.callSid === callSid);
    
    if (call) {
      // Special handling for appending steps to the collection
      if (data.steps) {
        if (!call.steps) {
          call.steps = [];
        }
        call.steps.push(...data.steps);
        delete data.steps; // Remove from data to avoid overwrite by Object.assign
      }
      Object.assign(call, data);
    } else {
      MOCK_CALLS.push({ callSid, from: '', to: '', status: 'PROCESSING', ...data });
    }
  },

  getCallRecord: async (callSid: string): Promise<CallRecord | null> => {
    console.log(`[DB] Getting record for ${callSid}`);
    return MOCK_CALLS.find(c => c.callSid === callSid) || null;
  },
  getAllCalls: () => {
    return MOCK_CALLS;
  },
};

// MOCK AI SERVICE
export const aiService = {
  analyzeTranscript: async (text: string) => {
    // Simulating AI latency
    await new Promise((r) => setTimeout(r, 500));
    
    // Simple keyword matching for demo
    if (text.toLowerCase().includes("quote") || text.toLowerCase().includes("urgent")) {
      return { isJob: true, summary: "Potential new job detected from transcript." };
    }
    return { isJob: false, summary: "General inquiry." };
  },
};

// MOCK SMS SERVICE (Twilio Wrapper)
export const smsService = {
  sendConfirmation: async (to: string, message: string) => {
    console.log(`[SMS] Sending to ${to}: "${message}"`);
    // Real implementation would use twilioClient.messages.create(...)
  },
};

// MOCK PRE-SIGNED URL SERVICE
export const presignedUrlService = {
  getUploadUrl: async (key: string): Promise<string> => {
    console.log(`[MOCK] Generating presigned URL for key: ${key}`);
    // In a real app, this would call an external service or use the AWS SDK to generate a URL.
    return `https://s3-presigned-url.com/your-bucket/${key}?signature=...&expires=...`;
  }
};

// MOCK S3 UPLOAD SERVICE
export const s3Service = {
  uploadToPresignedUrl: async (url: string, content: string | Buffer, contentType: string): Promise<void> => {
    console.log(`[S3] Simulating PUT to presigned URL for content type ${contentType}.`);
    // In a real app, this would be an axios.put(url, content, { headers: { 'Content-Type': contentType } })
    // For example:
    // await axios.put(url, content, { headers: { 'Content-Type': contentType } });
    console.log(`[S3] Upload simulation successful.`);
  },
  
  // This simulates getting the recording data from Twilio's URL
  fetchRecording: async (recordingUrl: string): Promise<Buffer> => {
    console.log(`[HTTP] Fetching recording from ${recordingUrl}.mp3`); // Twilio URLs often don't have the extension
    // In a real app, use axios or fetch to get the audio file as a buffer
    // For example:
    // const response = await axios.get(`${recordingUrl}.mp3`, { responseType: 'arraybuffer' });
    // return Buffer.from(response.data);
    return Buffer.from("mock-audio-file-data-from-twilio");
  }
};
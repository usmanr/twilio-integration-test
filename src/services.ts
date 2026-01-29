// MOCK DATABASE
interface Tradie {
  id: string;
  name: string;
  virtualNumber: string;
  realMobile: string;
  autoCreateJobs: boolean;
}

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
    return MOCK_TRADIES.find((t) => t.virtualNumber === virtualNumber) || null;
  },

  logCall: async (callSid: string, from: string, to: string, status: string) => {
    console.log(`[DB] Logged Call ${callSid}: ${status} | From: ${from} -> To: ${to}`);
  },

  updateCallRecord: async (callSid: string, data: any) => {
    console.log(`[DB] Updated Call ${callSid}:`, data);
  },

  createJob: async (tradieId: string, summary: string) => {
    console.log(`[DB] JOB CREATED for ${tradieId}: "${summary}"`);
    return "JOB_992";
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
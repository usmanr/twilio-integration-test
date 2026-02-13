import axios from "axios";
import { createCallRepository, CallRepository } from "./call-repository";

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

const callRepo: CallRepository = createCallRepository();

export const db = {
  getTradieByVirtualNumber: async (virtualNumber: string): Promise<Tradie | null> => {
    return MOCK_TRADIES[0];
  },

  logCall: (callSid: string, from: string, to: string, status: string) =>
    callRepo.logCall(callSid, from, to, status),

  addRecording: (callSid: string, recordingUrl: string, recordingStatus: string) =>
    callRepo.addRecording(callSid, recordingUrl, recordingStatus),

  updateCallRecord: (callSid: string, data: Record<string, any>) =>
    callRepo.updateCallRecord(callSid, data),

  getCallRecord: (callSid: string) =>
    callRepo.getCallRecord(callSid),

  getAllCalls: () => callRepo.getAllCalls(),
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
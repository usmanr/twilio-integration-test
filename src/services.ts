import axios from "axios";

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
  uploadTranscript: async (content: string | Buffer, contentType: string): Promise<void> => {
    const url = 'https://s3.ap-southeast-2.amazonaws.com/usman-temp-call-recording-twilio/recording-transcript?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=ASIAT53HYYIQYT3U2IT2%2F20260130%2Fap-southeast-2%2Fs3%2Faws4_request&X-Amz-Date=20260130T025203Z&X-Amz-SignedHeaders=host&X-Amz-Expires=604800&X-Amz-Security-Token=IQoJb3JpZ2luX2VjEMv%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEaDmFwLXNvdXRoZWFzdC0yIkYwRAIgbEUt7O1ap6%2Fhpsrl2P6wpFGhIC%2BRK3BfLHxv62C0oYYCID%2FTyALlkKRgSW8UDmnN0andUjxVATut7uQrApNBccetKooECJT%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEQBBoMMjcwMjYzNjk3OTUzIgxJtJNPUhDMTW%2BgJI8q3gNepYcBPySZob6zzkn3d9gasXpxBLx50ewYcLamL2lprqQ%2F3U5ubRuRHreYZTpym4iK3n8q2qWI7hrybhuXOGLBOTNSc8H51tI2UNCUlQHHuFMty3QsDrpHwFWUx2j%2FAeGJZn4JznDrF2eKFaryM8oHBdIhj72yIi%2Fx1OPQ%2B6lw8L9c8IUL2%2BbhmvDdNvE87DCAmsTdB7JAoCgU8oKyd6dBjyPJSe%2B43AD8gNpRF5%2FDmFssPA%2BFue2M%2F9xVTSiAGEncU27hCDQuPbTSdc6ofICS5bBZg2c1Rz5RLgk5JYPUU3N2%2FNsivcbfnUj1k53kEBtuwslWVEdW4pZjDlprH4aLkPc4eBiKEh9frS4yal3997ve4mN5IfOiPyIjO3OByvfHPArh54o1yhHrfv4P8pbB%2FN3ws5wIJ1QMTKgub%2B2zPmzHnquPhA3%2Bq%2BvdvonwYdduBONoC28snWiqYKXuv5uieA%2BdDuHx1TV2uGdEItlDQp0tIuDQZxUZkbBE2N%2FkgHInqzFsz16%2Bzgl3%2BzXGOp6BCUVKnSBAhj9bjAYeOpl2kfZSAUOAIVlg64OqNaAg7BX5Un0D24FjewbpAXyl%2BEjN47yMAfQ8ceC3cle%2BekYivz8VmZTRPy3HP18KdUBWMO6k8MsGOpMC8NfvNXfdVBDrm9QjfAez5WfUUf9b%2Bl%2F23AM1G8A8DS7raQFPktZgNzGk%2FNb3EMqBQSHHOepGQAu7A1Rk4QJG4oGKJkskRJyvDfu%2Bqo3BJYEMXR07X%2BtSmoFs7rvQcMYUW01pDKqg%2BH6K1UQ7kIcKYlxteV9KYP6lzKvA4wQ2pn8pLtYn8%2FiQ12bO9jP1j4BQJuy4oAexXFDpFOz%2FiPAwgYBuqgbK%2BWevEUSa4kYwScq%2FYu1ayVz%2FKv8Kr5e5Iipw7UjQiThWJom%2FFbDOAWfE8UlOjiSkVi9oMpqiBiScsRh%2B7l1bwCDGtiv5MpzvfHv3ZSWP4QQCaS6UcThQf3En8W6A2fzzmwy1OOon1aDkcKt9qcU%3D&X-Amz-Signature=236a656ad7b86da7102fdc8c7840a3bf486e852299908de5297993e602893449';
    console.log(`[S3] PUT transcript to presigned URL for content type ${contentType}. URL: ${url}`);
    await axios.put(url, content, { headers: { 'Content-Type': contentType } });
    console.log(`[S3] Upload transcript upload successful.`);
  },

  uploadRecording: async (content: string | Buffer, contentType: string): Promise<void> => {
    const url = 'https://s3.ap-southeast-2.amazonaws.com/usman-temp-call-recording-twilio/recording?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=ASIAT53HYYIQYT3U2IT2%2F20260130%2Fap-southeast-2%2Fs3%2Faws4_request&X-Amz-Date=20260130T025203Z&X-Amz-SignedHeaders=host&X-Amz-Expires=604800&X-Amz-Security-Token=IQoJb3JpZ2luX2VjEMv%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEaDmFwLXNvdXRoZWFzdC0yIkYwRAIgbEUt7O1ap6%2Fhpsrl2P6wpFGhIC%2BRK3BfLHxv62C0oYYCID%2FTyALlkKRgSW8UDmnN0andUjxVATut7uQrApNBccetKooECJT%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEQBBoMMjcwMjYzNjk3OTUzIgxJtJNPUhDMTW%2BgJI8q3gNepYcBPySZob6zzkn3d9gasXpxBLx50ewYcLamL2lprqQ%2F3U5ubRuRHreYZTpym4iK3n8q2qWI7hrybhuXOGLBOTNSc8H51tI2UNCUlQHHuFMty3QsDrpHwFWUx2j%2FAeGJZn4JznDrF2eKFaryM8oHBdIhj72yIi%2Fx1OPQ%2B6lw8L9c8IUL2%2BbhmvDdNvE87DCAmsTdB7JAoCgU8oKyd6dBjyPJSe%2B43AD8gNpRF5%2FDmFssPA%2BFue2M%2F9xVTSiAGEncU27hCDQuPbTSdc6ofICS5bBZg2c1Rz5RLgk5JYPUU3N2%2FNsivcbfnUj1k53kEBtuwslWVEdW4pZjDlprH4aLkPc4eBiKEh9frS4yal3997ve4mN5IfOiPyIjO3OByvfHPArh54o1yhHrfv4P8pbB%2FN3ws5wIJ1QMTKgub%2B2zPmzHnquPhA3%2Bq%2BvdvonwYdduBONoC28snWiqYKXuv5uieA%2BdDuHx1TV2uGdEItlDQp0tIuDQZxUZkbBE2N%2FkgHInqzFsz16%2Bzgl3%2BzXGOp6BCUVKnSBAhj9bjAYeOpl2kfZSAUOAIVlg64OqNaAg7BX5Un0D24FjewbpAXyl%2BEjN47yMAfQ8ceC3cle%2BekYivz8VmZTRPy3HP18KdUBWMO6k8MsGOpMC8NfvNXfdVBDrm9QjfAez5WfUUf9b%2Bl%2F23AM1G8A8DS7raQFPktZgNzGk%2FNb3EMqBQSHHOepGQAu7A1Rk4QJG4oGKJkskRJyvDfu%2Bqo3BJYEMXR07X%2BtSmoFs7rvQcMYUW01pDKqg%2BH6K1UQ7kIcKYlxteV9KYP6lzKvA4wQ2pn8pLtYn8%2FiQ12bO9jP1j4BQJuy4oAexXFDpFOz%2FiPAwgYBuqgbK%2BWevEUSa4kYwScq%2FYu1ayVz%2FKv8Kr5e5Iipw7UjQiThWJom%2FFbDOAWfE8UlOjiSkVi9oMpqiBiScsRh%2B7l1bwCDGtiv5MpzvfHv3ZSWP4QQCaS6UcThQf3En8W6A2fzzmwy1OOon1aDkcKt9qcU%3D&X-Amz-Signature=0534c97cdcb2da37d8810f09f2ba13e98ee0ba204bd9a505ce905aef17f33859';
    console.log(`[S3] PUT recording to presigned URL for content type ${contentType}. URL: ${url}`);
    await axios.put(url, content, { headers: { 'Content-Type': contentType } });
    console.log(`[S3] Upload recording upload successful.`);
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
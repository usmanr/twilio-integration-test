import { v4 as uuidv4 } from "uuid";
import { Enquiry, CreateEnquiryRequestSchema } from "./schema";
import { EnquiryRepository, createRepository } from "./repository";
import { extractFieldsFromTranscript } from "./extractor";

let repo: EnquiryRepository | null = null;
function getRepo(): EnquiryRepository {
  if (!repo) repo = createRepository();
  return repo;
}

export async function listEnquiries(): Promise<Enquiry[]> {
  return getRepo().listAll();
}

export async function getEnquiryById(id: string): Promise<Enquiry | null> {
  return getRepo().getById(id);
}

export async function createEnquiry(
  body: unknown,
): Promise<{ enquiry: Enquiry } | { error: string; details?: unknown }> {
  const parsed = CreateEnquiryRequestSchema.safeParse(body);
  if (!parsed.success) {
    return { error: "Invalid request body", details: parsed.error.format() };
  } else {
    console.log("Received valid request:", parsed.data);
  }
  const input = parsed.data;

  const rawTranscript =
    input.transcript ||
    input.steps.map((s) => `[${s.name}]: ${s.text}`).join("\n");

  const extracted = await extractFieldsFromTranscript(rawTranscript);

  const now = new Date();
  const enquiry: Enquiry = {
    id: uuidv4(),
    callSid: input.callSid,
    customerPhone: input.from,
    businessPhone: input.to,
    customerFirstName: extracted.customerFirstName,
    customerLastName: extracted.customerLastName,
    customerEmail: extracted.customerEmail,
    customerAddress: extracted.customerAddress,
    jobDescription: extracted.jobDescription,
    jobCategory: extracted.jobCategory,
    urgency: extracted.urgency,
    callReceivedAt: now.toISOString(),
    callDayOfWeek: now.toLocaleDateString("en-AU", { weekday: "long" }),
    status: "new",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    rawTranscript,
  };

  await getRepo().put(enquiry);

  return { enquiry };
}

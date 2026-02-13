import { z } from "zod";

export const EnquirySchema = z.object({
  id: z.string().nullable(),
  callSid: z.string().nullable(),
  customerPhone: z.string().nullable(),
  businessPhone: z.string().nullable(),
  customerFirstName: z.string().nullable(),
  customerLastName: z.string().nullable(),
  customerEmail: z.string().nullable(),
  customerAddress: z.string().nullable(),
  jobDescription: z.string(),
  jobCategory: z.string().nullable(),
  urgency: z.enum(["ASAP", "This week", "This month", "Flexible"]).nullable(),
  callReceivedAt: z.string(),
  callDayOfWeek: z.string(),
  status: z.enum(["new", "viewed", "contacted", "converted", "archived"]),
  createdAt: z.string(),
  updatedAt: z.string(),
  rawTranscript: z.string(),
});

export type Enquiry = z.infer<typeof EnquirySchema>;

export const ExtractedFieldsSchema = z.object({
  callSid: z.string().nullable(),
  customerPhone: z.string(),
  businessPhone: z.string().nullable(),
  customerFirstName: z.string().nullable(),
  customerLastName: z.string().nullable(),
  customerEmail: z.string().nullable(),
  customerAddress: z.string().nullable(),
  jobDescription: z.string(),
  jobCategory: z.string().nullable(),
  urgency: z.enum(["ASAP", "This week", "This month", "Flexible"]).nullable(),
});

export type ExtractedFields = z.infer<typeof ExtractedFieldsSchema>;

export const CreateEnquiryRequestSchema = z.object({
  callSid: z.string().nullable(),
  from: z.string().nullable(),
  to: z.string().nullable(),
  recordingUrl: z.string().optional(),
  recordingStatus: z.string().optional(),
  steps: z.array(
    z.object({
      name: z.string(),
      text: z.string(),
    }),
  ),
  transcript: z.string().optional(),
});

export type CreateEnquiryRequest = z.infer<typeof CreateEnquiryRequestSchema>;

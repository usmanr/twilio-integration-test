import { Agent, BedrockModel, TextBlock } from "@strands-agents/sdk";
import { ExtractedFieldsSchema, ExtractedFields } from "./schema";
import { raw } from "express";

const EXTRACTION_SYSTEM_PROMPT =
  `You are a data extraction assistant for a trades business call center.
You will receive a raw transcript from a phone call where a customer is describing a job they need done.
Extract the following fields and return ONLY a valid JSON object with the following schema:

` +
  JSON.stringify(ExtractedFieldsSchema.shape, null, 2) +
  `

Rules:
- If a field cannot be determined from the transcript, set it to null.
- Do NOT hallucinate information that is not in the transcript.
- For email addresses, reconstruct them from spelled-out text if needed (e.g. "u s m a n r at gmail dot com" -> "usmanr@gmail.com").
- For phone numbers in the transcript, ignore them as contact details (those come from caller ID).
- Infer urgency from context clues (e.g. "as soon as possible" = "ASAP", "no rush" = "Flexible").
- Return ONLY the JSON object. No markdown fences, no explanation.`;

let cachedAgent: Agent | null = null;

function getAgent(): Agent {
  if (cachedAgent) return cachedAgent;

  const model = new BedrockModel({
    modelId: "global.anthropic.claude-opus-4-6-v1",
    region: process.env.AWS_REGION || "us-east-1",
    maxTokens: 1024,
    temperature: 0,
  });

  cachedAgent = new Agent({
    model,
    systemPrompt: EXTRACTION_SYSTEM_PROMPT,
  });

  return cachedAgent;
}

export async function extractFieldsFromTranscript(
  rawTranscript: string,
): Promise<ExtractedFields> {
  const agent = getAgent();

  const result = await agent.invoke(rawTranscript);

  const responseText = (result.lastMessage?.content[0] as TextBlock).text || "";

  if (!responseText) {
    throw new Error("No response from agent");
  }

  // Strip markdown code fences if the model wraps the JSON
  const cleaned = responseText
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const parsed = JSON.parse(cleaned);
  console.log("Unparsed response::", JSON.stringify(parsed, null, 2));

  return ExtractedFieldsSchema.parse(parsed);
}

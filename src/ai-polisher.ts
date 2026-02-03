import { GoogleGenerativeAI, SchemaType, Schema } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const genAI = new GoogleGenerativeAI("AIzaSyBuVKZU3Jm3OYi9YGejuZ7tXFYAJKDKQvs");

/**
 * 1. DEFINE THE STRICT SCHEMA
 * This tells Gemini: "You are legally forbidden from returning anything else."
 */
const startSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    details: {
      type: SchemaType.STRING,
      description: "Overall summary of the job extracted primarily from Source 1 and Source 3.",
    },
    customerdetails: {
      type: SchemaType.OBJECT,
      properties: {
        name: { type: SchemaType.STRING, description: "Customer's full name", nullable: true },
        phone: { type: SchemaType.STRING, description: "Contact number", nullable: true },
        address: { type: SchemaType.STRING, description: "Job location or home address", nullable: true },
        email: { type: SchemaType.STRING, description: "Email address", nullable: true },
      },
      required: ["phone", "name", "address"], // Force these fields to exist (even if null)
    },
  },
  required: ["details", "customerdetails"],
};

// 2. INITIALIZE MODEL WITH SCHEMA
const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
  generationConfig: {
    responseMimeType: "application/json",
    responseSchema: startSchema,
  },
});

/**
 * 3. THE FUNCTION
 * Combines 3 inputs into one context.
 */
export const polishTranscript = async (
  prompt1_Initial: string, 
  prompt2_CustomerInfo: string, 
  prompt3_FollowUp: string
) => {

  // We combine the sources but label them clearly so the AI knows where to look.
  const combinedPrompt = `
    You are a data extraction assistant. 
    
    SOURCE 1 (Initial Request):
    "${prompt1_Initial}"

    SOURCE 2 (Customer Details Section):
    "${prompt2_CustomerInfo}"

    SOURCE 3 (Final Follow-up):
    "${prompt3_FollowUp}"

    INSTRUCTIONS:
    - Extract 'details' (the job description) primarily from SOURCE 1 and SOURCE 3.
    - Extract 'customerdetails' (name, phone, address) primarily from SOURCE 2.
    - If a field is missing, use null. Do not hallucinate data.
  `;

  try {
    const result = await model.generateContent(combinedPrompt);
    
    // Because we used a schema, we can safely assume this parses correctly.
    const responseText = result.response.text();
    return JSON.parse(responseText);

  } catch (error) {
    console.error("Gemini Extraction Failed:", error);
    return null;
  }
};
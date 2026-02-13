// src/index.ts
import * as dotenv from "dotenv"; // Corrected import for CommonJS modules

import express from "express";
import twilioRoutes from "./twilio/routes"
import sinchRoutes from "./sinch/routes"
import enquiryRoutes from "./enquiries/routes"
import { lowercaseBodyKeys } from "./middleware";

dotenv.config();

// Log all environment variables on startup
console.log('🚀 Starting server...');
console.log('📋 All Environment Variables:');
console.log('═'.repeat(80));

// Sort and display all environment variables
Object.keys(process.env)
  .sort()
  .forEach(key => {
    const value = process.env[key] || '';
    console.log(`  ${key}: ${value}`);
  });

console.log('═'.repeat(80));
console.log('');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: false })); // for Twilio's form-urlencoded data

// Enquiry routes mounted before lowercaseBodyKeys to preserve camelCase keys
app.use("/enquiries", enquiryRoutes);

// Apply middleware to make all req.body keys lowercase for case-insensitivity
app.use(lowercaseBodyKeys);

// Twilio Routes
app.use("/webhooks", twilioRoutes);
app.use("/webhooks/sinch", sinchRoutes);

// Health check endpoint
app.get("/ping", (_, res) => { res.type("text/html").send("pong"); });

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
// src/index.ts
import * as dotenv from "dotenv"; // Corrected import for CommonJS modules

import express from "express";
import routes from "./routes"
import { lowercaseBodyKeys } from "./middleware";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: false })); // for Twilio's form-urlencoded data

// Apply middleware to make all req.body keys lowercase for case-insensitivity
app.use(lowercaseBodyKeys);

// Mount Routes
app.use("/webhooks", routes);

// Health check endpoint
app.get("/ping", (_, res) => { res.type("text/html").send("pong"); });

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Exposed Endpoints:`);
  console.log(` - POST /webhooks/voice/incoming`);
  console.log(` - POST /webhooks/voice/completed`);
  console.log(` - POST /webhooks/voice/transcription`);
  console.log(` - POST /webhooks/voice/goodbye`);
  console.log(` - POST /webhooks/voice/ivr-incoming`);
  console.log(` - POST /webhooks/voice/ivr-selection`);
  console.log(` - POST /webhooks/voice/ivr-recording-completed`);
  console.log(` - POST /webhooks/voice/ivr-transcription-completed`);
  console.log(` - GET  /ping`);
});
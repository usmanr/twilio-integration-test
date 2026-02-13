# System Architecture

## System Overview

This is a serverless, event-driven telephony integration system built on AWS. It consists of:
- **Express.js application** (deployed on Railway) handling Twilio/Sinch webhooks
- **AWS Lambda functions** providing REST API for enquiry management
- **DynamoDB** for persistent enquiry storage
- **API Gateway** exposing HTTP endpoints
- **Amazon Bedrock** for AI-powered data extraction

## Architecture Diagram

```
                                    TELEPHONY LAYER
+---------------------------------------------------------------------------------+
|                                                                                 |
|  Twilio/Sinch Telephony Platform                                               |
|  - Phone Calls                                                                 |
|  - Voice Recording                                                             |
|  - Transcription                                                               |
|                                                                                 |
+----------------------------------+----------------------------------------------+
                                   | WEBHOOKS
                                   v
                              APPLICATION LAYER
+---------------------------------------------------------------------------------+
|                                                                                 |
|  Express.js Server (Railway)                                                   |
|  +-------------------------+  +-------------------------------------------+    |
|  | Twilio Routes           |  | Sinch Routes                            |    |
|  | - IVR Flow              |  | - Voice webhooks                        |    |
|  | - VA Flow               |  +-------------------------------------------+    |
|  | - Recording callbacks   |                                                   |
|  +-------------------------+  +-------------------------------------------+    |
|                               | Enquiry Routes (Internal API)            |    |
|                               | - GET /enquiries                         |    |
|                               | - GET /enquiries/:id                     |    |
|                               | - POST /enquiries                        |    |
|                               +-------------------------------------------+    |
|                                                                                 |
+----------------------------------+----------------------------------------------+
                                   | HTTP POST
                                   v
                            AWS SERVERLESS LAYER
+---------------------------------------------------------------------------------+
|                                                                                 |
|  +------------------------------+    +------------------------------------+    |
|  | API Gateway (HTTP API)       |    | Lambda Function                    |    |
|  | - /enquiries (GET, POST)     +--->+ (Node.js 20.x)                     |    |
|  | - /enquiries/{id} (GET)      |    | - Request validation (Zod)        |    |
|  | - API Key Authentication     |    | - AI extraction (Bedrock)         |    |
|  +------------------------------+    | - DynamoDB operations             |    |
|                                      +----------------+-------------------+    |
|                                                       |                        |
|                                                       v                        |
|                                      +----------------+-------------------+    |
|                                      | DynamoDB Table: Enquiries         |    |
|                                      | - Partition Key: id (String)      |    |
|                                      | - Pay-per-request billing         |    |
|                                      +-----------------------------------+    |
|                                                                                 |
|  +-----------------------------------------------------------------------+     |
|  | Secrets Manager                                                       |     |
|  | - enquiries/api-key                                                   |     |
|  +-----------------------------------------------------------------------+     |
|                                                                                 |
|  +-----------------------------------------------------------------------+     |
|  | Amazon Bedrock                                                        |     |
|  | - AI model invocation for field extraction                            |     |
|  +-----------------------------------------------------------------------+     |
|                                                                                 |
+---------------------------------------------------------------------------------+
```

## Component Descriptions

### Express.js Server (Railway Deployment)
- **Purpose**: Webhook endpoint for Twilio/Sinch telephony events
- **Responsibilities**:
  - Handle incoming call webhooks
  - Generate TwiML responses for voice interactions
  - Process recording and transcription callbacks
  - Forward enquiry data to Enquiries API
- **Dependencies**: Twilio SDK, Express, DotEnv
- **Type**: Application

### Twilio Module
- **Purpose**: Twilio-specific webhook handlers and TwiML generation
- **Responsibilities**:
  - IVR flow (menu-based call handling)
  - VA flow (conversational assistant with multi-step data collection)
  - Call recording management
  - Transcription processing
- **Dependencies**: Twilio SDK, Internal DB service, AI polisher
- **Type**: Application

### Sinch Module
- **Purpose**: Sinch telephony integration (alternative to Twilio)
- **Responsibilities**: Handle Sinch voice webhooks
- **Dependencies**: Sinch SDK
- **Type**: Application

### Enquiries Module
- **Purpose**: Core business logic for enquiry management
- **Responsibilities**:
  - Enquiry CRUD operations
  - AI-powered field extraction from transcripts
  - DynamoDB persistence
  - Request validation using Zod schemas
- **Dependencies**: AWS SDK (DynamoDB), Bedrock SDK, Zod
- **Type**: Application

### EnquiriesStack (AWS CDK)
- **Purpose**: Infrastructure for enquiries API
- **Responsibilities**:
  - Provision Lambda function
  - Create DynamoDB table
  - Set up HTTP API Gateway
  - Configure Secrets Manager for API key
  - Grant IAM permissions
- **Dependencies**: aws-cdk-lib
- **Type**: Infrastructure

### TwilioStack (AWS CDK)
- **Purpose**: Infrastructure for Twilio-related resources
- **Responsibilities**: TBD (newly added file)
- **Dependencies**: aws-cdk-lib, EnquiriesStack
- **Type**: Infrastructure

## Data Flow

### Main Flow: Call to Enquiry Creation

```
[Customer Call]
    |
    v
[Twilio Receives Call]
    |
    v
[Webhook: /webhooks/voice/va-incoming]
    |
    v
[Express Server: handleVaIncomingCall]
    |
    v
[TwiML: Voice Prompts + Speech Gather]
    |
    v
[Customer Speaks: Job Details]
    |
    v
[Twilio Transcribes Speech]
    |
    v
[Webhook: /webhooks/voice/va-transcription-available?step=job-details]
    |
    v
[Express Server: Stores transcript step, asks next question]
    |
    v
[Customer Provides: Contact Info and Address]
    |
    v
[Webhook: /webhooks/voice/va-transcription-available?step=address-details]
    |
    v
[Customer Provides: Final Notes]
    |
    v
[Webhook: /webhooks/voice/va-transcription-available?step=final-notes]
    |
    v
[Express Server: Consolidates transcript, POSTs to Enquiries API]
    |
    v
[API Gateway: /enquiries]
    |
    v
[Lambda: createEnquiry handler]
    |
    v
[Bedrock: Extract structured fields from transcript]
    |
    v
[DynamoDB: Store enquiry record]
    |
    v
[Response: Enquiry created with ID]
```

## Integration Points

### External APIs
- **Twilio Voice API**: Receives phone calls, generates TwiML responses, provides transcription
- **Sinch Voice API**: Alternative telephony provider
- **Amazon Bedrock API**: AI model invocation for field extraction from transcripts

### Databases
- **DynamoDB Table (Enquiries)**: Stores all enquiry records with structured fields
- **In-Memory Store**: Fallback repository for local development (when ENQUIRIES_TABLE_NAME not set)

### Third-party Services
- **Twilio**: Cloud telephony platform for voice calls and SMS
- **Sinch**: Alternative cloud communications platform
- **Amazon Bedrock**: AWS managed AI service for generative AI models

## Infrastructure Components

### CDK Stacks
- **EnquiriesStack**:
  - DynamoDB table "Enquiries" (partition key: id)
  - Lambda function (Node.js 20.x, 512MB, 60s timeout)
  - HTTP API Gateway with CORS
  - Secrets Manager secret for API key
  - IAM roles and policies (DynamoDB, Secrets Manager, Bedrock)

- **TwilioStack**:
  - Receives enquiries API URL from EnquiriesStack
  - Infrastructure TBD (newly added)

### Deployment Model
- **Express App**: Deployed on Railway (PaaS)
- **Lambda Functions**: Deployed via AWS CDK to AWS Lambda
- **Infrastructure**: Managed via AWS CDK (Infrastructure as Code)

### Networking
- **API Gateway**: Public HTTP API endpoint
- **Lambda**: Runs in AWS-managed VPC
- **DynamoDB**: AWS-managed service, accessed via AWS SDK
- **Express Server**: Public endpoint on Railway platform

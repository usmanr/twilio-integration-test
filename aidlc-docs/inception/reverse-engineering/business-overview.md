# Business Overview

## Business Context Diagram

```
+------------------+          +----------------------+          +------------------+
|                  |          |                      |          |                  |
|   Customer       |  CALL    |  Twilio/Sinch       |  WEBHOOK |   Express App    |
|   (Tradesman     +--------->+  Telephony Platform  +--------->+   (Voice IVR/VA) |
|    Prospect)     |          |                      |          |                  |
|                  |          +----------------------+          +--------+---------+
+------------------+                                                     |
                                                                         | API CALL
                                                                         v
                                                          +-------------+--------------+
                                                          |                            |
                                                          |  Enquiries API (Lambda)    |
                                                          |  - Extract Fields (AI)     |
                                                          |  - Store in DynamoDB       |
                                                          |                            |
                                                          +----------------------------+
                                                                         |
                                                                         | STORES
                                                                         v
                                                          +----------------------------+
                                                          |                            |
                                                          |  DynamoDB Enquiries Table  |
                                                          |  (CRM Data Storage)        |
                                                          |                            |
                                                          +----------------------------+
```

## Business Description

**Business Description**: This system is an **Automated Call Enquiry Capture and CRM System** for tradespersons (electricians, plumbers, etc.). It captures customer enquiries via phone calls, transcribes them using Twilio/Sinch telephony services, extracts structured information using AI, and stores them in a database for follow-up.

**Business Transactions**:
1. **Incoming Call Handling (IVR)**: Customer calls a virtual number, system provides IVR menu (auto-log or speak to tradie directly)
2. **Voice Recording & Transcription**: System records customer message and transcribes it using Twilio's transcription service
3. **Virtual Assistant Call Flow**: Interactive multi-step conversation that guides customer through providing job details, contact info, and address
4. **Enquiry Creation**: AI extracts structured fields (name, email, address, job description, urgency) from call transcript
5. **Enquiry Management**: CRUD operations for managing enquiries (list, get, create, update, delete)
6. **Status Tracking**: Track enquiry status (new, viewed, contacted, converted, archived)

**Business Dictionary**:
- **Tradie**: Australian slang for tradesperson (electrician, plumber, carpenter, etc.)
- **Enquiry**: A customer lead captured from a phone call, containing job details and contact information
- **Call Sid**: Twilio's unique identifier for a phone call session
- **IVR (Interactive Voice Response)**: Automated phone menu system
- **VA (Virtual Assistant)**: AI-powered conversational flow that collects information step-by-step
- **Virtual Number**: Twilio-provided phone number that forwards to tradie's real number
- **Urgency Levels**: ASAP, This week, This month, Flexible

## Component Level Business Descriptions

### Enquiries Module
- **Purpose**: Manages customer enquiry lifecycle from creation to archival
- **Responsibilities**:
  - Accept incoming enquiry data from call webhooks
  - Extract structured fields using AI (Bedrock)
  - Store/retrieve enquiries in DynamoDB
  - Provide REST API for enquiry management
  - Track enquiry status transitions

### Twilio/Sinch Integration Module
- **Purpose**: Handles telephony webhooks and voice interactions
- **Responsibilities**:
  - Process incoming call webhooks
  - Generate TwiML responses for IVR and VA flows
  - Manage call recording and transcription callbacks
  - Route calls based on customer selection
  - Collect customer information through voice prompts

### Infrastructure (AWS CDK)
- **Purpose**: Provisions and manages AWS cloud resources
- **Responsibilities**:
  - Deploy Lambda functions for enquiries API
  - Provision DynamoDB table for data storage
  - Create HTTP API Gateway for REST endpoints
  - Manage API authentication via Secrets Manager
  - Configure IAM permissions for AWS services

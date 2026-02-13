# API Documentation

## REST APIs

### Enquiries API

#### GET /enquiries
- **Method**: GET
- **Path**: `/enquiries`
- **Purpose**: List all enquiries
- **Authentication**: API Key required (x-api-key header)
- **Request**: None
- **Response**:
  ```json
  [
    {
      "id": "uuid",
      "callSid": "CA...",
      "customerPhone": "+61400000000",
      "businessPhone": "+61400000001",
      "customerFirstName": "John",
      "customerLastName": "Doe",
      "customerEmail": "john@example.com",
      "customerAddress": "123 Main St",
      "jobDescription": "Need electrician",
      "jobCategory": "electrical",
      "urgency": "ASAP",
      "callReceivedAt": "2026-02-13T00:00:00Z",
      "callDayOfWeek": "Thursday",
      "status": "new",
      "createdAt": "2026-02-13T00:00:00Z",
      "updatedAt": "2026-02-13T00:00:00Z",
      "rawTranscript": "..."
    }
  ]
  ```
- **Status Codes**: 200 OK

#### GET /enquiries/:id
- **Method**: GET
- **Path**: `/enquiries/{id}`
- **Purpose**: Get a single enquiry by ID
- **Authentication**: API Key required (x-api-key header)
- **Request**:
  - Path parameter: `id` (string, UUID)
- **Response**:
  ```json
  {
    "id": "uuid",
    "callSid": "CA...",
    "customerPhone": "+61400000000",
    ...
  }
  ```
- **Status Codes**:
  - 200 OK
  - 404 Not Found (if enquiry doesn't exist)

#### POST /enquiries
- **Method**: POST
- **Path**: `/enquiries`
- **Purpose**: Create a new enquiry from call data
- **Authentication**: API Key required (x-api-key header)
- **Request**:
  ```json
  {
    "callSid": "CA...",
    "from": "+61400000000",
    "to": "+61400000001",
    "recordingUrl": "https://...",
    "recordingStatus": "completed",
    "steps": [
      { "name": "job-details", "text": "I need an electrician" },
      { "name": "address-details", "text": "John Doe, 0400000000, 123 Main St" },
      { "name": "final-notes", "text": "Urgent, as soon as possible" }
    ],
    "transcript": "Combined transcript..."
  }
  ```
- **Response**:
  ```json
  {
    "id": "uuid",
    "callSid": "CA...",
    ...
  }
  ```
- **Status Codes**:
  - 201 Created
  - 400 Bad Request (validation error)

### Twilio Webhooks (Internal)

#### POST /webhooks/voice/ivr-incoming
- **Method**: POST
- **Path**: `/webhooks/voice/ivr-incoming`
- **Purpose**: Handle incoming IVR call, present menu
- **Request**: Twilio webhook payload (form-urlencoded)
- **Response**: TwiML XML
  ```xml
  <Response>
    <Gather numDigits="1" action="/webhooks/voice/ivr-selection" method="POST">
      <Say voice="Google.en-AU-Neural2-C" language="en-AU">
        Thanks for calling Micro electrician, please press 1 if you want to auto log a call, press 2 if you wish to speak to us directly
      </Say>
    </Gather>
    <Redirect>/webhooks/voice/ivr-incoming</Redirect>
  </Response>
  ```

#### POST /webhooks/voice/ivr-selection
- **Method**: POST
- **Path**: `/webhooks/voice/ivr-selection`
- **Purpose**: Handle IVR digit selection (1 = record, 2 = forward)
- **Request**: Twilio webhook with `digits` field
- **Response**: TwiML XML (either Record or Dial verb)

#### POST /webhooks/voice/va-incoming
- **Method**: POST
- **Path**: `/webhooks/voice/va-incoming`
- **Purpose**: Handle incoming call for Virtual Assistant flow
- **Request**: Twilio webhook payload
- **Response**: TwiML XML with Gather verb for speech input

#### POST /webhooks/voice/va-transcription-available
- **Method**: POST
- **Path**: `/webhooks/voice/va-transcription-available?step={step}`
- **Purpose**: Process transcribed speech, collect multi-step data
- **Request**:
  - Query param: `step` (job-details | address-details | final-notes)
  - Body: Twilio webhook with `speechresult` field
- **Response**: TwiML XML (next Gather or Hangup)

#### POST /webhooks/voice/va-recording-post
- **Method**: POST
- **Path**: `/webhooks/voice/va-recording-post`
- **Purpose**: Callback for call recording status updates
- **Request**: Twilio recording webhook payload
- **Response**: 200 OK

### Sinch Webhooks (Internal)

#### POST /webhooks/sinch/*
- **Method**: POST
- **Path**: `/webhooks/sinch/*`
- **Purpose**: Handle Sinch voice webhooks (alternative telephony provider)
- **Request**: Sinch webhook payload
- **Response**: Sinch ICE response format

## Internal APIs

### EnquiryRepository Interface
```typescript
interface EnquiryRepository {
  put(enquiry: Enquiry): Promise<void>;
  getById(id: string): Promise<Enquiry | null>;
  listAll(): Promise<Enquiry[]>;
  getByStatus(status: Enquiry['status']): Promise<Enquiry[]>;
  update(enquiry: Enquiry): Promise<void>;
  delete(id: string): Promise<void>;
}
```

#### Methods
- **put(enquiry)**: Insert or replace enquiry record
- **getById(id)**: Retrieve enquiry by ID, returns null if not found
- **listAll()**: Scan all enquiries (no pagination)
- **getByStatus(status)**: Filter enquiries by status (new, viewed, contacted, converted, archived)
- **update(enquiry)**: Update existing enquiry, sets updatedAt timestamp
- **delete(id)**: Delete enquiry by ID

### Controller Functions

#### listEnquiries()
```typescript
async function listEnquiries(): Promise<Enquiry[]>
```
- **Parameters**: None
- **Return**: Array of all enquiries
- **Usage**: Called by GET /enquiries route

#### getEnquiryById(id)
```typescript
async function getEnquiryById(id: string): Promise<Enquiry | null>
```
- **Parameters**: `id` - UUID string
- **Return**: Enquiry object or null
- **Usage**: Called by GET /enquiries/:id route

#### createEnquiry(body)
```typescript
async function createEnquiry(
  body: unknown
): Promise<{ enquiry: Enquiry } | { error: string; details?: unknown }>
```
- **Parameters**: `body` - Request body (validated against CreateEnquiryRequestSchema)
- **Return**: Success with enquiry object, or error with validation details
- **Usage**: Called by POST /enquiries route
- **Side Effects**:
  - Validates request body using Zod
  - Extracts fields from transcript using AI (Bedrock)
  - Generates UUID for new enquiry
  - Stores enquiry in DynamoDB

### Data Extraction Service

#### extractFieldsFromTranscript(transcript)
```typescript
async function extractFieldsFromTranscript(transcript: string): Promise<ExtractedFields>
```
- **Parameters**: `transcript` - Raw call transcript text
- **Return**: Structured fields extracted by AI
- **Fields Extracted**:
  - customerFirstName
  - customerLastName
  - customerEmail
  - customerAddress
  - jobDescription
  - jobCategory
  - urgency

## Data Models

### Enquiry
```typescript
{
  id: string | null;
  callSid: string | null;
  customerPhone: string | null;
  businessPhone: string | null;
  customerFirstName: string | null;
  customerLastName: string | null;
  customerEmail: string | null;
  customerAddress: string | null;
  jobDescription: string;
  jobCategory: string | null;
  urgency: "ASAP" | "This week" | "This month" | "Flexible" | null;
  callReceivedAt: string;
  callDayOfWeek: string;
  status: "new" | "viewed" | "contacted" | "converted" | "archived";
  createdAt: string;
  updatedAt: string;
  rawTranscript: string;
}
```

**Relationships**: None (flat structure)

**Validation**: Enforced by Zod schema `EnquirySchema`

### CreateEnquiryRequest
```typescript
{
  callSid: string | null;
  from: string | null;
  to: string | null;
  recordingUrl?: string;
  recordingStatus?: string;
  steps: Array<{ name: string; text: string }>;
  transcript?: string;
}
```

**Relationships**: Converted to Enquiry after AI extraction

**Validation**: Enforced by Zod schema `CreateEnquiryRequestSchema`

### ExtractedFields
```typescript
{
  callSid: string | null;
  customerPhone: string;
  businessPhone: string | null;
  customerFirstName: string | null;
  customerLastName: string | null;
  customerEmail: string | null;
  customerAddress: string | null;
  jobDescription: string;
  jobCategory: string | null;
  urgency: "ASAP" | "This week" | "This month" | "Flexible" | null;
}
```

**Relationships**: Intermediate format from AI extraction, merged into Enquiry

**Validation**: Enforced by Zod schema `ExtractedFieldsSchema`

# Code Structure

## Build System
- **Type**: npm/pnpm (Node.js package manager)
- **Configuration**:
  - Root `package.json` for Express application
  - `infra/package.json` for AWS CDK infrastructure
  - TypeScript compilation via `tsconfig.json`
  - Dev script: `pnpm dev` (nodemon + ts-node)

## Module Hierarchy

```
twilio-integration-test/
├── src/                              # Application source code
│   ├── index.ts                      # Express server entry point
│   ├── middleware.ts                 # Custom Express middleware
│   ├── ai-polisher.ts                # AI transcript polishing utility
│   │
│   ├── enquiries/                    # Enquiry management module
│   │   ├── controller.ts             # Business logic (list, get, create)
│   │   ├── repository.ts             # Data access layer (DynamoDB + InMemory)
│   │   ├── schema.ts                 # Zod schemas and TypeScript types
│   │   ├── routes.ts                 # Express routes (/enquiries)
│   │   ├── auth.ts                   # API key authentication middleware
│   │   ├── lambda.ts                 # AWS Lambda handler wrapper
│   │   └── extractor.ts              # AI-powered field extraction
│   │
│   ├── twilio/                       # Twilio integration module
│   │   ├── controller.ts             # Webhook handlers (IVR, VA flows)
│   │   ├── routes.ts                 # Express routes (/webhooks/voice/*)
│   │   ├── services.ts               # Database and SMS services
│   │   ├── lambda.ts                 # Lambda-specific code
│   │   ├── call-repository.ts        # Call record persistence
│   │   └── enquiries-agent.ts        # AI agent for enquiry processing
│   │
│   └── sinch/                        # Sinch integration module
│       ├── controller.ts             # Sinch webhook handlers
│       └── routes.ts                 # Express routes (/webhooks/sinch)
│
├── infra/                            # AWS CDK infrastructure code
│   ├── bin/
│   │   └── app.ts                    # CDK app entry point
│   └── lib/
│       ├── enquiries-stack.ts        # Enquiries API infrastructure
│       └── twilio-stack.ts           # Twilio-related infrastructure
│
├── package.json                      # Application dependencies
├── tsconfig.json                     # TypeScript configuration
└── aidlc-docs/                       # AI-DLC workflow documentation
```

## Existing Files Inventory

### Application Code (src/)
- `src/index.ts` - Express server initialization, route mounting, middleware setup
- `src/middleware.ts` - Custom middleware (lowercaseBodyKeys for case-insensitivity)
- `src/ai-polisher.ts` - AI utility for polishing call transcripts

### Enquiries Module (src/enquiries/)
- `src/enquiries/controller.ts` - **Controller with business logic**: listEnquiries(), getEnquiryById(), createEnquiry()
- `src/enquiries/repository.ts` - Repository interface with DynamoDB and InMemory implementations
- `src/enquiries/schema.ts` - Zod schemas for validation (EnquirySchema, CreateEnquiryRequestSchema)
- `src/enquiries/routes.ts` - Express routes for enquiries API (GET /, GET /:id, POST /)
- `src/enquiries/auth.ts` - API key authentication middleware (requireApiKey)
- `src/enquiries/lambda.ts` - AWS Lambda handler wrapper for serverless deployment
- `src/enquiries/extractor.ts` - AI-powered field extraction from call transcripts

### Twilio Module (src/twilio/)
- `src/twilio/controller.ts` - **Webhook handlers**: IVR flow, VA flow, recording/transcription callbacks
- `src/twilio/routes.ts` - Express routes for Twilio webhooks
- `src/twilio/services.ts` - Database service and SMS service abstractions
- `src/twilio/lambda.ts` - Lambda-specific Twilio code
- `src/twilio/call-repository.ts` - Call record data access layer
- `src/twilio/enquiries-agent.ts` - AI agent for processing enquiries

### Sinch Module (src/sinch/)
- `src/sinch/controller.ts` - Sinch webhook handlers
- `src/sinch/routes.ts` - Express routes for Sinch webhooks

### Infrastructure (infra/)
- `infra/bin/app.ts` - CDK app definition, stack instantiation
- `infra/lib/enquiries-stack.ts` - **EnquiriesStack**: DynamoDB, Lambda, API Gateway, Secrets Manager
- `infra/lib/twilio-stack.ts` - **TwilioStack**: Twilio-related AWS resources

## Design Patterns

### Repository Pattern
- **Location**: `src/enquiries/repository.ts`, `src/twilio/call-repository.ts`
- **Purpose**: Abstract data access logic from business logic
- **Implementation**:
  - Interface: `EnquiryRepository` with methods (put, getById, listAll, getByStatus, update, delete)
  - Implementations: `DynamoEnquiryRepository`, `InMemoryEnquiryRepository`
  - Factory: `createRepository()` selects implementation based on environment

### Controller Pattern (MVC)
- **Location**: `src/enquiries/controller.ts`, `src/twilio/controller.ts`
- **Purpose**: Separate HTTP handling from business logic
- **Implementation**: Controller functions called by route handlers, encapsulate business logic

### Dependency Injection (Singleton Pattern)
- **Location**: `src/enquiries/controller.ts` (lines 6-10)
- **Purpose**: Lazy initialization of repository instance
- **Implementation**:
  ```typescript
  let repo: EnquiryRepository | null = null;
  function getRepo(): EnquiryRepository {
    if (!repo) repo = createRepository();
    return repo;
  }
  ```

### Factory Pattern
- **Location**: `src/enquiries/repository.ts` (createRepository function)
- **Purpose**: Choose repository implementation based on environment
- **Implementation**: Returns DynamoDB repository if table name configured, else in-memory store

### Adapter Pattern
- **Location**: `src/enquiries/lambda.ts`
- **Purpose**: Adapt Express handlers to AWS Lambda event format
- **Implementation**: Lambda handler wraps Express app using serverless-http or similar

### Schema Validation (Zod)
- **Location**: `src/enquiries/schema.ts`
- **Purpose**: Runtime type validation and type inference
- **Implementation**: Define Zod schemas, infer TypeScript types, use safeParse() for validation

## Critical Dependencies

### AWS SDK v3
- **Versions**: @aws-sdk/client-dynamodb@^3.989.0, @aws-sdk/lib-dynamodb@^3.989.0
- **Usage**: DynamoDB operations in repository layer
- **Purpose**: Data persistence in DynamoDB table

### Twilio SDK
- **Version**: twilio@^5.12.0
- **Usage**: TwiML generation, voice responses
- **Purpose**: Telephony integration, voice call handling

### Strands Agents SDK
- **Version**: @strands-agents/sdk@^0.2.2
- **Usage**: AI agent orchestration
- **Purpose**: LLM integration via Amazon Bedrock

### Express
- **Version**: express@^5.2.1
- **Usage**: HTTP server, routing, middleware
- **Purpose**: Web framework for webhook handling

### Zod
- **Version**: zod@^4.3.6
- **Usage**: Schema validation throughout the app
- **Purpose**: Runtime type checking and validation

### TypeScript
- **Version**: typescript@^5.9.3
- **Usage**: Compilation, type checking
- **Purpose**: Type-safe JavaScript development

### AWS CDK
- **Version**: aws-cdk-lib@^2.238.0
- **Usage**: Infrastructure provisioning
- **Purpose**: Infrastructure as Code for AWS resources

### UUID
- **Version**: uuid@^13.0.0
- **Usage**: Generate unique IDs for enquiries
- **Purpose**: Primary key generation for DynamoDB records

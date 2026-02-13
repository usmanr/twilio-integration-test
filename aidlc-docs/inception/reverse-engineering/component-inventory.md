# Component Inventory

## Application Packages
- **src/enquiries** - Enquiry management module (CRUD operations, AI extraction, DynamoDB persistence)
- **src/twilio** - Twilio integration module (IVR flow, VA flow, webhook handlers)
- **src/sinch** - Sinch integration module (alternative telephony provider)
- **src/** (root) - Express server entry point, middleware, utilities

## Infrastructure Packages
- **infra/lib/enquiries-stack.ts** - CDK - Provisions Enquiries API infrastructure (Lambda, DynamoDB, API Gateway, Secrets Manager)
- **infra/lib/twilio-stack.ts** - CDK - Provisions Twilio-related AWS resources (newly added)

## Shared Packages
None (dependencies are declared in package.json but not as separate packages within the monorepo)

## Test Packages
None (no test files found in the codebase)

## Total Count
- **Total Packages**: 6
- **Application**: 4 (enquiries, twilio, sinch, root)
- **Infrastructure**: 2 (enquiries-stack, twilio-stack)
- **Shared**: 0
- **Test**: 0

## Module Breakdown

### Enquiries Module Files
| File | Purpose |
|------|---------|
| controller.ts | Business logic for enquiry operations |
| repository.ts | Data access layer with DynamoDB and InMemory implementations |
| schema.ts | Zod schemas and TypeScript types |
| routes.ts | Express REST API routes |
| auth.ts | API key authentication middleware |
| lambda.ts | AWS Lambda handler wrapper |
| extractor.ts | AI-powered field extraction from transcripts |

### Twilio Module Files
| File | Purpose |
|------|---------|
| controller.ts | Webhook handlers for IVR and VA flows |
| routes.ts | Express webhook routes |
| services.ts | Database and SMS service abstractions |
| lambda.ts | Lambda-specific Twilio code |
| call-repository.ts | Call record persistence layer |
| enquiries-agent.ts | AI agent for enquiry processing |

### Sinch Module Files
| File | Purpose |
|------|---------|
| controller.ts | Sinch webhook handlers |
| routes.ts | Express routes for Sinch webhooks |

### Infrastructure Module Files
| File | Purpose |
|------|---------|
| infra/bin/app.ts | CDK app entry point, stack instantiation |
| infra/lib/enquiries-stack.ts | EnquiriesStack definition (DynamoDB, Lambda, API Gateway) |
| infra/lib/twilio-stack.ts | TwilioStack definition (newly added) |

### Root Application Files
| File | Purpose |
|------|---------|
| src/index.ts | Express server initialization and configuration |
| src/middleware.ts | Custom Express middleware (lowercaseBodyKeys) |
| src/ai-polisher.ts | AI transcript polishing utility |

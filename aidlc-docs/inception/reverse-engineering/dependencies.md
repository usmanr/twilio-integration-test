# Dependencies

## Internal Dependencies

```
Root Application (src/index.ts)
    |
    +-- enquiries/routes  -->  enquiries/controller  -->  enquiries/repository
    |                                                  -->  enquiries/extractor
    |
    +-- twilio/routes  -->  twilio/controller  -->  twilio/services
    |                                          -->  twilio/call-repository
    |                                          -->  ai-polisher
    |
    +-- sinch/routes  -->  sinch/controller
    |
    +-- middleware

Infrastructure (infra/bin/app.ts)
    |
    +-- EnquiriesStack (lib/enquiries-stack.ts)
    |       |
    |       +-- Provisions: DynamoDB, Lambda, API Gateway, Secrets Manager
    |
    +-- TwilioStack (lib/twilio-stack.ts)
            |
            +-- Depends on: EnquiriesStack.api.apiEndpoint
```

### Dependency Relationships

#### src/index.ts depends on:
- **Type**: Runtime
- **Reason**: Mounts routes for enquiries, twilio, and sinch modules

#### enquiries/controller.ts depends on enquiries/repository.ts:
- **Type**: Runtime
- **Reason**: Uses repository for data persistence operations

#### enquiries/controller.ts depends on enquiries/extractor.ts:
- **Type**: Runtime
- **Reason**: AI extraction of structured fields from transcripts

#### twilio/controller.ts depends on twilio/services.ts:
- **Type**: Runtime
- **Reason**: Uses database service for call record management

#### twilio/controller.ts depends on ai-polisher.ts:
- **Type**: Runtime
- **Reason**: Polishes call transcripts using AI before processing

#### TwilioStack depends on EnquiriesStack:
- **Type**: Infrastructure
- **Reason**: Requires Enquiries API URL for posting enquiries from call webhooks

## External Dependencies

### Production Dependencies

#### @aws-sdk/client-dynamodb (3.989.0)
- **Purpose**: Low-level DynamoDB client for database operations
- **License**: Apache-2.0
- **Used By**: enquiries/repository.ts
- **Critical**: Yes (required for data persistence)

#### @aws-sdk/lib-dynamodb (3.989.0)
- **Purpose**: Higher-level DynamoDB Document Client with automatic marshalling
- **License**: Apache-2.0
- **Used By**: enquiries/repository.ts
- **Critical**: Yes (required for data persistence)

#### @aws-sdk/client-secrets-manager (3.989.0)
- **Purpose**: Retrieve API key from AWS Secrets Manager
- **License**: Apache-2.0
- **Used By**: enquiries/auth.ts, enquiries/lambda.ts
- **Critical**: Yes (required for API authentication)

#### twilio (5.12.0)
- **Purpose**: Twilio SDK for TwiML generation and voice call handling
- **License**: MIT
- **Used By**: twilio/controller.ts
- **Critical**: Yes (required for telephony integration)

#### @strands-agents/sdk (0.2.2)
- **Purpose**: LLM integration via Amazon Bedrock for AI operations
- **License**: Unknown
- **Used By**: enquiries/extractor.ts, ai-polisher.ts
- **Critical**: Yes (required for AI-powered field extraction)

#### express (5.2.1)
- **Purpose**: Web framework for HTTP server and routing
- **License**: MIT
- **Used By**: src/index.ts, all route files
- **Critical**: Yes (core application framework)

#### zod (4.3.6)
- **Purpose**: Schema validation and type inference
- **License**: MIT
- **Used By**: enquiries/schema.ts, enquiries/controller.ts
- **Critical**: Yes (required for request validation)

#### uuid (13.0.0)
- **Purpose**: Generate unique IDs for enquiries
- **License**: MIT
- **Used By**: enquiries/controller.ts
- **Critical**: Yes (required for primary key generation)

#### dotenv (17.2.3)
- **Purpose**: Load environment variables from .env file
- **License**: BSD-2-Clause
- **Used By**: src/index.ts
- **Critical**: Yes (required for configuration)

#### axios (1.13.4)
- **Purpose**: HTTP client for making API requests
- **License**: MIT
- **Used By**: Various (external API calls)
- **Critical**: Moderate

#### @sinch/sdk-core (1.3.0)
- **Purpose**: Sinch SDK for alternative telephony provider
- **License**: Unknown
- **Used By**: sinch/controller.ts
- **Critical**: Moderate (alternative to Twilio)

#### @google/generative-ai (0.24.1)
- **Purpose**: Google AI SDK
- **License**: Apache-2.0
- **Used By**: Unknown (possibly unused or for future use)
- **Critical**: No

#### @modelcontextprotocol/sdk (1.26.0)
- **Purpose**: Model Context Protocol implementation
- **License**: Unknown
- **Used By**: Unknown (possibly for Strands Agents)
- **Critical**: Moderate

### Development Dependencies

#### typescript (5.9.3)
- **Purpose**: TypeScript compiler and type system
- **License**: Apache-2.0

#### ts-node (10.9.2)
- **Purpose**: TypeScript execution for development
- **License**: MIT

#### nodemon (3.1.11)
- **Purpose**: Development server with hot reload
- **License**: MIT

#### @types/node (20.14.9)
- **Purpose**: TypeScript type definitions for Node.js
- **License**: MIT

#### @types/express (5.0.6)
- **Purpose**: TypeScript type definitions for Express
- **License**: MIT

#### @types/aws-lambda (8.10.160)
- **Purpose**: TypeScript type definitions for AWS Lambda
- **License**: MIT

### Infrastructure Dependencies (CDK)

#### aws-cdk-lib (2.238.0)
- **Purpose**: AWS CDK core library for infrastructure provisioning
- **License**: Apache-2.0
- **Used By**: infra/lib/*.ts

#### constructs (10.4.5)
- **Purpose**: CDK constructs library
- **License**: Apache-2.0
- **Used By**: infra/lib/*.ts

#### aws-cdk (2.1106.0)
- **Purpose**: CDK CLI tool for deployment
- **License**: Apache-2.0
- **Used By**: Command-line deployment

## Dependency Security Notes
- All AWS SDK packages are at v3.989.0 (latest minor version)
- Express is at v5.2.1 (major version upgrade from v4)
- No known critical vulnerabilities in listed dependencies
- Recommend: Run `pnpm audit` regularly to check for security issues

## Dependency Management
- **Lock File**: pnpm-lock.yaml (for reproducible builds)
- **Package Manager**: pnpm (per user's CLAUDE.md preference)
- **Update Strategy**: Regular updates for security patches, careful evaluation for major versions

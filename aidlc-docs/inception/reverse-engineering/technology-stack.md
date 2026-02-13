# Technology Stack

## Programming Languages
- **TypeScript** - 5.9.3 - Primary development language for type safety
- **JavaScript** - ES2020 - Compilation target for runtime execution

## Frameworks
- **Express.js** - 5.2.1 - Web framework for HTTP server and routing
- **AWS CDK** - aws-cdk-lib@2.238.0 - Infrastructure as Code framework
- **Node.js** - 20.x - Runtime environment (Lambda uses Node.js 20.x)

## Infrastructure

### AWS Services
- **AWS Lambda** - Serverless compute for Enquiries API
- **Amazon DynamoDB** - NoSQL database for enquiry storage
- **API Gateway v2 (HTTP API)** - REST API endpoint exposure
- **AWS Secrets Manager** - Secure storage for API keys
- **Amazon Bedrock** - AI model invocation for field extraction
- **IAM** - Identity and Access Management for service permissions

### Deployment Platforms
- **Railway** - PaaS for Express.js application hosting
- **AWS** - Cloud platform for serverless infrastructure

## Build Tools
- **npm/pnpm** - Latest - Package management (user prefers pnpm per CLAUDE.md)
- **ts-node** - 10.9.2 - TypeScript execution for development
- **nodemon** - 3.1.11 - Development server with hot reload
- **AWS CDK CLI** - 2.1106.0 - Infrastructure deployment tool

## Testing Tools
None currently configured in the project

## External APIs and SDKs

### Telephony
- **Twilio SDK** - twilio@5.12.0 - Voice calls, TwiML generation, transcription
- **Sinch SDK** - @sinch/sdk-core@1.3.0 - Alternative telephony provider

### AI and Agents
- **Strands Agents SDK** - @strands-agents/sdk@0.2.2 - LLM integration via Amazon Bedrock
- **Model Context Protocol SDK** - @modelcontextprotocol/sdk@1.26.0 - MCP protocol support
- **Google Generative AI** - @google/generative-ai@0.24.1 - Google AI models (unused or for future use)

### AWS SDKs
- **AWS SDK - DynamoDB Client** - @aws-sdk/client-dynamodb@3.989.0 - DynamoDB operations
- **AWS SDK - DynamoDB Document Client** - @aws-sdk/lib-dynamodb@3.989.0 - Higher-level DynamoDB operations
- **AWS SDK - Secrets Manager** - @aws-sdk/client-secrets-manager@3.989.0 - Secrets retrieval

### Utilities
- **Zod** - zod@4.3.6 - Schema validation and type inference
- **UUID** - uuid@13.0.0 - Unique ID generation
- **Axios** - axios@1.13.4 - HTTP client
- **dotenv** - dotenv@17.2.3 - Environment variable management

## Development Stack

### TypeScript Configuration
```json
{
  "target": "ES2020",
  "module": "commonjs",
  "strict": true,
  "esModuleInterop": true
}
```

### Runtime Environment
- **Node.js Version**: 20.x (Lambda runtime)
- **Package Type**: CommonJS (not ESM)
- **Module System**: CommonJS (require/exports)

## Deployment Architecture
- **Express App**: Railway PaaS deployment
- **Lambda Functions**: AWS Lambda (Node.js 20.x runtime)
- **Infrastructure**: Managed via AWS CDK stacks
- **Database**: Amazon DynamoDB (pay-per-request billing)

## Notable Technology Choices
- **Opus 4.6 for large model use cases** (per CLAUDE.md)
- **Haiku 4.5 for small model use cases** (per CLAUDE.md)
- **All LLM calls go through Amazon Bedrock via Strands Agents** (per CLAUDE.md)
- **pnpm for package management** (per CLAUDE.md)
- **Repository pattern for data access** (allows swapping between DynamoDB and in-memory stores)
- **Zod for runtime validation** (type-safe request/response validation)

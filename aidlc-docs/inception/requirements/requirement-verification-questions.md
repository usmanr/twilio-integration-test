# Requirements Verification Questions

Please answer the following questions to clarify the scope of the Python port. Fill in the letter choice after each `[Answer]:` tag.

## Question 1
What is the scope of the Python port? The TypeScript Twilio module consists of: `lambda.ts` (routing/handler), `controller.ts` (webhook handlers + TwiML generation), `services.ts` (DB/SMS/AI service abstractions), and `call-repository.ts` (DynamoDB persistence).

A) Port only `lambda.ts` (the Lambda handler routing layer) - controller and services remain in TypeScript
B) Port the full Twilio module (`lambda.ts` + `controller.ts` + `services.ts` + `call-repository.ts`) to Python
C) Port the full Twilio module plus the `ai-polisher.ts` utility
D) Other (please describe after [Answer]: tag below)

[Answer]:

## Question 2
Which Python web/Lambda framework approach should be used for the Lambda handler?

A) Plain Python handler function (no framework, similar to current TypeScript approach with manual routing)
B) AWS Lambda Powertools for Python (structured logging, event parsing, routing via APIGatewayRestResolver)
C) Flask/Mangum (Flask app wrapped for Lambda)
D) FastAPI/Mangum (FastAPI app wrapped for Lambda)
E) Other (please describe after [Answer]: tag below)

[Answer]:

## Question 3
For TwiML generation in Python, which approach should be used?

A) Twilio Python SDK (`twilio.twiml.voice_response.VoiceResponse`) - direct equivalent of the TypeScript SDK
B) Raw XML string construction
C) Other (please describe after [Answer]: tag below)

[Answer]:

## Question 4
Should the Python version use the same DynamoDB persistence pattern (boto3 equivalent of the TypeScript call-repository)?

A) Yes, use boto3 with the same DynamoDB table and repository pattern
B) Yes, but use a simpler direct boto3 approach without the repository abstraction
C) No, use a different persistence approach (please describe after [Answer]: tag below)
D) Other (please describe after [Answer]: tag below)

[Answer]:

## Question 5
Should the Python Lambda be deployed as a separate CDK stack, or added to the existing TwilioStack?

A) Add to the existing `infra/lib/twilio-stack.ts` CDK stack
B) Create a new separate CDK stack for the Python Lambda
C) No infrastructure changes needed at this stage - just the Python code
D) Other (please describe after [Answer]: tag below)

[Answer]:

## Question 6
Would you like me to perform deep research on Python + Twilio + AWS Lambda best practices before proceeding?

A) Yes, research best practices and patterns for Python Twilio Lambda handlers
B) No, proceed with standard approach based on the existing TypeScript patterns
C) Other (please describe after [Answer]: tag below)

[Answer]:

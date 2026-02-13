import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import querystring from 'querystring';
import {
  getIncomingCallWithIVRResponse,
  handleIvrSelection,
  handleIvrRecordingCompleted,
  handleIvrTranscriptionCompleted,
  handleVaIncomingCall,
  handleVaRecordingAvailable,
  handleVaTranscriptionAvailable,
  getAllCalls,
  getPolishedDescription,
} from './controller';

type HandlerFn = (req: any, res: any) => any;

const ROUTES: Array<{ method: string; path: string; handler: HandlerFn }> = [
  // IVR flow
  { method: 'POST', path: '/webhooks/voice/ivr-incoming', handler: getIncomingCallWithIVRResponse },
  { method: 'POST', path: '/webhooks/voice/ivr-selection', handler: handleIvrSelection },
  { method: 'POST', path: '/webhooks/voice/ivr-recording-completed', handler: handleIvrRecordingCompleted },
  { method: 'POST', path: '/webhooks/voice/ivr-transcription-completed', handler: handleIvrTranscriptionCompleted },
  // VA flow
  { method: 'POST', path: '/webhooks/voice/va-incoming', handler: handleVaIncomingCall },
  { method: 'POST', path: '/webhooks/voice/va-transcription-available', handler: handleVaTranscriptionAvailable },
  { method: 'POST', path: '/webhooks/voice/va-recording-post', handler: handleVaRecordingAvailable },
  // Debug / read endpoints
  { method: 'GET', path: '/webhooks/voice/all-calls', handler: getAllCalls },
  { method: 'GET', path: '/webhooks/voice/all-calls/polished', handler: getPolishedDescription },
];

/** Parse the event body (handles form-urlencoded from Twilio and JSON). */
function parseBody(event: APIGatewayProxyEventV2): Record<string, any> {
  let rawBody = event.body || '';
  if (event.isBase64Encoded) {
    rawBody = Buffer.from(rawBody, 'base64').toString('utf-8');
  }

  const contentType = event.headers?.['content-type'] || '';
  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(rawBody);
    } catch {
      return {};
    }
  }

  // Default: application/x-www-form-urlencoded (Twilio webhook format)
  return querystring.parse(rawBody) as Record<string, any>;
}

/** Replicate the lowercaseBodyKeys middleware used in Express. */
function lowercaseKeys(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const key in obj) {
    result[key.toLowerCase()] = obj[key];
  }
  return result;
}

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  const method = event.requestContext.http.method;
  const path = event.rawPath;

  // Derive BASE_URL from the API Gateway domain so TwiML callback URLs are correct
  process.env.BASE_URL = `https://${event.requestContext.domainName}`;

  const route = ROUTES.find(r => r.method === method && r.path === path);
  if (!route) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Route not found' }) };
  }

  // Build Express-like request
  const body = lowercaseKeys(parseBody(event));
  const req = {
    body,
    query: event.queryStringParameters || {},
    headers: event.headers || {},
    params: event.pathParameters || {},
  };

  // Build Express-like response that captures output
  let statusCode = 200;
  let responseBody = '';
  let contentType = 'application/json';

  const res: any = {
    type(ct: string) {
      contentType = ct;
      return res;
    },
    send(data: any) {
      responseBody = typeof data === 'string' ? data : JSON.stringify(data);
      return res;
    },
    json(data: any) {
      contentType = 'application/json';
      responseBody = JSON.stringify(data);
      return res;
    },
    status(code: number) {
      statusCode = code;
      return res;
    },
    sendStatus(code: number) {
      statusCode = code;
      responseBody = '';
      return res;
    },
  };

  try {
    await route.handler(req, res);
    return {
      statusCode,
      headers: { 'Content-Type': contentType },
      body: responseBody,
    };
  } catch (err) {
    console.error('Lambda handler error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

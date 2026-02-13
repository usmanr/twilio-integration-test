import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { listEnquiries, getEnquiryById, createEnquiry } from './controller';
import { validateApiKey } from './auth';

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  const method = event.requestContext.http.method;
  const path = event.rawPath;

  const apiKey = event.headers?.['x-api-key'];
  if (!(await validateApiKey(apiKey))) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    if (method === 'GET' && path === '/enquiries') {
      const enquiries = await listEnquiries();
      return { statusCode: 200, body: JSON.stringify(enquiries) };
    }

    if (method === 'GET' && path.startsWith('/enquiries/')) {
      const id = path.split('/enquiries/')[1];
      if (!id) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Missing id' }) };
      }
      const enquiry = await getEnquiryById(id);
      if (!enquiry) {
        return { statusCode: 404, body: JSON.stringify({ error: 'Not found' }) };
      }
      return { statusCode: 200, body: JSON.stringify(enquiry) };
    }

    if (method === 'POST' && path === '/enquiries') {
      const body = event.body ? JSON.parse(event.body) : {};
      const result = await createEnquiry(body);
      if ('error' in result) {
        return { statusCode: 400, body: JSON.stringify(result) };
      }
      return { statusCode: 201, body: JSON.stringify(result.enquiry) };
    }

    return { statusCode: 404, body: JSON.stringify({ error: 'Route not found' }) };
  } catch (err) {
    console.error('Lambda handler error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

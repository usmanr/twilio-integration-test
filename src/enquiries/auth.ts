import { Request, Response, NextFunction } from 'express';
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';

let cachedApiKey: string | null = null;

async function getApiKey(): Promise<string | null> {
  // Local dev: use API_KEY env var directly
  if (process.env.API_KEY) return process.env.API_KEY;

  // Lambda: fetch from Secrets Manager
  const secretArn = process.env.API_KEY_SECRET_ARN;
  if (!secretArn) return null; // no auth configured

  if (cachedApiKey) return cachedApiKey;

  const client = new SecretsManagerClient({});
  const resp = await client.send(
    new GetSecretValueCommand({ SecretId: secretArn })
  );
  cachedApiKey = resp.SecretString || null;
  return cachedApiKey;
}

export async function validateApiKey(
  key: string | undefined
): Promise<boolean> {
  const expected = await getApiKey();
  if (!expected) return true; // no key configured = auth disabled
  return key === expected;
}

export async function requireApiKey(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const key = req.header('x-api-key');
  if (!(await validateApiKey(key))) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

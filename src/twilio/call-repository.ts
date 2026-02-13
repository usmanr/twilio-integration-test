import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  ScanCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';

export interface CallRecord {
  callSid: string;
  from: string;
  to: string;
  status: string;
  recordingUrl?: string;
  recordingStatus?: string;
  transcript?: string;
  steps?: { name: string; text: string }[];
}

export interface CallRepository {
  logCall(callSid: string, from: string, to: string, status: string): Promise<void>;
  addRecording(callSid: string, recordingUrl: string, recordingStatus: string): Promise<void>;
  updateCallRecord(callSid: string, data: Partial<CallRecord>): Promise<void>;
  getCallRecord(callSid: string): Promise<CallRecord | null>;
  getAllCalls(): Promise<CallRecord[]>;
}

// ---------------------------------------------------------------------------
// DynamoDB implementation
// ---------------------------------------------------------------------------
export class DynamoCallRepository implements CallRepository {
  private docClient: DynamoDBDocumentClient;
  private tableName: string;

  constructor(tableName: string) {
    const client = new DynamoDBClient({ region: process.env.AWS_REGION });
    this.docClient = DynamoDBDocumentClient.from(client);
    this.tableName = tableName;
  }

  async logCall(callSid: string, from: string, to: string, status: string): Promise<void> {
    console.log(`[DB] Logged Call ${callSid}: ${status}. From: ${from}, To: ${to}`);
    await this.docClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { callSid },
        UpdateExpression: 'SET #from = :from, #to = :to, #status = :status',
        ExpressionAttributeNames: { '#from': 'from', '#to': 'to', '#status': 'status' },
        ExpressionAttributeValues: { ':from': from, ':to': to, ':status': status },
      })
    );
  }

  async addRecording(callSid: string, recordingUrl: string, recordingStatus: string): Promise<void> {
    console.log(`[DB] Added recording for ${callSid}: ${recordingUrl}`);
    await this.docClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { callSid },
        UpdateExpression: 'SET recordingUrl = :url, recordingStatus = :rs',
        ExpressionAttributeValues: { ':url': recordingUrl, ':rs': recordingStatus },
      })
    );
  }

  async updateCallRecord(callSid: string, data: Partial<CallRecord>): Promise<void> {
    console.log(`[DB] Updated Call ${callSid}:`, data);

    if (data.steps) {
      // Append steps to existing list
      const existing = await this.getCallRecord(callSid);
      const mergedSteps = [...(existing?.steps || []), ...data.steps];

      const { steps: _, ...rest } = data;
      const updateParts: string[] = ['#steps = :steps'];
      const names: Record<string, string> = { '#steps': 'steps' };
      const values: Record<string, any> = { ':steps': mergedSteps };

      for (const [key, value] of Object.entries(rest)) {
        const nameKey = `#${key}`;
        names[nameKey] = key;
        updateParts.push(`${nameKey} = :${key}`);
        values[`:${key}`] = value;
      }

      await this.docClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { callSid },
          UpdateExpression: `SET ${updateParts.join(', ')}`,
          ExpressionAttributeNames: names,
          ExpressionAttributeValues: values,
        })
      );
    } else {
      const updateParts: string[] = [];
      const names: Record<string, string> = {};
      const values: Record<string, any> = {};

      for (const [key, value] of Object.entries(data)) {
        const nameKey = `#${key}`;
        names[nameKey] = key;
        updateParts.push(`${nameKey} = :${key}`);
        values[`:${key}`] = value;
      }

      if (updateParts.length > 0) {
        await this.docClient.send(
          new UpdateCommand({
            TableName: this.tableName,
            Key: { callSid },
            UpdateExpression: `SET ${updateParts.join(', ')}`,
            ExpressionAttributeNames: names,
            ExpressionAttributeValues: values,
          })
        );
      }
    }
  }

  async getCallRecord(callSid: string): Promise<CallRecord | null> {
    console.log(`[DB] Getting record for ${callSid}`);
    const result = await this.docClient.send(
      new GetCommand({ TableName: this.tableName, Key: { callSid } })
    );
    return (result.Item as CallRecord) || null;
  }

  async getAllCalls(): Promise<CallRecord[]> {
    const result = await this.docClient.send(
      new ScanCommand({ TableName: this.tableName })
    );
    return (result.Items as CallRecord[]) || [];
  }
}

// ---------------------------------------------------------------------------
// In-memory implementation (existing mock behaviour for local dev)
// ---------------------------------------------------------------------------
export class InMemoryCallRepository implements CallRepository {
  private calls: CallRecord[] = [];

  async logCall(callSid: string, from: string, to: string, status: string): Promise<void> {
    console.log(`[DB] Logged Call ${callSid}: ${status}. From: ${from}, To: ${to}`);
    const existing = this.calls.find(c => c.callSid === callSid);
    if (existing) {
      existing.status = status;
    } else {
      this.calls.push({ callSid, from, to, status });
    }
  }

  async addRecording(callSid: string, recordingUrl: string, recordingStatus: string): Promise<void> {
    console.log(`[DB] Added recording for ${callSid}: ${recordingUrl}`);
    const call = this.calls.find(c => c.callSid === callSid);
    if (call) {
      call.recordingUrl = recordingUrl;
      call.recordingStatus = recordingStatus;
    }
  }

  async updateCallRecord(callSid: string, data: Partial<CallRecord>): Promise<void> {
    console.log(`[DB] Updated Call ${callSid}:`, data);
    const call = this.calls.find(c => c.callSid === callSid);

    if (call) {
      if (data.steps) {
        if (!call.steps) call.steps = [];
        call.steps.push(...data.steps);
        delete data.steps;
      }
      Object.assign(call, data);
    } else {
      this.calls.push({ callSid, from: '', to: '', status: 'PROCESSING', ...data });
    }
  }

  async getCallRecord(callSid: string): Promise<CallRecord | null> {
    console.log(`[DB] Getting record for ${callSid}`);
    return this.calls.find(c => c.callSid === callSid) || null;
  }

  async getAllCalls(): Promise<CallRecord[]> {
    return this.calls;
  }
}

// ---------------------------------------------------------------------------
// Factory: DynamoDB when TWILIO_CALLS_TABLE_NAME is set, else in-memory
// ---------------------------------------------------------------------------
export function createCallRepository(): CallRepository {
  const tableName = process.env.TWILIO_CALLS_TABLE_NAME;
  if (tableName) {
    return new DynamoCallRepository(tableName);
  }
  console.log('[CallRepo] No TWILIO_CALLS_TABLE_NAME set, using in-memory store');
  return new InMemoryCallRepository();
}

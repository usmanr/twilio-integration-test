import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  ScanCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { Enquiry } from './schema';

export interface EnquiryRepository {
  put(enquiry: Enquiry): Promise<void>;
  getById(id: string): Promise<Enquiry | null>;
  listAll(): Promise<Enquiry[]>;
  getByStatus(status: Enquiry['status']): Promise<Enquiry[]>;
  update(enquiry: Enquiry): Promise<void>;
  delete(id: string): Promise<void>;
}

export class DynamoEnquiryRepository implements EnquiryRepository {
  private docClient: DynamoDBDocumentClient;
  private tableName: string;

  constructor(tableName: string, region?: string) {
    const client = new DynamoDBClient({ region: region || process.env.AWS_REGION });
    this.docClient = DynamoDBDocumentClient.from(client);
    this.tableName = tableName;
  }

  async put(enquiry: Enquiry): Promise<void> {
    await this.docClient.send(
      new PutCommand({ TableName: this.tableName, Item: enquiry })
    );
  }

  async getById(id: string): Promise<Enquiry | null> {
    const result = await this.docClient.send(
      new GetCommand({ TableName: this.tableName, Key: { id } })
    );
    return (result.Item as Enquiry) || null;
  }

  async listAll(): Promise<Enquiry[]> {
    const result = await this.docClient.send(
      new ScanCommand({ TableName: this.tableName })
    );
    return (result.Items as Enquiry[]) || [];
  }

  async getByStatus(status: Enquiry['status']): Promise<Enquiry[]> {
    const result = await this.docClient.send(
      new ScanCommand({
        TableName: this.tableName,
        FilterExpression: 'status = :status',
        ExpressionAttributeValues: { ':status': status },
      })
    );
    return (result.Items as Enquiry[]) || [];
  }

  async update(enquiry: Enquiry): Promise<void> {
    const updated = { ...enquiry, updatedAt: new Date().toISOString() };
    await this.docClient.send(
      new PutCommand({ TableName: this.tableName, Item: updated })
    );
  }

  async delete(id: string): Promise<void> {
    await this.docClient.send(
      new DeleteCommand({ TableName: this.tableName, Key: { id } })
    );
  }
}

export class InMemoryEnquiryRepository implements EnquiryRepository {
  private store = new Map<string, Enquiry>();

  async put(enquiry: Enquiry): Promise<void> {
    this.store.set(enquiry.id, enquiry);
  }

  async getById(id: string): Promise<Enquiry | null> {
    return this.store.get(id) || null;
  }

  async listAll(): Promise<Enquiry[]> {
    return Array.from(this.store.values());
  }

  async getByStatus(status: Enquiry['status']): Promise<Enquiry[]> {
    return Array.from(this.store.values()).filter(
      (enquiry) => enquiry.status === status
    );
  }

  async update(enquiry: Enquiry): Promise<void> {
    const updated = { ...enquiry, updatedAt: new Date().toISOString() };
    this.store.set(updated.id!, updated);
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }
}

export function createRepository(): EnquiryRepository {
  const tableName = process.env.ENQUIRIES_TABLE_NAME;
  if (tableName) {
    return new DynamoEnquiryRepository(tableName);
  }
  console.log('[EnquiryRepo] No ENQUIRIES_TABLE_NAME set, using in-memory store');
  return new InMemoryEnquiryRepository();
}

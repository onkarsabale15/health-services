import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl as awsGetSignedUrl } from '@aws-sdk/s3-request-presigner';
import { IStorage } from './storage.interface';
import { logger as defaultLogger, ILogger } from '@hs/observability';

export interface StorageConfig {
  bucket?: string;
  region?: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  forcePathStyle?: boolean;
  logger?: ILogger;
}

class S3Storage implements IStorage {
  private client!: S3Client;
  private bucket = '';
  private log: ILogger = defaultLogger;
  private initialized = false;

  init(config: StorageConfig = {}): void {
    if (config.logger) this.log = config.logger;
    this.bucket = config.bucket || process.env.PLATFORM_AUDIT_LOGS_S3_BUCKET || '';

    this.client = new S3Client({
      region: config.region || process.env.REGION || 'us-east-1',
      ...(config.endpoint && { endpoint: config.endpoint }),
      ...(config.forcePathStyle && { forcePathStyle: true }),
      ...(config.accessKeyId &&
        config.secretAccessKey && {
          credentials: {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
          },
        }),
    });

    this.initialized = true;
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      this.init();
    }
  }

  async upload(key: string, data: Buffer | string, contentType: string): Promise<string> {
    this.ensureInitialized();
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: typeof data === 'string' ? Buffer.from(data) : data,
          ContentType: contentType,
        }),
      );
      this.log.debug('File uploaded to S3', { key });
      return key;
    } catch (error) {
      this.log.error('Error uploading to S3', error as Error, { key });
      throw error;
    }
  }

  async download(key: string): Promise<Buffer> {
    this.ensureInitialized();
    try {
      const response = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
      const chunks: Buffer[] = [];
      for await (const chunk of response.Body as any) {
        chunks.push(Buffer.from(chunk));
      }
      return Buffer.concat(chunks);
    } catch (error) {
      this.log.error('Error downloading from S3', error as Error, { key });
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    this.ensureInitialized();
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
      this.log.debug('File deleted from S3', { key });
    } catch (error) {
      this.log.error('Error deleting from S3', error as Error, { key });
      throw error;
    }
  }

  async getSignedUrl(key: string, expiresInSeconds: number = 3600): Promise<string> {
    this.ensureInitialized();
    try {
      const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
      return awsGetSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
    } catch (error) {
      this.log.error('Error generating signed URL', error as Error, { key });
      throw error;
    }
  }
}

/** Default singleton — uses PLATFORM_AUDIT_LOGS_S3_BUCKET env var */
export const storage: IStorage & { init: (config?: StorageConfig) => void } = new S3Storage();

/** Factory for creating separate storage instances (e.g., Supabase with custom endpoint) */
export function createStorage(config: StorageConfig): IStorage {
  const instance = new S3Storage();
  instance.init(config);
  return instance;
}

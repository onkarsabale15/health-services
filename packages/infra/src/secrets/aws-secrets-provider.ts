import {
  SecretsManagerClient,
  GetSecretValueCommand,
  PutSecretValueCommand,
  CreateSecretCommand,
  DeleteSecretCommand,
} from '@aws-sdk/client-secrets-manager';
import { ISecretsProvider } from './secrets.interface';
import { logger as defaultLogger, ILogger } from '@hs/observability';
import { cache as defaultCache, ICache } from '../cache';

const CACHE_TTL = 300; // 5 minutes

export interface SecretsConfig {
  region?: string;
  logger?: ILogger;
  cache?: ICache;
  cacheTtl?: number;
}

class AwsSecretsProvider implements ISecretsProvider {
  private client!: SecretsManagerClient;
  private cacheInstance: ICache = defaultCache;
  private log: ILogger = defaultLogger;
  private ttl = CACHE_TTL;
  private initialized = false;

  init(config: SecretsConfig = {}): void {
    if (config.logger) this.log = config.logger;
    if (config.cache) this.cacheInstance = config.cache;
    if (config.cacheTtl) this.ttl = config.cacheTtl;

    const clientConfig: Record<string, any> = {
      region: config.region || process.env.REGION || 'us-east-1',
    };

    // LocalStack for local development only
    if (process.env.LOCALSTACK_ENDPOINT) {
      clientConfig.endpoint = process.env.LOCALSTACK_ENDPOINT;
      clientConfig.credentials = {
        accessKeyId: 'test',
        secretAccessKey: 'test',
      };
    }

    this.client = new SecretsManagerClient(clientConfig);

    this.initialized = true;
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      this.init();
    }
  }

  async getSecretValue<T = unknown>(secretName: string): Promise<T> {
    this.ensureInitialized();

    const cacheKey = `secret:${secretName}`;
    const cached = await this.cacheInstance.get<T>(cacheKey);
    if (cached) {
      this.log.debug('Secret cache hit', { secretName });
      return cached;
    }

    try {
      const command = new GetSecretValueCommand({ SecretId: secretName });
      const response = await this.client.send(command);

      let secret: T;
      if (response.SecretString) {
        secret = JSON.parse(response.SecretString) as T;
      } else if (response.SecretBinary) {
        const decoded = Buffer.from(response.SecretBinary as Uint8Array).toString('utf-8');
        secret = JSON.parse(decoded) as T;
      } else {
        throw new Error('Secret not found or in unknown format');
      }

      await this.cacheInstance.set(cacheKey, secret, this.ttl);
      this.log.debug('Secret fetched and cached', { secretName });
      return secret;
    } catch (error) {
      this.log.error('Error retrieving secret', error as Error, { secretName });
      throw error;
    }
  }
  async putSecretValue(secretName: string, value: string): Promise<void> {
    this.ensureInitialized();

    try {
      const command = new PutSecretValueCommand({ SecretId: secretName, SecretString: value });
      await this.client.send(command);
      this.log.debug('Secret updated', { secretName });

      const cacheKey = `secret:${secretName}`;
      await this.cacheInstance.del(cacheKey);
    } catch (error: any) {
      if (error.name === 'ResourceNotFoundException') {
        const command = new CreateSecretCommand({ Name: secretName, SecretString: value });
        await this.client.send(command);
        this.log.debug('Secret created', { secretName });
      } else {
        this.log.error('Error putting secret', error as Error, { secretName });
        throw error;
      }
    }
  }
  async deleteSecretValue(secretName: string): Promise<void> {
    this.ensureInitialized();

    try {
      const command = new DeleteSecretCommand({
        SecretId: secretName,
        ForceDeleteWithoutRecovery: true,
      });
      await this.client.send(command);
      this.log.debug('Secret deleted', { secretName });

      const cacheKey = `secret:${secretName}`;
      await this.cacheInstance.del(cacheKey);
    } catch (error: any) {
      if (error.name === 'ResourceNotFoundException') {
        this.log.debug('Secret not found for deletion', { secretName });
        return;
      }
      this.log.error('Error deleting secret', error as Error, { secretName });
      throw error;
    }
  }
}

export const secrets: ISecretsProvider & { init: (config?: SecretsConfig) => void } = new AwsSecretsProvider();

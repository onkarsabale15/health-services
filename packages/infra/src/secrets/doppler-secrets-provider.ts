import DopplerSDK from '@dopplerhq/node-sdk';
import { ISecretsProvider } from './secrets.interface';
import { logger as defaultLogger, ILogger } from '@hs/observability';
import { cache as defaultCache, ICache } from '../cache';

const CACHE_TTL = 300; // 5 minutes

export interface SecretsConfig {
  token?: string;
  project?: string;
  config?: string;
  logger?: ILogger;
  cache?: ICache;
  cacheTtl?: number;
}

class DopplerSecretsProvider implements ISecretsProvider {
  private client!: DopplerSDK;
  private project = '';
  private config = '';
  private cacheInstance: ICache = defaultCache;
  private log: ILogger = defaultLogger;
  private ttl = CACHE_TTL;
  private initialized = false;

  init(cfg: SecretsConfig = {}): void {
    if (cfg.logger) this.log = cfg.logger;
    if (cfg.cache) this.cacheInstance = cfg.cache;
    if (cfg.cacheTtl) this.ttl = cfg.cacheTtl;

    const token = cfg.token || process.env.DOPPLER_TOKEN || '';
    this.project = cfg.project || process.env.DOPPLER_PROJECT || 'health-services';
    this.config = cfg.config || process.env.DOPPLER_CONFIG || 'dev';

    if (!token) {
      this.log.warn('DOPPLER_TOKEN not set — secrets provider will fail on requests');
    }

    this.client = new DopplerSDK({ accessToken: token });
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
      const response = await this.client.secrets.get(this.project, this.config, secretName);
      const raw = response.value?.raw;
      if (raw === undefined || raw === null) {
        throw new Error('Secret not found or empty');
      }

      let secret: T;
      try {
        secret = JSON.parse(raw) as T;
      } catch {
        secret = raw as unknown as T;
      }

      await this.cacheInstance.set(cacheKey, secret, this.ttl);
      this.log.debug('Secret fetched and cached', { secretName });
      return secret;
    } catch (error: any) {
      // "Not found" is expected for existence checks — don't log at error level
      const isNotFound =
        error?.message === 'Secret not found or empty' || error?.status === 404 || error?.statusCode === 404;
      if (isNotFound) {
        this.log.debug('Secret not found', { secretName });
      } else {
        this.log.error('Error retrieving secret', error as Error, { secretName });
      }
      throw error;
    }
  }

  async putSecretValue(secretName: string, value: string): Promise<void> {
    this.ensureInitialized();

    try {
      await this.client.secrets.update({
        project: this.project,
        config: this.config,
        secrets: { [secretName]: value },
      });

      this.log.debug('Secret updated', { secretName });

      const cacheKey = `secret:${secretName}`;
      await this.cacheInstance.del(cacheKey);
    } catch (error) {
      this.log.error('Error putting secret', error as Error, { secretName });
      throw error;
    }
  }

  /**
   * Load secrets from Doppler into process.env at app startup.
   * Skips if DOPPLER_TOKEN is not set (local dev uses .env directly).
   * Skips individual vars already present in process.env (.env wins).
   * Does NOT use cache (Redis may not be connected yet at boot).
   */
  async loadSecrets(secretNames: string[]): Promise<void> {
    if (!process.env.DOPPLER_TOKEN) {
      this.log.info('DOPPLER_TOKEN not set — using environment variables for secrets');
      return;
    }

    this.ensureInitialized();

    for (const name of secretNames) {
      if (process.env[name]) {
        this.log.debug(`Secret ${name} already set in env — skipping Doppler fetch`);
        continue;
      }

      try {
        const response = await this.client.secrets.get(this.project, this.config, name);
        const raw = response.value?.raw;
        if (raw === undefined || raw === null) {
          this.log.warn(`Secret ${name} not found in Doppler`);
          continue;
        }
        process.env[name] = raw;
        this.log.debug(`Secret ${name} loaded from Doppler into process.env`);
      } catch (error) {
        this.log.warn(`Failed to load secret ${name} from Doppler`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  async deleteSecretValue(secretName: string): Promise<void> {
    this.ensureInitialized();

    try {
      await this.client.secrets.delete(this.project, this.config, secretName);
      this.log.debug('Secret deleted', { secretName });

      const cacheKey = `secret:${secretName}`;
      await this.cacheInstance.del(cacheKey);
    } catch (error: any) {
      // If secret doesn't exist, ignore
      if (error?.status === 404 || error?.statusCode === 404) {
        this.log.debug('Secret not found for deletion', { secretName });
        return;
      }
      this.log.error('Error deleting secret', error as Error, { secretName });
      throw error;
    }
  }
}

export const secrets: ISecretsProvider & {
  init: (config?: SecretsConfig) => void;
  loadSecrets: (secretNames: string[]) => Promise<void>;
} = new DopplerSecretsProvider();

import Redis from 'ioredis';
import { ICache, IDistributedLock } from './cache.interface';
import { logger as defaultLogger, ILogger } from '@hs/observability';

export interface CacheConfig {
  url?: string;
  logger?: ILogger;
  maxRetriesPerRequest?: number;
  retryAttempts?: number;
  lazyConnect?: boolean;
  tls?: boolean;
}

class RedisCache implements ICache, IDistributedLock {
  private client!: Redis;
  private log: ILogger = defaultLogger;
  private initialized = false;

  init(config: CacheConfig = {}): void {
    if (config.logger) this.log = config.logger;

    const url = config.url || process.env.REDIS_URL || process.env.REDISURL;
    if (!url) {
      this.log.warn('No Redis URL provided — cache will fail on first operation');
    }

    this.client = new Redis(url || '', {
      lazyConnect: true,
      ...(config.tls ? { tls: {} } : {}),
    });

    this.client.on('ready', () => {
      this.log.info('Redis connection ready');
    });

    this.client.on('error', (err) => {
      this.log.error('Redis connection error', err);
    });

    this.initialized = true;
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      this.init();
    }
  }

  async connect(): Promise<void> {
    this.ensureInitialized();
    await this.client.connect();
  }

  async disconnect(): Promise<void> {
    if (this.initialized) {
      await this.client.quit();
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      this.ensureInitialized();
      const result = await this.client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    this.ensureInitialized();
    try {
      const result = await this.client.get(key);
      return result ? JSON.parse(result) : null;
    } catch (error) {
      this.log.error('Error getting value from Redis', error as Error, { key });
      throw error;
    }
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    this.ensureInitialized();
    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds) {
        await this.client.set(key, serialized, 'EX', ttlSeconds);
      } else {
        await this.client.set(key, serialized);
      }
    } catch (error) {
      this.log.error('Error setting value in Redis', error as Error, { key });
      throw error;
    }
  }

  async del(key: string): Promise<void> {
    this.ensureInitialized();
    try {
      await this.client.del(key);
    } catch (error) {
      this.log.error('Error deleting key from Redis', error as Error, { key });
      throw error;
    }
  }

  async delByPattern(pattern: string): Promise<number> {
    this.ensureInitialized();
    let deleted = 0;
    let cursor = '0';
    try {
      do {
        const [nextCursor, keys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;
        if (keys.length > 0) {
          deleted += await this.client.del(...keys);
        }
      } while (cursor !== '0');
      this.log.info('Deleted keys by pattern', { pattern, deleted });
      return deleted;
    } catch (error) {
      this.log.error('Error deleting keys by pattern', error as Error, { pattern });
      throw error;
    }
  }

  async getdel<T = unknown>(key: string): Promise<T | null> {
    this.ensureInitialized();
    try {
      const result = await this.client.getdel(key);
      return result ? JSON.parse(result) : null;
    } catch (error) {
      this.log.error('Error in getdel from Redis', error as Error, { key });
      throw error;
    }
  }

  async incr(key: string, ttlSeconds?: number): Promise<number> {
    this.ensureInitialized();
    try {
      if (ttlSeconds) {
        // Atomic: INCR + EXPIRE only on first creation (Lua script prevents race condition)
        const result = (await this.client.eval(
          `local n = redis.call('INCR', KEYS[1])
           if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
           return n`,
          1,
          key,
          ttlSeconds,
        )) as number;
        return result;
      }
      return this.client.incr(key);
    } catch (error) {
      this.log.error('Error incrementing key in Redis', error as Error, { key });
      throw error;
    }
  }

  async pttl(key: string): Promise<number> {
    this.ensureInitialized();
    try {
      return this.client.pttl(key);
    } catch (error) {
      this.log.error('Error getting PTTL from Redis', error as Error, { key });
      throw error;
    }
  }

  async setNx(key: string, value: unknown, ttlSeconds?: number): Promise<boolean> {
    this.ensureInitialized();
    try {
      const serialized = JSON.stringify(value);
      const result = ttlSeconds
        ? await this.client.set(key, serialized, 'EX', ttlSeconds, 'NX')
        : (await this.client.setnx(key, serialized))
          ? 'OK'
          : null;
      return result === 'OK';
    } catch (error) {
      this.log.error('Error setting NX value in Redis', error as Error, { key });
      throw error;
    }
  }

  async getAndExtend<T = unknown>(key: string, ttlSeconds: number): Promise<T | null> {
    this.ensureInitialized();
    try {
      const pipeline = this.client.pipeline();
      pipeline.get(key);
      pipeline.expire(key, ttlSeconds);
      const results = await pipeline.exec();
      if (!results || !results[0]) return null;
      const [err, data] = results[0];
      if (err) throw err;
      return data ? JSON.parse(data as string) : null;
    } catch (error) {
      this.log.error('Error in getAndExtend', error as Error, { key });
      throw error;
    }
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    this.ensureInitialized();
    try {
      await this.client.expire(key, ttlSeconds);
    } catch (error) {
      this.log.error('Error setting expiry', error as Error, { key });
      throw error;
    }
  }

  async expireAt(key: string, timestamp: number): Promise<void> {
    this.ensureInitialized();
    try {
      await this.client.expireat(key, timestamp);
    } catch (error) {
      this.log.error('Error setting expireAt', error as Error, { key });
      throw error;
    }
  }

  async flushAll(): Promise<void> {
    this.ensureInitialized();
    try {
      await this.client.flushall();
    } catch (error) {
      this.log.error('Error flushing all keys', error as Error);
      throw error;
    }
  }

  /**
   * Read-through cache helper — never lets cache failures break the caller.
   *
   *   1. Try to read the cached value.
   *      - Cache hit (non-null/non-undefined) → return it.
   *      - Cache miss                           → run `factory()`, store, return.
   *      - Cache read error                     → log, run `factory()`, return
   *                                               (no store since cache is unhealthy).
   *   2. `null` and `undefined` factory results are NEVER stored — `cache.get`
   *      cannot distinguish "key missing" from "key stored as null", so caching
   *      negatives would just waste Redis memory. Callers that want true
   *      negative caching should store a sentinel object (e.g. `{ found: false }`)
   *      and unwrap at the call site.
   *   3. Cache write errors are logged and swallowed — the factory result is
   *      always returned so callers never fail because of cache issues.
   */
  async getOrSet<T>(key: string, ttlSeconds: number, factory: () => Promise<T>): Promise<T> {
    let cached: T | null = null;
    try {
      cached = await this.get<T>(key);
    } catch (error) {
      this.log.warn('Cache read failed — falling through to factory', {
        key,
        error: (error as Error)?.message,
      });
      return factory();
    }

    if (cached !== null && cached !== undefined) return cached;

    const fresh = await factory();
    if (fresh !== null && fresh !== undefined) {
      this.set(key, fresh, ttlSeconds).catch((error) => {
        this.log.warn('Cache write failed', {
          key,
          error: (error as Error)?.message,
        });
      });
    }
    return fresh;
  }

  async acquire(key: string, ttlSeconds: number): Promise<boolean> {
    return this.setNx(key, { status: 'LOCKED' }, ttlSeconds);
  }

  async release(key: string): Promise<void> {
    await this.del(key);
  }
}

export const cache: ICache &
  IDistributedLock & {
    init: (config?: CacheConfig) => void;
    connect: () => Promise<void>;
    disconnect: () => Promise<void>;
    isHealthy: () => Promise<boolean>;
  } = new RedisCache();

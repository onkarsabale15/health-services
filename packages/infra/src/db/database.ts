import { PrismaClient } from '@prisma/client';
import { logger as defaultLogger, ILogger } from '@hs/observability';
import { v7 as uuidv7 } from 'uuid';

export interface DatabaseConfig {
  url?: string;
  logger?: ILogger;
  logQueries?: boolean;
}

class Database {
  private client!: PrismaClient;
  private log: ILogger = defaultLogger;
  private initialized = false;

  init(config: DatabaseConfig = {}): void {
    if (config.logger) this.log = config.logger;

    const datasourceUrl = config.url || process.env.DATABASE_URL;

    const base = new PrismaClient({
      datasourceUrl,
      log:
        config.logQueries !== false
          ? [
              { emit: 'event', level: 'query' },
              { emit: 'event', level: 'error' },
            ]
          : [{ emit: 'event', level: 'error' }],
    });

    // Auto-generate UUIDv7 for id fields on create (time-sorted, better index performance)
    this.client = base.$extends({
      query: {
        $allModels: {
          async create({ args, query }) {
            if (args.data && typeof args.data === 'object') {
              const data = args.data as Record<string, unknown>;
              if (!data.id) data.id = uuidv7();
            }
            return query(args);
          },
        },
      },
    }) as unknown as PrismaClient;

    if (config.logQueries !== false) {
      (base.$on as (event: any, listener: any) => void)('query', (e: { duration: number; query: string }) => {
        this.log.debug('Prisma query', { duration: e.duration, query: e.query });
      });
    }

    (base.$on as (event: any, listener: any) => void)('error', (e: { message: string }) => {
      this.log.error('Prisma error', new Error(e.message));
    });

    this.initialized = true;
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      this.init();
    }
  }

  /**
   * Chain a Prisma Client Extension onto the current client.
   * Extensions are composable — each call wraps the previous client.
   * Must be called after init() and before the first query.
   */
  extend(extension: any): void {
    this.ensureInitialized();
    this.client = (this.client as any).$extends(extension) as unknown as PrismaClient;
  }

  getClient(): PrismaClient {
    this.ensureInitialized();
    return this.client;
  }

  async connect(): Promise<void> {
    this.ensureInitialized();
    await this.client.$connect();
    this.log.info('Database connected');
  }

  async disconnect(): Promise<void> {
    if (this.initialized) {
      await this.client.$disconnect();
      this.log.info('Database disconnected');
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      this.ensureInitialized();
      await this.client.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}

export const db = new Database();

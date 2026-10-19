import * as winston from 'winston';
import { OpenTelemetryTransportV3 } from '@opentelemetry/winston-transport';
import { ILogger } from './logger.interface';

export interface LoggerConfig {
  service?: string;
  level?: string;
  silent?: boolean;
  /**
   * Emit logs to the OTel Logs SDK (→ OTLP → OneUptime) in addition to stdout.
   * Defaults to `true` — the OTLP endpoint is baked into `tracing.ts` so logs
   * always have a destination. Set `false` to suppress the OTel transport.
   */
  otel?: boolean;
}

/**
 * Structured JSON logger built on Winston.
 *
 * - Always emits **structured JSON** (one JSON object per line) — same shape
 *   in dev and prod, no pretty-printing variance.
 * - `traceId` / `spanId` are injected automatically by the OTel Winston
 *   instrumentation registered in `tracing.ts` — no manual context plumbing.
 * - When OTLP is configured, every Winston log also flows through
 *   `OpenTelemetryTransportV3` so OneUptime receives logs over the same OTLP
 *   pipeline as traces, with the trace correlation already attached.
 */
class Logger implements ILogger {
  private winstonLogger!: winston.Logger;
  private initialized = false;

  init(config: LoggerConfig = {}): void {
    const service = config.service || 'integration-engine';
    const level = config.level || process.env.LOG_LEVEL || 'info';
    const useOtel = config.otel ?? true;

    const transports: winston.transport[] = [new winston.transports.Console()];
    if (useOtel) transports.push(new OpenTelemetryTransportV3({ level }));

    this.winstonLogger = winston.createLogger({
      level,
      silent: config.silent || false,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
      ),
      defaultMeta: { service },
      transports,
    });

    this.initialized = true;
  }

  private ensureInitialized(): void {
    if (!this.initialized) this.init();
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.ensureInitialized();
    this.winstonLogger.info(message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.ensureInitialized();
    this.winstonLogger.warn(message, meta);
  }

  error(message: string, error?: Error, meta?: Record<string, unknown>): void {
    this.ensureInitialized();
    this.winstonLogger.error(message, { error: error?.message, stack: error?.stack, ...meta });
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.ensureInitialized();
    this.winstonLogger.debug(message, meta);
  }

  child(context: Record<string, unknown>): ILogger {
    this.ensureInitialized();
    const childLogger = new Logger();
    childLogger.winstonLogger = this.winstonLogger.child(context);
    childLogger.initialized = true;
    return childLogger;
  }
}

export const logger: ILogger = new Logger();

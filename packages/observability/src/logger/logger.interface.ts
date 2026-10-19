export interface ILogger {
  init(config?: { service?: string; level?: string; silent?: boolean }): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, error?: Error, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
  child(context: Record<string, unknown>): ILogger;
}

import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import { trace } from '@opentelemetry/api';
import { IHttpClient, HttpRequestConfig, HttpResponse } from './http-client.interface';
import { logger as defaultLogger, ILogger } from '@hs/observability';

export interface HttpClientConfig {
  logger?: ILogger;
  timeout?: number;
}

/**
 * Axios-backed HTTP client. Every call emits a single `audit.outbound` log
 * with method/url/host/status/duration + the active trace + span ids so the
 * SDK-driven internal calls in the platform are auditable end-to-end.
 *
 * OpenTelemetry's HTTP auto-instrumentation (registered in `@hs/observability`)
 * intercepts the underlying Node `http` requests, so:
 *   - A client span is created automatically per request.
 *   - W3C `traceparent` / `tracestate` headers are injected on the outgoing
 *     request — distributed traces stitch across services with no manual work.
 *
 * On error the audit log includes sanitized + truncated request/response
 * context for postmortem; success logs stay lean.
 */
class AxiosHttpClient implements IHttpClient {
  private log: ILogger = defaultLogger;
  private defaultTimeout = 60000;

  init(config: HttpClientConfig = {}): void {
    if (config.logger) this.log = config.logger;
    if (config.timeout) this.defaultTimeout = config.timeout;
  }

  async request<T = unknown>(config: HttpRequestConfig): Promise<HttpResponse<T>> {
    const method = (config.method || 'get').toUpperCase();
    const startTime = Date.now();

    const axiosConfig: AxiosRequestConfig = {
      url: config.url,
      method: config.method,
      headers: config.headers || {},
      params: config.params,
      data: config.data,
      timeout: config.timeout || this.defaultTimeout,
      responseType: config.responseType as never,
    };

    if (config.contentType) {
      axiosConfig.headers = { ...axiosConfig.headers, 'Content-Type': config.contentType };
    }
    if (config.authType && config.authToken) {
      axiosConfig.headers = { ...axiosConfig.headers, Authorization: `${config.authType} ${config.authToken}` };
    }

    try {
      const response = await axios(axiosConfig);
      const duration = Date.now() - startTime;
      this.auditOutbound({ method, url: config.url, status: response.status, durationMs: duration });
      return {
        data: response.data,
        status: response.status,
        headers: response.headers as Record<string, string>,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status ?? 0;
      const errorContext = {
        requestParams: config.params,
        requestHeaders: sanitizeHeaders(config.headers),
        requestBody: config.data ? truncate(safeStringify(sanitizeBody(config.data))) : undefined,
        responseBody: axiosError.response ? truncate(safeStringify(axiosError.response.data)) : undefined,
        responseHeaders: axiosError.response
          ? sanitizeHeaders(axiosError.response.headers as Record<string, string>)
          : undefined,
        errorCode: axiosError.code,
      };

      this.auditOutbound({
        method,
        url: config.url,
        status,
        durationMs: duration,
        error: axiosError.message,
        ...errorContext,
      });

      if (axiosError.response) {
        const httpError: Error & { status?: number; data?: unknown; headers?: unknown } = new Error(axiosError.message);
        httpError.status = status;
        httpError.data = axiosError.response.data;
        httpError.headers = axiosError.response.headers;
        throw httpError;
      }
      throw error;
    }
  }

  /** Emit the `audit.outbound` structured JSON log with trace correlation. */
  private auditOutbound(fields: {
    method: string;
    url: string;
    status: number;
    durationMs: number;
    error?: string;
    [k: string]: unknown;
  }): void {
    const ctx = trace.getActiveSpan()?.spanContext();
    const audit = {
      type: 'audit.outbound',
      method: fields.method,
      url: fields.url,
      host: hostOf(fields.url),
      status: fields.status,
      durationMs: fields.durationMs,
      traceId: ctx?.traceId,
      spanId: ctx?.spanId,
      ...(fields.error ? { error: fields.error } : {}),
      ...withoutCoreFields(fields),
    };
    const message = `audit.outbound ${fields.method} ${fields.url} → ${fields.status || 'ERR'}`;
    if (fields.error && fields.status >= 500) {
      this.log.error(message, undefined, audit);
    } else if (fields.error || fields.status >= 400) {
      this.log.warn(message, audit);
    } else {
      this.log.info(message, audit);
    }
  }
}

// ── helpers ──────────────────────────────────────────────────────

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
}

const CORE = new Set(['method', 'url', 'status', 'durationMs', 'error']);
function withoutCoreFields(fields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (!CORE.has(k) && v !== undefined) out[k] = v;
  }
  return out;
}

const SENSITIVE_HEADERS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'token',
  'proxy-authorization',
]);
function sanitizeHeaders(headers?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!headers) return undefined;
  const safe: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(headers)) {
    safe[k] = SENSITIVE_HEADERS.has(k.toLowerCase()) ? '[REDACTED]' : v;
  }
  return safe;
}

const SENSITIVE_BODY = ['password', 'secret', 'token', 'apikey', 'api_key', 'ssn'];
function sanitizeBody<T>(body: T): T {
  if (!body || typeof body !== 'object') return body;
  const clone: unknown = Array.isArray(body) ? [...body] : { ...(body as Record<string, unknown>) };
  const visit = (node: unknown, seen: WeakSet<object>): void => {
    if (!node || typeof node !== 'object' || seen.has(node as object)) return;
    seen.add(node as object);
    for (const key of Object.keys(node as Record<string, unknown>)) {
      const lower = key.toLowerCase();
      if (SENSITIVE_BODY.some((s) => lower.includes(s))) {
        (node as Record<string, unknown>)[key] = '[REDACTED]';
      } else {
        visit((node as Record<string, unknown>)[key], seen);
      }
    }
  };
  visit(clone, new WeakSet());
  return clone as T;
}

function safeStringify(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function truncate(str: string, max = 4096): string {
  if (str.length <= max) return str;
  return `${str.slice(0, max)}…[truncated ${str.length - max} bytes]`;
}

export const httpClient: IHttpClient & { init: (config?: HttpClientConfig) => void } = new AxiosHttpClient();

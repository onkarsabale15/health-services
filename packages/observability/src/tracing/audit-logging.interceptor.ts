import { Injectable, NestInterceptor, ExecutionContext, CallHandler, HttpException } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { trace } from '@opentelemetry/api';
import { logger } from '../logger';

const IGNORED_PATHS = new Set(['/health', '/', '/favicon.ico']);
const MAX_BODY_BYTES = 4096;
const SENSITIVE_HEADERS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'token',
  'proxy-authorization',
]);
const SENSITIVE_BODY_KEYS = ['password', 'secret', 'token', 'apikey', 'api_key', 'ssn', 'creditcard', 'credit_card'];

/**
 * Audit logging for every inbound API call. Emits a single `audit.inbound`
 * structured JSON log per request with method, path, status, duration, the
 * acting principal (when authenticated), request id, trace id, and — for
 * errors — sanitized + truncated request/response bodies.
 *
 * Skips `/health` and root probes so they don't dominate audit volume.
 * Globally registered via `@hs/bootstrap`; never duplicated per-app.
 */
@Injectable()
export class AuditLoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const http = context.switchToHttp();
    const req = http.getRequest();
    const res = http.getResponse();

    if (IGNORED_PATHS.has(req.path ?? req.url ?? '')) return next.handle();

    const start = Date.now();
    return next.handle().pipe(
      tap((body) => this.log(req, res, Date.now() - start, body)),
      catchError((error) => {
        this.log(req, res, Date.now() - start, null, error);
        return throwError(() => error);
      }),
    );
  }

  private log(req: ReqLike, res: ResLike, durationMs: number, responseBody: unknown, error?: unknown): void {
    const statusCode = error ? (error instanceof HttpException ? error.getStatus() : 500) : (res.statusCode ?? 0);

    const span = trace.getActiveSpan();
    const ctx = span?.spanContext();
    const principal = extractPrincipal(req);

    const audit: Record<string, unknown> = {
      type: 'audit.inbound',
      method: req.method,
      path: req.route?.path || req.originalUrl || req.url,
      url: req.originalUrl || req.url,
      statusCode,
      durationMs,
      requestId: req.id,
      traceId: ctx?.traceId,
      spanId: ctx?.spanId,
      ...principal,
    };

    // Span enrichment — searchable in OneUptime.
    if (span) {
      const attrs: Record<string, string | number | boolean> = {
        'http.status_code': statusCode,
        'audit.type': 'inbound',
      };
      if (req.id) attrs['request.id'] = req.id;
      for (const [k, v] of Object.entries(principal)) {
        if (v != null) attrs[`audit.${k}`] = String(v);
      }
      if (statusCode >= 400) attrs['audit.error'] = true;
      span.setAttributes(attrs);
    }

    // Errors carry sanitized + truncated context for postmortem; success logs stay lean.
    if (statusCode >= 400) {
      audit.requestHeaders = sanitizeHeaders(req.headers);
      audit.requestBody = truncate(safeStringify(sanitizeBody(req.body)));
      audit.responseBody = truncate(safeStringify(sanitizeBody(responseBody ?? extractErrorBody(error))));
    }

    const message = `audit.inbound ${req.method} ${audit.path ?? audit.url} → ${statusCode}`;
    if (error && statusCode >= 500) logger.error(message, error as Error, audit);
    else if (statusCode >= 400) logger.warn(message, audit);
    else logger.info(message, audit);
  }
}

// ── helpers ──────────────────────────────────────────────────────

interface ReqLike {
  method?: string;
  url?: string;
  originalUrl?: string;
  path?: string;
  route?: { path?: string };
  params?: unknown;
  query?: unknown;
  headers?: Record<string, unknown>;
  body?: unknown;
  id?: string;
  user?: Record<string, unknown> & {
    appId?: string;
    clientId?: string;
    sub?: string;
    id?: string;
    organizationId?: string;
    org_id?: string;
    orgId?: string;
    role?: string;
    appType?: string;
    ehrName?: string;
    email?: string;
  };
  cdsSession?: {
    providerSession?: { applicationId?: string; ehrName?: string; launchMode?: string; providerFhirId?: string };
  };
  connectionData?: { ehrName?: string; siteId?: string };
}

interface ResLike {
  statusCode?: number;
}

/** Pull the acting principal out of whichever auth shape the guard set. */
function extractPrincipal(req: ReqLike): Record<string, string | undefined> {
  const u = req.user;
  const cds = req.cdsSession?.providerSession;
  return {
    enduser: u?.sub || u?.id || cds?.providerFhirId || u?.email,
    app: u?.appId || u?.clientId || cds?.applicationId,
    org: u?.organizationId || u?.org_id || u?.orgId,
    role: u?.role || u?.appType,
    ehr: u?.ehrName || cds?.ehrName || req.connectionData?.ehrName,
    launchMode: cds?.launchMode,
    siteId: req.connectionData?.siteId,
  };
}

function extractErrorBody(error: unknown): unknown {
  if (!error) return undefined;
  const e = error as { response?: unknown; message?: string };
  return e.response ?? e.message;
}

function sanitizeHeaders(headers: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!headers) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(headers)) {
    out[k] = SENSITIVE_HEADERS.has(k.toLowerCase()) ? '[REDACTED]' : v;
  }
  return out;
}

function sanitizeBody<T>(body: T): T {
  if (!body || typeof body !== 'object') return body;
  const seen = new WeakSet<object>();
  const visit = (node: unknown): void => {
    if (!node || typeof node !== 'object' || seen.has(node as object)) return;
    seen.add(node as object);
    for (const key of Object.keys(node as Record<string, unknown>)) {
      const lower = key.toLowerCase();
      if (SENSITIVE_BODY_KEYS.some((s) => lower.includes(s))) {
        (node as Record<string, unknown>)[key] = '[REDACTED]';
      } else {
        visit((node as Record<string, unknown>)[key]);
      }
    }
  };
  // Shallow-clone so we don't mutate the caller's body.
  const clone = Array.isArray(body) ? [...body] : { ...(body as Record<string, unknown>) };
  visit(clone);
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

function truncate(str: string): string {
  if (str.length <= MAX_BODY_BYTES) return str;
  return `${str.slice(0, MAX_BODY_BYTES)}…[truncated ${str.length - MAX_BODY_BYTES} bytes]`;
}

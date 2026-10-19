import type { Span, SpanProcessor as ISpanProcessor } from '@opentelemetry/sdk-trace-base';
import { SpanStatusCode } from '@opentelemetry/api';

/**
 * OTel SpanProcessor that auto-attaches request/response details to error spans.
 *
 * On span end, if the span has a non-OK status (HTTP 4xx/5xx, network errors),
 * it copies relevant attributes into span events for debugging.
 *
 * Works with any OTel-instrumented HTTP library (axios, fetch, http.request)
 * — no per-client code needed.
 *
 * Sensitive headers (Authorization, Cookie) are stripped automatically.
 */

const SENSITIVE_HEADERS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'x-session-id',
  'x-site-id',
  'proxy-authorization',
]);

const MAX_BODY_LENGTH = 4096;

export class ErrorEnrichmentProcessor implements ISpanProcessor {
  forceFlush(): Promise<void> {
    return Promise.resolve();
  }
  shutdown(): Promise<void> {
    return Promise.resolve();
  }

  onStart(): void {
    // No-op — enrichment happens at span end
  }

  onEnd(span: Span): void {
    // Only enrich HTTP spans that ended with an error status
    const status = span.status;
    if (status.code === SpanStatusCode.OK || status.code === SpanStatusCode.UNSET) return;

    const attrs = span.attributes;
    const httpMethod = attrs['http.method'] || attrs['http.request.method'];
    if (!httpMethod) return; // Not an HTTP span

    const statusCode = Number(attrs['http.status_code'] || attrs['http.response.status_code'] || 0);
    if (statusCode >= 200 && statusCode < 400) return; // Success — skip

    // Build error context event
    const errorContext: Record<string, string> = {};

    // Request info
    if (attrs['http.url']) errorContext['request.url'] = String(attrs['http.url']);
    if (attrs['url.full']) errorContext['request.url'] = String(attrs['url.full']);
    errorContext['request.method'] = String(httpMethod);
    if (statusCode) errorContext['response.status'] = String(statusCode);

    // Request headers (sanitized)
    const reqHeaders = attrs['http.request.header'];
    if (typeof reqHeaders === 'string') {
      errorContext['request.headers'] = sanitizeHeaders(reqHeaders);
    }

    // Response body (if captured by instrumentation — OTel HTTP doesn't capture by default,
    // but custom instrumentations or Sentry might)
    const respBody = attrs['http.response.body'] || attrs['http.response_body'];
    if (respBody) {
      errorContext['response.body'] = truncate(String(respBody));
    }

    // Error message
    if (status.message) {
      errorContext['error.message'] = truncate(status.message);
    }

    span.addEvent('error.context', errorContext);
  }
}

function sanitizeHeaders(raw: string): string {
  try {
    const parsed = JSON.parse(raw);
    for (const key of Object.keys(parsed)) {
      if (SENSITIVE_HEADERS.has(key.toLowerCase())) {
        parsed[key] = '[REDACTED]';
      }
    }
    return JSON.stringify(parsed);
  } catch {
    return raw;
  }
}

function truncate(str: string): string {
  return str.length > MAX_BODY_LENGTH ? str.slice(0, MAX_BODY_LENGTH) + '...[truncated]' : str;
}

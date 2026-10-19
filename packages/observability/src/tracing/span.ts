import { trace, SpanStatusCode, type Span as OtelSpan } from '@opentelemetry/api';

// ─── Span Helpers ────────────────────────────────────────────────────────────
//
// Thin wrapper around the OTel span API so consumers never import OTel
// directly. Every span started here participates in the currently active
// context — wrapping a root call in `withSpan(...)` automatically makes
// every nested `withSpan` a child, producing a single trace in OneUptime.

const TRACER_NAME = 'ib.spans';

export type Span = OtelSpan;

export interface SpanOptions {
  /** Semantic operation — e.g. 'sync.run', 'http.client', 'db.upsert' */
  op: string;
  /** Human-readable span name shown in tracing UI */
  name: string;
  /** Optional structured attributes attached up-front */
  attributes?: Record<string, string | number | boolean>;
}

/**
 * Run `fn` inside a tracing span. On throw, marks the span as errored and
 * re-throws — so outer handlers still see the original exception.
 *
 * Example:
 * ```ts
 * await withSpan({ op: 'sync.run', name: 'terminology-sync.run' }, async (span) => {
 *   span.setAttribute('sync.type', 'icd-snomed');
 *   await doWork();
 * });
 * ```
 */
export function withSpan<T>(options: SpanOptions, fn: (span: Span) => Promise<T>): Promise<T> {
  const tracer = trace.getTracer(TRACER_NAME);
  const attributes = { 'span.op': options.op, ...(options.attributes || {}) };
  return tracer.startActiveSpan(options.name, { attributes }, async (span) => {
    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      span.end();
      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error instanceof Error ? error.message : undefined });
      span.end();
      throw error;
    }
  });
}

/** Attach an attribute to a span if provided (no-op when undefined). */
export function setSpanAttribute(span: Span | undefined, key: string, value: string | number | boolean): void {
  if (span) span.setAttribute(key, value);
}

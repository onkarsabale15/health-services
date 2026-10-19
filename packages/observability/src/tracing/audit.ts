import { trace, SpanStatusCode, type Span } from '@opentelemetry/api';

/**
 * Audit module — pure OpenTelemetry, zero vendor lock-in.
 *
 * Uses OTel spans and attributes for audit trails. The exporter (Sentry, OneUptime,
 * Jaeger, etc.) is configured separately in tracing.ts — this module doesn't
 * know or care which backend receives the data.
 *
 * Three levels:
 *   setAuditContext(span, ctx)  → attach audit attributes to an existing span
 *   auditedSpan(name, ctx, fn) → wrap an operation in a new audited span
 *   auditBreadcrumb(ctx)       → record a lightweight audit event on the active span
 *
 * NO PHI — only IDs, NPI, action types, resource types, outcomes.
 */

const TRACER_NAME = 'ib.audit';

export interface AuditContext {
  action: 'read' | 'search' | 'create' | 'update' | 'delete' | 'export' | 'login' | 'launch';
  resourceType?: string;
  resourceId?: string;
  patientId?: string;
  providerId?: string;
  providerNpi?: string;
  launchMode?: 'ehr' | 'standalone' | 'system';
  applicationId?: string;
  organizationId?: string;
  siteId?: string;
  ehrName?: string;
  carePlanId?: string;
  outcome?: 'success' | 'failure' | 'denied';
  detail?: string;
}

// ── Attribute helpers ───────────────────────────────────────

/** Convert AuditContext to OTel span attributes */
function toAttributes(ctx: AuditContext): Record<string, string> {
  const attrs: Record<string, string> = { 'audit.action': ctx.action };
  if (ctx.resourceType) attrs['audit.resourceType'] = ctx.resourceType;
  if (ctx.resourceId) attrs['audit.resourceId'] = ctx.resourceId;
  if (ctx.patientId) attrs['audit.patientId'] = ctx.patientId;
  if (ctx.providerId) attrs['audit.providerId'] = ctx.providerId;
  if (ctx.providerNpi) attrs['audit.providerNpi'] = ctx.providerNpi;
  if (ctx.launchMode) attrs['audit.launchMode'] = ctx.launchMode;
  if (ctx.applicationId) attrs['audit.applicationId'] = ctx.applicationId;
  if (ctx.organizationId) attrs['audit.organizationId'] = ctx.organizationId;
  if (ctx.siteId) attrs['audit.siteId'] = ctx.siteId;
  if (ctx.ehrName) attrs['audit.ehrName'] = ctx.ehrName;
  if (ctx.carePlanId) attrs['audit.carePlanId'] = ctx.carePlanId;
  if (ctx.outcome) attrs['audit.outcome'] = ctx.outcome;
  if (ctx.detail) attrs['audit.detail'] = ctx.detail;
  return attrs;
}

// ── Public API ──────────────────────────────────────────────

/** Attach audit attributes to an existing OTel span */
export function setAuditContext(ctx: AuditContext): void {
  const span = trace.getActiveSpan();
  if (!span) return;
  span.setAttributes(toAttributes(ctx));
}

/** Wrap an async operation in a new OTel span with audit attributes */
export async function auditedSpan<T>(name: string, ctx: AuditContext, fn: () => Promise<T>): Promise<T> {
  const tracer = trace.getTracer(TRACER_NAME);

  return tracer.startActiveSpan(name, { attributes: toAttributes(ctx) }, async (span: Span) => {
    try {
      const result = await fn();
      span.setAttributes({ 'audit.outcome': 'success' });
      span.setStatus({ code: SpanStatusCode.OK });
      span.end();
      return result;
    } catch (error) {
      span.setAttributes({
        'audit.outcome': 'failure',
        'audit.detail': error instanceof Error ? error.message : 'Unknown error',
      });
      span.setStatus({ code: SpanStatusCode.ERROR, message: error instanceof Error ? error.message : undefined });
      span.end();
      throw error;
    }
  });
}

/** Record a lightweight audit event as a span event on the active span */
export function auditBreadcrumb(ctx: AuditContext): void {
  const span = trace.getActiveSpan();
  if (!span) return;
  span.addEvent('audit', toAttributes(ctx));
}

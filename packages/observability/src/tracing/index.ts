export { tracing, trace, type TracingConfig } from './tracing';
export { setAuditContext, auditedSpan, auditBreadcrumb, type AuditContext } from './audit';
export { ErrorEnrichmentProcessor } from './error-enrichment';
export { withSpan, setSpanAttribute, type Span, type SpanOptions } from './span';
export { AuditLoggingInterceptor } from './audit-logging.interceptor';

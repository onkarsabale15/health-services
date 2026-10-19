import { trace } from '@opentelemetry/api';
import { WebTracerProvider, BatchSpanProcessor } from '@opentelemetry/sdk-trace-web';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import * as OTelResources from '@opentelemetry/resources';
import { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_DEPLOYMENT_ENVIRONMENT } from '@opentelemetry/semantic-conventions';
import { ZoneContextManager } from '@opentelemetry/context-zone';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { getWebAutoInstrumentations } from '@opentelemetry/auto-instrumentations-web';

export interface BrowserOtelConfig {
  /** Logical service name — e.g. `'admin-ui'`, `'cds-ui'`, `'workflow-ui'`. */
  serviceName: string;
  /** OTLP HTTP endpoint base. Defaults to `NEXT_PUBLIC_OTEL_EXPORTER_OTLP_ENDPOINT`. */
  endpoint?: string;
  /** OneUptime token. Defaults to `NEXT_PUBLIC_ONEUPTIME_TOKEN`. */
  oneuptimeToken?: string;
  /** Deployment environment. Defaults to `NODE_ENV` or `'development'`. */
  environment?: string;
  /**
   * URLs to which the W3C traceparent header should be propagated. Defaults to
   * a match-all regex — set explicitly to lock propagation down to a known
   * list of trusted backends.
   */
  propagateTraceHeaderCorsUrls?: RegExp[];
}

/**
 * Bootstraps OpenTelemetry in the browser.
 *
 * - WebTracerProvider tagged with service.name / service.namespace=health-services
 *   / deployment.environment resource attributes.
 * - OTLP/HTTP trace export to OneUptime at <endpoint>/v1/traces.
 * - Auto-instrumentations for fetch, xhr, document-load, and user-interaction;
 *   every outbound API call gets a span and a W3C traceparent header, so
 *   traces stitch from the browser into the backend audit.inbound log.
 *
 * Idempotent: re-calls (e.g. HMR in dev) are no-ops once initialized. Callers
 * must run BEFORE any application code makes fetch/xhr calls so the
 * auto-instrumentation catches them.
 */
let initialized = false;
export function initBrowserOtel(config: BrowserOtelConfig): void {
  if (initialized) return;
  if (typeof window === 'undefined') return;

  const rawEndpoint = config.endpoint || process.env.NEXT_PUBLIC_OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318';

  const cleanEndpoint = rawEndpoint
    .trim()
    .replace(/\/$/, '')
    .replace(/\/v1\/(traces|logs|metrics)$/, '');

  const headers: Record<string, string> = {};

  const environment =
    config.environment || (typeof process !== 'undefined' ? process.env.NODE_ENV : undefined) || 'development';

  const createResource = (OTelResources as any).resourceFromAttributes || (OTelResources as any).Resource;
  const resourceAttrs = {
    [SEMRESATTRS_SERVICE_NAME]: config.serviceName,
    [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: environment,
    'service.namespace': 'health-services',
  };
  const resource =
    typeof createResource === 'function' && createResource.prototype
      ? new createResource(resourceAttrs)
      : createResource(resourceAttrs);

  const provider = new WebTracerProvider({ resource });
  provider.addSpanProcessor(
    new BatchSpanProcessor(
      new OTLPTraceExporter({
        url: `${cleanEndpoint}/v1/traces`,
        headers,
      }) as any,
    ),
  );
  provider.register({ contextManager: new ZoneContextManager() });

  const propagateTraceHeaderCorsUrls = config.propagateTraceHeaderCorsUrls ?? [/.*/];

  registerInstrumentations({
    instrumentations: [
      getWebAutoInstrumentations({
        '@opentelemetry/instrumentation-fetch': {
          propagateTraceHeaderCorsUrls,
          clearTimingResources: true,
        },
        '@opentelemetry/instrumentation-xml-http-request': { propagateTraceHeaderCorsUrls },
      }),
    ],
  });

  initialized = true;
}

/** Record an exception on the active browser span (used by error boundaries). */
export function recordBrowserException(error: unknown, attrs?: Record<string, string>): void {
  const span = trace.getActiveSpan();
  if (!span) return;
  if (attrs) span.setAttributes(attrs);
  span.recordException(error instanceof Error ? error : new Error(String(error)));
}

export { trace };

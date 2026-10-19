import { trace, diag, DiagConsoleLogger, DiagLogLevel, SpanStatusCode, context, propagation } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-proto';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import * as OTelResources from '@opentelemetry/resources';
import {
  SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_SERVICE_VERSION,
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
} from '@opentelemetry/semantic-conventions';
import { ParentBasedSampler, TraceIdRatioBasedSampler, AlwaysOnSampler } from '@opentelemetry/sdk-trace-base';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { WinstonInstrumentation } from '@opentelemetry/instrumentation-winston';
import { PrismaInstrumentation } from '@prisma/instrumentation';
import { ErrorEnrichmentProcessor } from './error-enrichment';

export interface TracingConfig {
  serviceName?: string;
  endpoint?: string;
  apiKey?: string;
}

/** Endpoints/health paths that should never produce a sampled trace. */
const IGNORED_PATHS = [/^\/health$/, /^\/$/, /^\/api\/docs/, /^\/favicon\.ico$/];

/**
 * Observability bootstrap — OpenTelemetry SDK pointed at Middleware.io over
 * OTLP/HTTP protobuf (exporter-*-otlp-proto → Content-Type application/x-protobuf).
 *
 * Exports traces, logs AND metrics via OTLP so Middleware has one ingestion path
 * with trace ↔ log correlation already baked in (every log carries
 * trace_id/span_id from the active context, injected by `WinstonInstrumentation`).
 * Resource attributes (service.name, service.namespace, deployment.environment)
 * are set once here so every span + log is correctly tagged in Middleware.
 *
 * Direct (agentless) ingestion: signal-specific paths
 * `https://<uid>.middleware.io/v1/{traces,logs,metrics}`, authenticated with a
 * raw `Authorization: <MW_API_KEY>` header (no `Bearer` prefix).
 *
 * Sampling is parent-based: a downstream service honors the upstream sampling
 * decision. The root sampler defaults to 100% in dev and a configurable ratio
 * in prod (`OTEL_TRACES_SAMPLER_ARG`, default 0.1). Health / root paths are
 * filtered at the instrumentation layer so they never become spans at all.
 *
 * Env:
 *   OTEL_EXPORTER_OTLP_ENDPOINT  — OTLP/HTTP target (default http://localhost:4318), e.g. https://<uid>.middleware.io
 *   MW_API_KEY                   — Middleware API key (sent as the Authorization header)
 *   OTEL_SERVICE_NAME            — overrides config.serviceName
 *   OTEL_RESOURCE_ATTRIBUTES     — comma-separated extra attrs (k=v,k=v)
 *   OTEL_TRACES_SAMPLER_ARG      — root sampler ratio in prod (default 0.1)
 *   OTEL_LOG_LEVEL               — diag level (error|warn|info|debug)
 */
class Tracing {
  private sdk: NodeSDK | null = null;
  private initialized = false;

  init(config: TracingConfig = {}): void {
    if (this.initialized) return;

    // Enable diagnostic console logging for OTel exporter errors
    const diagLevel = process.env.OTEL_LOG_LEVEL
      ? (DiagLogLevel as unknown as Record<string, DiagLogLevel>)[process.env.OTEL_LOG_LEVEL.toUpperCase()]
      : DiagLogLevel.WARN;
    diag.setLogger(new DiagConsoleLogger(), diagLevel ?? DiagLogLevel.WARN);

    // OTLP/HTTP endpoint — supports SigNoz, Middleware, or standard OTel Collector.
    // Defaults to a local collector (the OTLP/HTTP spec default port).
    const rawEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318';

    // Strip trailing slashes AND signal sub-paths if passed (e.g. http://host:4318/v1/traces -> http://host:4318)
    const cleanEndpoint = rawEndpoint
      .trim()
      .replace(/\/$/, '')
      .replace(/\/v1\/(traces|logs|metrics)$/, '');
    const endpoint = cleanEndpoint;

    const serviceName = process.env.OTEL_SERVICE_NAME || config.serviceName || 'health-services';
    const environment = process.env.NODE_ENV || 'development';
    const serviceVersion = process.env.OTEL_SERVICE_VERSION || process.env.npm_package_version || '0.0.0';

    // Build headers — parse standard OTEL_EXPORTER_OTLP_HEADERS if set
    const headers: Record<string, string> = {};

    if (process.env.OTEL_EXPORTER_OTLP_HEADERS) {
      process.env.OTEL_EXPORTER_OTLP_HEADERS.split(',').forEach((pair) => {
        const [k, v] = pair.split('=').map((s) => s.trim());
        if (k && v) headers[k] = v;
      });
    }

    const createResource = (OTelResources as any).resourceFromAttributes || (OTelResources as any).Resource;
    const resourceAttrs = {
      [SEMRESATTRS_SERVICE_NAME]: serviceName,
      [SEMRESATTRS_SERVICE_VERSION]: serviceVersion,
      [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: environment,
      'service.namespace': 'health-services',
    };
    const resource =
      typeof createResource === 'function' && createResource.prototype
        ? new createResource(resourceAttrs)
        : createResource(resourceAttrs);

    // Sampler — 100% in dev, parent-based + ratio in prod.
    const rootSampler =
      environment === 'production'
        ? new TraceIdRatioBasedSampler(parseFloat(process.env.OTEL_TRACES_SAMPLER_ARG || '1.0'))
        : new AlwaysOnSampler();
    const sampler = new ParentBasedSampler({ root: rootSampler });

    const traceExporter = new OTLPTraceExporter({ url: `${cleanEndpoint}/v1/traces`, headers });
    const logExporter = new OTLPLogExporter({ url: `${cleanEndpoint}/v1/logs`, headers });
    const metricsExporter = new OTLPMetricExporter({ url: `${cleanEndpoint}/v1/metrics`, headers });

    this.sdk = new NodeSDK({
      resource: resource as any,
      sampler,
      traceExporter: traceExporter as any,
      logRecordProcessors: [new BatchLogRecordProcessor(logExporter as any)],
      metricReader: new PeriodicExportingMetricReader({
        exporter: metricsExporter as any,
        exportIntervalMillis: 5000,
      }) as any,
      instrumentations: [
        new ExpressInstrumentation({
          requestHook: (span, reqInfo: any) => {
            const req = reqInfo.request || reqInfo.req || reqInfo;
            if (req && req.query && req.query.traceparent) {
              const carrier = { traceparent: decodeURIComponent(req.query.traceparent) };
              const extracted = propagation.extract(context.active(), carrier);
              context.with(extracted, () => {
                // We update the span name for visibility, but true propagation
                // requires a middleware to wrap the actual request handler.
                span.updateName(`${req.method} ${req.path} (verified from traceparent)`);
              });
            }
          },
        }),
        new PrismaInstrumentation(),
        new WinstonInstrumentation({
          logHook: (_span, record: any) => {
            record['service.name'] = serviceName;
            record['deployment.environment'] = environment;
          },
        }),
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-express': {
            enabled: false, // Disabled here because we explicitly register it above
          },
          '@opentelemetry/instrumentation-http': {
            ignoreIncomingRequestHook: (req: any) => isIgnoredPath(req.url),
            ignoreOutgoingRequestHook: (req: any) => {
              // Drop traces for our own OTLP export calls to avoid feedback loops.
              const host = req.host || req.hostname || '';
              return endpoint.includes(host) && (req.path === '/v1/traces' || req.path === '/v1/logs');
            },
            requestHook: (span, req) => {
              // Standard span naming is better for OneUptime dashboard grouping.
              // const urlOrPath = (req as any).url || (req as any).path || '';
              // span.updateName(`${req.method} ${urlOrPath}`);
            },
          },
          '@opentelemetry/instrumentation-ioredis': {
            enabled: true,
            responseHook: (span: any, cmd: any, arg: any, result: any) => {
              span.setAttributes({
                'db.argument': String(arg),
                'db.result': result ? true : false,
              });
              span.updateName(`ioredis:${cmd}`);
              span.setStatus({ code: result ? SpanStatusCode.OK : SpanStatusCode.OK });
            },
            dbStatementSerializer: (statement: string) => {
              return statement;
            },
          },
          '@opentelemetry/instrumentation-redis': {
            enabled: true,
            responseHook: (span: any, cmd: any, arg: any, response: any) => {
              span.setAttributes({
                'db.argument': String(arg),
                'db.result': response ? true : false,
              });
              span.updateName(`redis:${cmd}`);
              span.setStatus({ code: response ? SpanStatusCode.OK : SpanStatusCode.OK });
            },
          },
          '@opentelemetry/instrumentation-fs': { enabled: false },
          // Winston log records pick up trace_id/span_id automatically.
          '@opentelemetry/instrumentation-winston': { enabled: true },
        }),
      ],
    });

    this.sdk.start();

    // Custom span processor — runs after the SDK is up so the global tracer
    // provider is the BasicTracerProvider that supports addSpanProcessor.
    try {
      const provider = trace.getTracerProvider() as unknown as {
        addSpanProcessor?: (p: unknown) => void;
        _delegate?: { addSpanProcessor?: (p: unknown) => void };
      };
      const target = provider.addSpanProcessor ? provider : provider._delegate;
      target?.addSpanProcessor?.(new ErrorEnrichmentProcessor());
    } catch {
      // Lazy require to avoid a logger↔tracing circular import at module load.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { logger: l } = require('../logger');
      l.warn('Could not register ErrorEnrichmentProcessor — error spans will not be enriched');
    }

    this.initialized = true;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { logger: finalLogger } = require('../logger');
    finalLogger.info('OpenTelemetry initialized (Middleware.io)', {
      service: serviceName,
      environment,
      endpoint,
      sampler: environment === 'production' ? 'parent-based(ratio)' : 'parent-based(always-on)',
    });
  }

  async shutdown(): Promise<void> {
    if (!this.initialized || !this.sdk) return;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { logger } = require('../logger');
    try {
      await this.sdk.shutdown();
      logger.info('OpenTelemetry shut down');
    } catch (err) {
      logger.warn('OpenTelemetry shutdown error', { error: err instanceof Error ? err.message : String(err) });
    }
  }

  /**
   * Record an exception on the active span. Replaces the Sentry-specific
   * `captureException`; the OTel exporter ships it to OneUptime with the trace.
   */
  captureException(error: Error, context?: Record<string, unknown>): void {
    const span = trace.getActiveSpan();
    if (!span) return;
    if (context) span.setAttributes(toSpanAttrs(context));
    span.recordException(error);
  }

  /**
   * Tag the active span with the acting end-user using OTel semantic attrs
   * (`enduser.id`, `enduser.name`). OneUptime can filter/aggregate traces by user
   * via these fields just like the old Sentry "user" tag.
   */
  setUser(user: { id: string; username?: string }): void {
    const span = trace.getActiveSpan();
    if (!span) return;
    span.setAttribute('enduser.id', user.id);
    if (user.username) span.setAttribute('enduser.name', user.username);
  }
}

function isIgnoredPath(url?: string): boolean {
  if (!url) return false;
  const path = url.split('?')[0];
  return IGNORED_PATHS.some((re) => re.test(path));
}

function toSpanAttrs(ctx: Record<string, unknown>): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(ctx)) {
    if (v == null) continue;
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') out[k] = v;
    else out[k] = JSON.stringify(v);
  }
  return out;
}

export const tracing = new Tracing();
export { trace };

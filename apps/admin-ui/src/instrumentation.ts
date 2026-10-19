/**
 * Next.js server-side instrumentation entrypoint — wires the same OpenTelemetry
 * NodeSDK every backend service uses, so admin-ui server traces (RSC requests,
 * API routes) land in OneUptime with `service.name=admin-ui` and stitch with
 * upstream/downstream services via W3C trace context.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  // Dynamic import so the Node-only OTel SDK is never bundled into edge / browser builds.
  const { tracing, logger } = await import('@hs/observability');
  tracing.init({ serviceName: 'admin-ui' });
  logger.init({ service: 'admin-ui' });
}

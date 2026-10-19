/** Next.js server-side OTel — RSC + API routes → OneUptime as `cds-ui`. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { tracing, logger } = await import('@hs/observability');
  tracing.init({ serviceName: 'cds-ui' });
  logger.init({ service: 'cds-ui' });
}

/** Next.js server-side OTel — RSC + API routes → OneUptime as `workflow-ui`. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { tracing, logger } = await import('@hs/observability');
  tracing.init({ serviceName: 'workflow-ui' });
  logger.init({ service: 'workflow-ui' });
}

/**
 * Small badge showing whether this deployment is `cert` or `prod`.
 * Reads `NEXT_PUBLIC_IS_PROD` at build time (statically inlined by Next.js).
 * Set it alongside the server-side `IS_PROD` var in each deployment's env.
 */

const isProd = process.env.NEXT_PUBLIC_IS_PROD?.toLowerCase() === 'true';

export function DeploymentEnvBadge({ className = '' }: { className?: string }) {
  const color = isProd
    ? 'bg-green-100 text-green-800 border-green-200'
    : 'bg-yellow-100 text-yellow-800 border-yellow-200';
  const label = isProd ? 'PROD' : 'CERT';

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded border uppercase tracking-wide ${color} ${className}`}
      title={
        isProd
          ? 'Production deployment — live EHR endpoints'
          : 'Cert deployment — sandbox EHR endpoints for integration testing'
      }
    >
      <span className={`w-1.5 h-1.5 rounded-full ${isProd ? 'bg-green-500' : 'bg-yellow-500'}`} />
      {label}
    </span>
  );
}

/** True when the admin UI is running in a production deployment. */
export function isProdDeployment(): boolean {
  return isProd;
}

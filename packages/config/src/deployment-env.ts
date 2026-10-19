/**
 * Deployment environment — which physical deployment this process is running in.
 *
 * - `cert`: external partners test/certify their integrations against sandbox EHR endpoints.
 * - `prod`: live production traffic against production EHR endpoints.
 *
 * A deployment is unambiguously ONE of these. The value is derived from `IS_PROD`:
 *   IS_PROD=true  → 'prod'
 *   IS_PROD=false (or unset) → 'cert'
 */

export type DeploymentEnv = 'cert' | 'prod';

let cached: boolean | null = null;

/** True when `IS_PROD=true`; false otherwise (including when unset). */
export function isProdDeployment(): boolean {
  if (cached !== null) return cached;
  cached = process.env.IS_PROD?.toLowerCase() === 'true';
  return cached;
}

/** Named view of the same flag, for labels/logging. */
export function getDeploymentEnv(): DeploymentEnv {
  return isProdDeployment() ? 'prod' : 'cert';
}

/** Test-only escape hatch — resets the cached value. Do not call outside tests. */
export function __resetDeploymentEnvCacheForTests(): void {
  cached = null;
}

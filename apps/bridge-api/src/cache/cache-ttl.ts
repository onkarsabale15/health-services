/**
 * Default server-side cache TTLs (seconds).
 *
 * These are defaults — clients can override FHIR response TTLs via the
 * standard HTTP `Cache-Control: max-age=<seconds>` request header.
 *
 * Non-FHIR caches (config, auth) are internal and not client-controllable.
 */
export const CacheTTL = {
  /** SaaS app EHR config — changes rarely */
  APP_EHR_CONFIG: 300,

  /** Platform JWKS public key — rotated infrequently */
  PLATFORM_JWKS: 3600,

  /** FHIR search results (Bundles) — default if client sends no Cache-Control */
  FHIR_SEARCH: 120,

  /** FHIR individual resource — default if client sends no Cache-Control */
  FHIR_RESOURCE: 300,
} as const;

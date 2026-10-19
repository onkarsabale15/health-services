/**
 * Centralized TTL constants for the Admin API cache layer.
 * All values are in seconds.
 */
export const AdminCacheTTL = {
  /** Default TTL for Prisma query cache */
  DB_QUERY: 300, // 5 minutes

  /** Application JWKS public key cache */
  APP_JWKS: 300, // 5 minutes

  /** Application metadata cache (OAuth token issuance) */
  APP_META: 300, // 5 minutes

  /** Session refresh token lifetime */
  SESSION_REFRESH: 604800, // 7 days

  /** OAuth authorization code lifetime (one-time use) */
  OAUTH_CODE: 60, // 60 seconds

  /** SSO code lifetime (one-time use, short-lived) */
  SSO_CODE: 30, // 30 seconds

  /** Consent ticket lifetime — covers the round-trip to admin-ui consent screen */
  CONSENT_TICKET: 600, // 10 minutes
} as const;

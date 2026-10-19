/**
 * Centralized cache key builders for the Admin API.
 *
 * All keys use ':' as separator for Redis auto-grouping (RedisInsight, SCAN).
 * Pattern-based invalidation uses '*' wildcard with delByPattern().
 *
 * Key hierarchy:
 *   admin:db:{Model}:{action}:{argsHash}   — Prisma query cache (auto-managed)
 *   oauth:revoked:{jti}                    — Revoked OAuth tokens
 *   session:refresh:{token}                — Session refresh tokens
 *   app:jwks:{clientId}                    — Application JWKS cache
 *   app:meta:{clientId}                    — Application metadata cache
 */
export const AdminCacheKeys = {
  // ─── Prisma query cache (managed by prisma-cache extension) ──
  dbQuery: (model: string, action: string, hash: string) => `admin:db:${model}:${action}:${hash}`,

  dbModelPattern: (model: string) => `admin:db:${model}:*`,

  // ─── OAuth token management ──────────────────────────────────
  oauthRevoked: (jti: string) => `oauth:revoked:${jti}`,
  oauthCode: (code: string) => `oauth:code:${code}`,

  // ─── Session management ──────────────────────────────────────
  sessionRefresh: (token: string) => `session:refresh:${token}`,
  ssoCode: (code: string) => `sso:code:${code}`,
  consentTicket: (token: string) => `oauth:consent:${token}`,

  // ─── Application JWKS + metadata ────────────────────────────
  appJwks: (clientId: string) => `app:jwks:${clientId}`,
  appMeta: (clientId: string) => `app:meta:${clientId}`,

  // ─── Invalidation patterns ──────────────────────────────────
  appJwksPattern: 'app:jwks:*',
  appMetaPattern: 'app:meta:*',
} as const;

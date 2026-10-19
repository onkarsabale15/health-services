# Security Rules

## Authentication

- **JWT verification happens once per request** in the auth guard — never in controllers or services.
- Session tokens use `token_type: 'session'`. API tokens use `token_type: 'api'`. Never mix.
- Refresh tokens are consumed atomically via `cache.getdel()` — prevents replay attacks.
- JWKS public keys are cached (in-memory → Redis → Secrets Manager) — never fetched from remote on every request.
- API keys are validated against secrets store, never hardcoded.
- Token expiry is checked during verification — expired tokens are rejected.
- Algorithm must be explicitly specified (`RS384`) — never rely on `alg` header from untrusted JWT.

## Authorization

- **Tenant isolation is mandatory.** Every query that returns user data MUST include `organizationId` in the WHERE clause.
- Role checks use `@Roles()` decorator + `RolesGuard` — never inline `if (user.role === 'ADMIN')` in controllers.
- Scope enforcement (FHIR scopes) is done in `ScopeGuard`, not in controllers.
- Access level checks (`FULL`, `READONLY`) must be enforced before data modification.
- EHR-level scope validation: check `user.ehrAccess[connectionData.ehrName]` for per-EHR permissions.
- OWNER role can do everything. ADMIN can manage apps/users. VIEWER can only read. Enforce at guard level.

## Input Validation

- **All external input must be validated before use.**
  - NestJS: class-validator DTOs with `@IsString()`, `@IsEnum()`, `@IsOptional()`, etc.
  - Pure TypeScript: Zod schemas with runtime validation.
- Never trust `req.body`, `req.params`, or `req.query` without validation.
- URL inputs (JWKS URIs, callback URLs) must be validated:
  - HTTPS only (no HTTP)
  - No private IPs (SSRF protection): block `10.x`, `172.16-31.x`, `192.168.x`, `127.x`, `169.254.x`
  - No redirects (follow: false)
  - Timeout: 5 seconds max
- File uploads must be validated: type whitelist, size limit, content scanning.
- UUIDs in path params must be validated format before DB query.

## Output Safety

- **Never leak internal errors to clients.**
  - Guards throw `UnauthorizedException` / `ForbiddenException` with generic messages.
  - Never include stack traces, SQL errors, or internal paths in responses.
- Error messages for auth failures must be vague: `'Invalid or expired token'`, never `'Token expired at timestamp'` or `'User not found in org X'`.
- FHIR OperationOutcome responses go through `GlobalExceptionFilter` — never return raw errors.
- OAuth introspect/revoke must NOT leak info per RFC 7009 — always return `{active: false}` or `{}`.
- Never return internal IDs, database column names, or infrastructure details in error responses.

## Secrets Management

- **Zero secrets in code.** All secrets come from Doppler (dev/staging) or AWS Secrets Manager (production).
- `.env` files are in `.gitignore` — never committed to git.
- JWK private keys are stored in secrets manager, never in DB or Redis.
- Log statements must NEVER include: tokens, passwords, secret keys, PHI.
- `console.log` is BANNED in production code. Use `logger.debug()` with sanitized fields.
- Secret names follow convention: `HS_PLATFORM_JWKS`, `HS_BRIDGE_APIKEY_DEV`.
- Secrets are loaded at application startup and cached — not fetched per-request.

## Rate Limiting

- Identity-based rate limiting: bucket by `userId` > `clientId` > `email` > `IP` (in that priority order).
- Centralized via Redis (`RedisThrottleStorage`) — rate limits apply across all service instances.
- Rate limit tiers:

  | Endpoint Type | Limit | Bucket Key |
  |--------------|-------|------------|
  | Auth (signin, signup) | 5/min | email |
  | Auth (refresh) | 30/min | IP |
  | OAuth (token) | 60/min | clientId |
  | OAuth (introspect) | 300/min | clientId |
  | FHIR (bridge-api) | 600/min | clientId |
  | Burst protection | 10-20/s | IP |

- Blocked clients get `throttle:blocked:{key}` flag with configurable lockout duration.
- Rate limit headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `Retry-After`) should be included in responses.

## HIPAA / Healthcare Compliance

- **No PHI in logs.** Log patient IDs (FHIR resource IDs) but never patient names, SSNs, DOBs, addresses, phone numbers.
- **No PHI in cache keys.** Cache keys use opaque IDs: `app:{clientId}:ehr:{ehrName}:Patient:{id}`.
- **No PHI in error messages.** Errors reference resource IDs, never resource content.
- **Audit trail:** Log who accessed what (userId/clientId, resourceType, action, timestamp) — without the resource content.
- Connection data (EHR access tokens) has TTL and auto-expires — no indefinite storage of credentials.
- All EHR communication is over HTTPS/TLS — enforced in `@hs/http-client`.
- Data at rest: PostgreSQL (Aiven) provides encryption at rest. Redis (Aiven Valkey) provides encryption in transit.
- Minimum necessary: only request FHIR scopes that the application needs, not blanket `*.read`.

## CORS

- Admin API: only allows `ADMIN_UI_URL` origin.
- Bridge API: allows configured origins for SMART launch consumers.
- Never use `Access-Control-Allow-Origin: *` in production.
- Credentials: `Access-Control-Allow-Credentials: true` only for admin-ui.

## Headers

- `Helmet` middleware for security headers (X-Frame-Options, X-Content-Type-Options, etc.).
- `Content-Type: application/fhir+json; charset=utf-8` for all FHIR responses.
- Remove `X-Powered-By` header (NestJS default).

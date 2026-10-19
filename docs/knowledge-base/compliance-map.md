# Compliance & Security Map

## HIPAA Safeguards

| Safeguard | Implementation | Status |
|-----------|---------------|--------|
| **No PHI in logs** | Structured logging with explicit fields (IDs only, never names/SSN/DOB) | Enforced via `@hs/logger` |
| **No PHI in cache keys** | Opaque IDs: `app:{clientId}:ehr:{ehrName}:Patient:{id}` | Enforced in `cache-keys.ts` |
| **No PHI in errors** | `GlobalExceptionFilter` returns generic messages; full error logged server-side | Enforced |
| **Audit trail** | `AuditInterceptor` logs actor, resource, action, timestamp (no request/response bodies) | admin-api |
| **Encryption in transit** | HTTPS/TLS for all EHR communication (`@hs/http-client`) | Enforced |
| **Encryption at rest** | PostgreSQL (Aiven) + Redis (Aiven Valkey) encryption at rest | Infrastructure |
| **Access control** | Role-based (OWNER/ADMIN/MEMBER) + FHIR scope-based | Guards |
| **Minimum necessary** | Per-app FHIR scopes — not blanket `*.read` | ScopeGuard |
| **Session expiry** | Connection TTL 20-30min, refresh token 7 days, SSO code 30s | Redis TTL |

## Authentication & Authorization

| Layer | Mechanism | Details |
|-------|-----------|---------|
| **JWT signing** | RS384 (asymmetric) | Platform JWKS rotated, cached 1hr |
| **Token types** | Session (`token_type: 'session'`) vs API (`token_type: 'api'`) | Never interchangeable |
| **PKCE** | S256 code_challenge | All browser OAuth flows |
| **Refresh rotation** | Single-use via `cache.getdel()` | Atomic, prevents replay |
| **SSO codes** | Opaque hex, 30s TTL, one-time | Never JWT in URLs |
| **Tenant isolation** | Every query includes `organizationId` | Enforced in all controllers |
| **API key auth** | Validated against secrets store | Legacy bridge-api access |
| **Internal service JWT** | Self-signed RS384 with `internal: true` claim | bridge-api → admin-api, skips org boundaries |
| **Site approval** | SMART auto-created sites start `isApproved: false`, admin must approve | Rate-limited to 5 pending/integration |

## Rate Limiting

| Protection | Implementation |
|-----------|---------------|
| Identity-based buckets | userId > clientId > email > IP (priority order) |
| Centralized storage | Redis (`RedisThrottleStorage`) — applies across instances |
| Burst protection | Per-second per-IP limits (10-20/s) |
| Blocked client flag | `throttle:blocked:{key}` with lockout duration |
| Per-endpoint tiers | Auth: 5/min, FHIR: 600/min, OAuth introspect: 300/min |

## Input Validation

| Surface | Validation |
|---------|-----------|
| Request bodies | class-validator DTOs (`ValidationPipe`, `whitelist: true`) |
| URL parameters | UUID format validation |
| JWKS URIs | HTTPS only, no private IPs (SSRF), no redirects, 5s timeout |
| Redirect URIs | Whitelisted against registered origins |
| Return URLs | Origin checked against trusted servers |
| File uploads | Type whitelist, size limit |

## Output Safety

| Rule | Implementation |
|------|---------------|
| No stack traces in responses | `GlobalExceptionFilter` sanitizes |
| Generic auth errors | `'Invalid or expired token'` (never specific) |
| FHIR OperationOutcome | All bridge-api errors mapped to standard format |
| OAuth RFC compliance | Introspect returns `{active: false}`, revoke always 200 |
| No internal IDs exposed | Resource IDs are opaque FHIR IDs |

## Secrets Management

| Rule | Implementation |
|------|---------------|
| Zero secrets in code | Doppler (dev/staging), AWS Secrets Manager (prod) |
| `.env` in `.gitignore` | Never committed |
| JWK private keys | Secrets Manager only — never DB or Redis |
| No console.log | `@hs/logger` enforced; ESLint `no-console` |
| Loaded at startup | Cached in-memory, not fetched per-request |

## Security Headers

| App | Headers |
|-----|---------|
| admin-api | Helmet (CSP, X-Frame-Options, X-Content-Type-Options), CORS: admin-ui + workflow-ui only |
| bridge-api | Helmet, CORS: configured origins, FHIR Content-Type |
| admin-ui | CSP frame-ancestors: self + workflow-ui, X-Content-Type-Options, Referrer-Policy |
| workflow-ui | X-Frame-Options: DENY, CSP frame-ancestors: none |

## OAuth / SSO Security

| Control | Implementation |
|---------|---------------|
| Redirect URI validation | Whitelist check against configured + DB origins |
| Authorization code | Opaque hex, 60s TTL, one-time use (`cache.getdel()`) |
| PKCE required | S256 code_challenge_method for all browser flows |
| Token introspection | Client auth required (RFC 7662) |
| Token revocation | Client auth required (RFC 7009), always HTTP 200 |
| Sign-out | Server-side revoke before clearing local state |
| Cross-app SSO | Opaque code (30s), not JWT — never tokens in URLs |

## FHIR Compliance

| Requirement | Implementation |
|-------------|---------------|
| Content-Type | `application/fhir+json; charset=utf-8` |
| Error format | OperationOutcome with severity, code, details |
| Search results | Bundle with `type: 'searchset'` |
| Pagination links | Rewritten from EHR URLs to Bridge URLs |
| R4 path pattern | `/fhir/r4/v1/{ResourceType}[/:id]` |
| Scope format | `{resource}.{action}` (e.g., `Patient.read`) |

## Terminology / Code Systems

| System | URI | Source |
|--------|-----|--------|
| SNOMED CT | `http://snomed.info/sct` | Snowstorm API → PostgreSQL (`icd_snomed_mappings`) |
| ICD-10-CM | `http://hl7.org/fhir/sid/icd-10-cm` | Cross-mapped from SNOMED via Refset 447562003 |

- `terminology-sync` CLI (ECS task) batch-syncs SNOMED→ICD-10 mappings from Snowstorm into PostgreSQL
- Bridge `/terminology/search` and `/terminology/lookup` endpoints serve concepts with cross-mappings
- `FhirCodingEnricher` (cds-app) auto-appends missing cross-coded codings before FHIR writes

# Caching Rules

## Cache Key Standards

- **Namespace with colons:** `{domain}:{scope}:{identifier}` — enables Redis key grouping (RedisInsight auto-groups by `:`) and pattern-based deletion via SCAN.
- **Key patterns in use:**
  ```
  app:{clientId}:ehr:{ehrName}:config              → EHR config
  app:{clientId}:ehr:{ehrName}:{ResourceType}:{id} → FHIR resource
  app:{clientId}:ehr:{ehrName}:{ResourceType}:search:{hash} → FHIR search
  app:jwks:{clientId}                              → Application JWKS
  app:meta:{clientId}                              → Application metadata
  platform:jwks:public                             → Platform JWKS public key
  session:refresh:{token}                          → Refresh token session
  oauth:revoked:{jti}                              → Revoked OAuth token
  throttle:{identity}                              → Rate limit counter
  throttle:blocked:{identity}                      → Rate limit block flag
  smart:state:{state}                              → SMART launch state
  smart:code:{code}                                → SMART one-time code
  cds:session:{sessionId}                          → CDS session
  cds:result:{sessionId}                           → CDS analysis result
  cds:rules:{applicationId}                        → CDS rules cache
  admin:db:{model}:{action}:{hash}                 → Prisma query cache
  ```
- **Never use user-supplied values directly in keys** — validate or hash first.
- Cache key builders live in `apps/*/src/cache/cache-keys.ts` — centralized per app.

## TTL Rules

- **Every cache entry MUST have a TTL.** No infinite caches. No `cache.set(key, value)` without the third parameter.
- TTL guidelines:

  | Data Type | TTL | Rationale |
  |-----------|-----|-----------|
  | Config/metadata | 5-10 min | Changes infrequently, brief staleness ok |
  | FHIR resource (by ID) | 5 min | Client-overridable via Cache-Control |
  | FHIR search (Bundle) | 2 min | Shorter — search results change more often |
  | Platform JWKS | 1 hour | Keys rotate rarely |
  | App JWKS | 5 min | Matches config cache |
  | Connection/session | 20-30 min | Active user session lifetime |
  | Refresh token | 7 days | Matches token expiry |
  | SMART state | 5 min | Security — minimize attack window |
  | SMART code | 2 min | One-time use, short-lived |
  | Rate limit counter | Window size | Matches throttle window (1s or 60s) |
  | Prisma query cache | 5 min | DB query result freshness |

- TTL constants live in `apps/*/src/cache/cache-ttl.ts` — centralized per app.

## Invalidation Rules

- **Write-through invalidation:** On DB write (create, update, delete), invalidate related cache entries immediately.
- **Pattern-based invalidation:** Use `cache.delByPattern()` (SCAN-based) for bulk invalidation:
  - `admin:db:Application:*` → invalidate all Application query caches
  - `app:{clientId}:*` → invalidate all cache for an app
- **Related model invalidation:** When a child model changes, also invalidate parent caches:
  ```
  AppEhrAccess changes → invalidate Application cache
  UserAppAccess changes → invalidate User + Application cache
  ```
- **Cross-layer invalidation:** When Application is updated, also invalidate:
  - `app:meta:{clientId}` (OAuth metadata cache)
  - `app:jwks:{clientId}` (JWKS cache)
- **Cache failures are non-fatal.** Use `.catch(() => {})` for cache writes/deletes — never let cache errors break the main request flow.
- **Read-through on miss:** If cache miss, fetch from DB/source, store in cache, return result.

## Client Cache Control (FHIR only)

- **FHIR caching is opt-in.** No caching by default — every request goes to the EHR unless the client explicitly requests caching via `Cache-Control` headers.
- Supported client request headers:
  - `Cache-Control: max-age=N` → cache response for up to N seconds (opt-in)
  - `Cache-Control: no-cache` → bypass existing cache, fetch fresh from EHR, store result
  - `Cache-Control: no-store` → bypass cache AND don't store the response
  - `(no header)` → **no caching** — always fetch from EHR (default)
  - `If-None-Match: "<etag>"` → return 304 Not Modified if unchanged
- Response headers set by FhirCacheInterceptor:
  - `Cache-Control: max-age=<ttl>` — remaining TTL
  - `ETag: "<hash>"` — content hash for conditional requests
  - `X-Cache: HIT` or `X-Cache: MISS` — cache status indicator
- Non-FHIR caches are internal and NOT client-controllable.

## Multi-tier Caching

- For **frequently accessed, rarely changing data** (JWKS, EHR definitions):
  ```
  In-memory (instant) → Redis (fast, shared) → Source (Secrets Manager / DB)
  ```
- For **per-request data** (FHIR resources, search results):
  ```
  Redis only (shared across instances, no stale in-memory data)
  ```
- For **computed data** (Prisma query results):
  ```
  Redis with content-hash key (automatic deduplication)
  ```
- Cache keys scoped by **auth identity** (`request.user.clientId`), NEVER by EHR credentials — prevents cache poisoning across tenants.

## Anti-Patterns

| Anti-pattern | Correct Approach |
|-------------|-----------------|
| `cache.set(key, value)` without TTL | Always pass TTL: `cache.set(key, value, ttlSeconds)` |
| `KEYS *` in production | Use `cache.delByPattern()` (SCAN-based) |
| Cache key with PHI | Use opaque IDs only |
| In-memory cache for per-request data | Use Redis (shared across instances) |
| Throwing on cache failure | `.catch(() => {})` — cache is best-effort |
| Caching in domain packages | Cache at the application layer only |

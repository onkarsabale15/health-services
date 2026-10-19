# Performance Rules

## Backend

### Database
- **No N+1 queries.** Use Prisma `include` for related data, or batch with `Promise.all`.
- **Paginate all list endpoints.** Default page size: 50, max: 200.
- **Use `select` for list queries** — fetch only the fields needed for the response.
- **Index before querying.** Every `findMany` WHERE clause must have a matching `@@index`.
- **Use `findFirst` over `findUnique` when filtering by non-unique fields** — Prisma optimizes differently.
- **Avoid `count` + `findMany` separately** — use a single query or transaction if both are needed.

### Caching
- **Cache hot paths:** Config, JWKS, app metadata — anything fetched on every request.
- **Read-through pattern:** Check cache → miss → fetch from source → store in cache → return.
- **Write-through invalidation:** On mutation, invalidate related cache entries immediately.
- **Multi-tier for rarely-changing data:** In-memory → Redis → Source (e.g., JWKS).
- **Short TTLs by default.** 2-10 minutes. Better brief staleness than memory pressure.

### HTTP
- **Set timeouts on all outbound HTTP calls:**
  - HTTP client default: 30s
  - JWKS fetch: 5s
  - EHR token exchange: 10s
  - SMART callback: 10s
- **Compress responses.** Enable gzip/brotli for FHIR Bundle responses (can be 100KB+).
- **Connection keep-alive** — reuse TCP connections for EHR API calls (Axios default).

### Async Processing
- **Use `Promise.all()` for independent parallel operations:**
  ```typescript
  // Good — parallel
  const [app, users, ehr] = await Promise.all([
    prisma.application.findFirst({ where }),
    prisma.user.findMany({ where }),
    prisma.appEhrAccess.findMany({ where }),
  ]);

  // Bad — sequential
  const app = await prisma.application.findFirst({ where });
  const users = await prisma.user.findMany({ where });
  const ehr = await prisma.appEhrAccess.findMany({ where });
  ```
- **Never `await` in a loop** for independent iterations — use `Promise.all(items.map(...))`.
- **Fire-and-forget only for non-critical ops** (cache cleanup, metrics) — always `await` state-critical operations.

### Rate Limiting
- Identity-based (userId/clientId) prevents legitimate multi-tenant traffic from being blocked.
- Redis-backed (`RedisThrottleStorage`) ensures limits apply across all instances.
- Burst protection (per-second per-IP) prevents sudden spikes from any single source.

## Frontend

### API Calls
- **Minimize API calls.** Use composite endpoints (e.g., `/applications/:id/detail`) for initial page loads.
- **Local state mutations.** After POST/PATCH/DELETE, update local state — don't refetch the entire list.
- **Batch parallel calls.** `Promise.all([api.get('/a'), api.get('/b')])` for independent data.
- **Debounce search inputs** (300ms) before triggering API calls.

### Rendering
- **No unnecessary re-renders.** Use `useMemo` for derived data, `useCallback` for handlers passed as props.
- **Split large components.** Pages over 300 lines should be broken into sub-components.
- **Lazy load heavy sections** only if needed (Next.js dynamic imports).
- **Use Next.js `<Image>` component** for optimized image loading.

### Bundle Size
- **No large client-side libraries** without justification. `@hs/config` is the only workspace dep in admin-ui.
- **Tree-shake imports:** `import { specific } from 'lib'`, not `import * as lib from 'lib'`.
- Check bundle analysis periodically with `next build` output.

## Redis

### Command Optimization
- **Pipeline related operations.** Use `pipeline()` for multiple reads/writes in one round-trip:
  ```typescript
  const pipeline = redis.pipeline();
  pipeline.get(key1);
  pipeline.expire(key1, ttl);
  const results = await pipeline.exec();
  ```
- **SCAN, not KEYS.** `delByPattern` uses SCAN with COUNT 100 — never use `KEYS *` in production (blocks Redis).
- **Lua for atomicity.** `INCR + EXPIRE` in one script (zero race condition):
  ```lua
  local n = redis.call('INCR', KEYS[1])
  if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
  return n
  ```

### Memory Management
- **Short TTLs by default.** 2-10 minutes for most caches.
- **No unbounded key growth.** Every key has a TTL. Monitor key count.
- **Use JSON serialization** (`JSON.stringify`/`JSON.parse`) for structured data — compact and fast.
- **Key naming with `:` separator** — enables RedisInsight grouping and SCAN MATCH patterns.

### Connection
- **lazyConnect: true** — don't block app startup if Redis is slow.
- **Graceful degradation** — if Redis is down, app should still work (without caching).
- **Health check:** `cache.isHealthy()` via PING in `/health` endpoint.

## Benchmarks (Expected Ranges)

| Operation | Expected Latency |
|-----------|-----------------|
| Redis GET/SET | < 1ms |
| Redis SCAN (100 keys) | < 5ms |
| Prisma findFirst (indexed) | < 5ms |
| Prisma findMany (indexed, 50 records) | < 20ms |
| JWKS verification (cached key) | < 2ms |
| EHR token exchange | 200-2000ms (external) |
| FHIR resource fetch (EHR) | 100-5000ms (external) |
| Full request (cached FHIR) | < 10ms |
| Full request (uncached FHIR) | 200-5000ms |

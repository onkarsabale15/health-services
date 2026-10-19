# Observability Rules (Logging, Tracing, Monitoring)

## Structured Logging

### Logger Usage
- Use `@hs/logger` everywhere — **never** `console.log`, `console.error`, or `console.warn`.
- Import: `import { logger } from '@hs/logger'`.
- Initialize in `main.ts`: `logger.init({ service: 'admin-api' })`.

### Log Levels

| Level | When to Use | Example |
|-------|-------------|---------|
| `error` | Unexpected failure, possible bug, needs investigation (5xx, network errors, unhandled exceptions) | `logger.error('Token verification failed', error, { path })` |
| `warn` | Expected/handled failure (4xx from EHR, rate limit hit, cache miss, auth rejection) | `logger.warn('EHR request failed', { ehrName, url, status: 404 })` |
| `info` | Significant business events | `logger.info('Connection created', { connectionId, ehrName, durationMs })` |
| `debug` | Diagnostic detail (dev/staging only) | `logger.debug('FHIR cache hit', { key, ttlRemaining })` |

**HTTP status → log level mapping:**
- 2xx/3xx → `info` (or `debug` for verbose detail)
- 4xx → `warn` (expected: client error, EHR not-found, bad request, auth rejection)
- 5xx → `error` (unexpected: server bug, EHR outage, infrastructure failure)

### Structured Context
Always include relevant context as the last parameter:
```typescript
// Good — structured, searchable
logger.info('Application created', { appId, orgId, clientId, appType });
logger.error('EHR token exchange failed', error, { ehrName, clientId, statusCode: err.status });

// Bad — unstructured, unsearchable
logger.info(`Created app ${appId} for org ${orgId}`);
logger.error('Something failed: ' + err.message);
```

### What to Log

| Event | Level | Context Fields |
|-------|-------|---------------|
| Request completed | `info` | method, url, status, durationMs |
| Connection created | `info` | connectionId, ehrName, clientId |
| Token refreshed | `info` | connectionId, ehrName |
| Cache invalidation | `debug` | pattern, deletedCount |
| Rate limit hit | `warn` | identity, limit, window |
| Auth failure | `warn` | path, reason (generic) |
| DB query error | `error` | model, action, error |
| EHR API error (4xx) | `warn` | ehrName, endpoint, statusCode |
| EHR API error (5xx) | `error` | ehrName, endpoint, statusCode, error |
| Unhandled exception | `error` | path, method, error |

## What NOT to Log

**NEVER log any of these — they are security and compliance violations:**

- Access tokens, refresh tokens, API keys, secret values
- Passwords (plain or hashed)
- Patient names, SSNs, DOBs, addresses, phone numbers (PHI)
- Full request bodies (may contain PHI)
- Full response bodies from EHR APIs (contain PHI)
- Full JWT payloads (contain claims)
- Full stack traces in client-facing responses (log server-side only)
- Database connection strings
- Redis URLs with credentials

**Safe to log:**
- Resource IDs (Patient/123, not patient name)
- Client IDs, organization IDs, user IDs
- Request method, path, status code, duration
- EHR name, resource type, action
- Cache key names (already use opaque IDs)
- Error messages (generic, not internal details)

## Request Tracing

### RequestTimingMiddleware
Every app (`admin-api`, `bridge-api`, `cds-app`) registers `RequestTimingMiddleware`:
```typescript
logger.info('Request completed', {
  method: req.method,
  url: req.originalUrl,
  status: res.statusCode,
  durationMs: Number(process.hrtime.bigint() - start) / 1_000_000,
});
```

### Sentry Integration
- `@hs/tracing` wraps Sentry for error tracking.
- Initialize in `main.ts`: `tracing.init({ serviceName: 'bridge-api' })`.
- Captures unhandled exceptions automatically.
- Performance transactions for request tracing.
- Environment: `SENTRY_DSN` + `SENTRY_ENVIRONMENT`.

### Distributed Tracing
- OpenTelemetry auto-instrumentation traces HTTP calls across services.
- CDS app → Bridge API calls get correlated trace IDs.
- EHR API calls traced for latency analysis.

## Health Checks

Every app exposes `GET /health` with:
- Database connectivity (`db.isHealthy()` → Prisma `$queryRaw`)
- Redis connectivity (`cache.isHealthy()` → Redis PING)
- Response format: NestJS Terminus (`status: 'ok'` or `status: 'error'` with details)

## Alerting Guidelines

| Condition | Severity | Action |
|-----------|----------|--------|
| Health check fails | Critical | Page on-call |
| Error rate > 5% for 5min | High | Alert team |
| P95 latency > 5s for 10min | Medium | Investigate |
| Rate limit triggers > 100/min | Low | Review limits |
| Cache hit rate < 50% | Low | Investigate keys/TTL |

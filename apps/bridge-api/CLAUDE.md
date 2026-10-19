# bridge-api — Hot-Zone Notes for AI

## What this app is

The FHIR R4 translation gateway. Every clinical app talks to bridge; bridge translates to vendor-specific calls and back. Bridge is the **single gateway** to EHRs — no app talks to EHRs directly.

## Module map (only what matters for new work)

| Module | Purpose |
|---|---|
| `modules/auth/` | Dual auth (platform JWT or API key); `DualAuthGuard` is global |
| `modules/smart-launch/` | SMART on FHIR launch flow; `extractProviderFromIdToken()` normalizes `fhirUser` claim to `<ResourceType>/<id>` |
| `modules/fhir/` | FHIR R4 read/write controllers per resource; `ConnectionDataInterceptor` resolves session → connection |
| `modules/terminology/` | Terminology lookups (proxies to ehr-data-service vendor adapters); `SYSTEM_URIS` is canonical map |
| `services/{vendor}/` | Vendor data services (Cerner, Epic, Athena, drchrono, etc.); thin wrappers over `@hs/ehr-data-service` |
| `interceptors/` | Cache, response shaping, FHIR Content-Type handling |

## Auth model (Dual)

| Token type | Used by | Header | Sets `request.user` |
|---|---|---|---|
| Platform JWT (`token_type: 'api'`) | cds-app, workflow-app, partner apps | `Authorization: Bearer ...` | yes |
| API key | Internal services, bulk-import jobs | `X-API-Key: ...` | yes |

Guard order: `ThrottlerGuard` → `DualAuthGuard` (global) → `RolesGuard` (skipped if no `@Roles`) → `ScopeGuard` (skipped for API keys).

## FHIR cache (opt-in by client)

- Default: no caching, always hit the EHR.
- `Cache-Control: max-age=N` from client → cache for N seconds.
- `Cache-Control: no-cache` → bypass + refresh.
- `Cache-Control: no-store` → bypass + don't store.
- `If-None-Match` returns 304 if matched.
- Cache keys: `app:{clientId}:ehr:{ehrName}:{ResourceType}:{id}` — scoped by **auth identity**, never by EHR creds (prevents cross-tenant poisoning).
- On writes: bridge invalidates via SCAN-based `delByPattern`.

## SMART launch flow (high level)

1. EHR redirects user to `bridge/smart/launch?iss=...&launch=...`
2. Bridge starts OAuth: PKCE, state, redirect to EHR's authorize endpoint
3. Callback: exchange code → access_token + id_token + patient/encounter context
4. Bridge calls admin-api identity resolver: `(ehrName, fhirUser, email) → EndUserId` + access check
5. Bridge issues JWE (encrypted launch token) with patient/encounter/scope/providerFhirId/providerName/endUserId
6. Redirect to cds-app (or other SMART consumer); cds-app decrypts JWE in `launch.controller.ts`

## When adding a new vendor (EHR)

1. Add vendor adapter in `packages/ehr-data-service/src/vendors/{vendor}/`
2. Add bridge-side service in `apps/bridge-api/src/services/{vendor}/{vendor}-data.service.ts`
3. Register in `EhrFactoryService`
4. Add to `EhrName` enum in `@hs/config`
5. **Crucial:** verify FHIR R4 PUT validator gotchas — especially around `note`, `category`, `clinicalStatus`, `If-Match`. See `apps/bridge-api/src/services/cerner/cerner-data.service.ts` for the full set of Cerner-specific behaviors as a template.
6. Add cds-app provider class declaring capabilities (see `apps/cds-app/CLAUDE.md`)

## Common gotchas

- **Cerner / Epic / Athena have different FHIR ID semantics** (Athena has 3 ID forms — enterprise, FHIR, department-scoped). Bridge normalizes outbound; preserve the inbound shape on reads.
- **Cerner returns 200 on PUTs that silently discarded fields.** Validate with refetch when persistence matters.
- **`If-Match` is required on Cerner PUT** for Condition. `@IfMatch()` decorator extracts it; `WriteOptions.ifMatch` carries through.
- **JWE payload size limit is real.** Don't add new fields without checking against EHR redirect URL length limits.

## Observability

- `RequestTimingMiddleware` on all routes (every app has this; nothing app-specific to do).
- Sentry via `@hs/observability tracing.init()`.
- Structured `logger.info('Request completed', {...})` on every request.
- **NEVER log:** access tokens, refresh tokens, JWT contents, full FHIR bodies, patient names, SSNs, DOBs.

## Health

`GET /health` is a **liveness** probe: it only fails (503) when bridge-api's OWN infra is down (DB + Redis). Downstream dependencies (admin-api) are probed best-effort and reported under `dependencies` + `degraded` — they never fail the check, so a peer outage can't cascade into bridge-api being restarted. Add new **own-infra** to the Terminus array; add new **downstream peers** as degraded-only dependencies.

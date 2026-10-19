# Coding Patterns & Conventions

## Architecture Patterns

| Pattern | Where Used | Example |
|---------|-----------|---------|
| Singleton + lazy init | Infrastructure packages | `cache.init()` → lazy on first use |
| Factory + registry | EHR vendors, LLM providers | `ehrFactory.register('epic', epicService)` |
| Base class + inheritance | EHR vendor services | All extend `BaseEhrService` |
| DIP (dependency injection) | CDS engine, workflow engine | FHIR tools injected as functions, not imported |
| Strategy | Auth guards, LLM providers | `DualAuthGuard` delegates to JWT or API key strategy |
| Read-through cache | Config, JWKS, FHIR | Check cache → miss → fetch → store → return |
| Write-through invalidation | Prisma cache extension | On mutation → invalidate related keys |
| Generated clients | SDK | `@hs/bridge-client` (OpenAPI from bridge-api); admin-ui generates client inline (no `@hs/admin-sdk`) |
| Standard bootstrap | All backend apps | `bootstrapNestApp()` from `@hs/bootstrap` — single entry point for NestJS startup |
| DAG executor | Workflows | Topological sort → parallel node execution |
| ReAct agent | CDS | LangChain agent with FHIR tools |

## NestJS Conventions
- **Guard order:** ThrottlerGuard → AuthGuard → RolesGuard → ScopeGuard
- **Interceptor order:** IntegrationDataInterceptor → FhirCacheInterceptor → FhirResponseInterceptor (global)
- **Controller:** thin HTTP layer — delegates to service for business logic
- **Module per feature:** auth, oauth, application, user, organization, ehr-config, workflow, health, terminology
- **Global prefix:** `/api` (excluded: `/`, `/health`, `/.well-known/*`, `/oauth/*`)
- **Terminology provider pattern:** `ITerminologyProvider` interface with DI token array injection — new code system = new provider class + one-line module registration (OCP)

## Cache Patterns
- Key format: `{domain}:{scope}:{identifier}` (colon-separated)
- Every `cache.set()` has explicit TTL — no infinite caches
- Cache failures: `.catch(() => {})` — non-fatal, never break request flow
- Invalidation: pattern-based via SCAN (`cache.delByPattern()`)
- FHIR caching: opt-in via client `Cache-Control` header — no cache by default

## Token & Auth Patterns
- Session JWT (admin-ui) vs API JWT (bridge consumers) — never interchangeable
- Refresh tokens: single-use via atomic `cache.getdel()` — prevents replay
- SSO codes: opaque hex, 30s TTL, one-time use — never JWTs in URLs
- PKCE S256 for browser-based OAuth flows
- Distributed token refresh lock via `cache.setNx()`

## Internal Service Auth Pattern
- Internal services (bridge-api, workflow-executor) self-sign JWTs using shared platform JWKS with `internal: true` claim
- `InternalOrAuthGuard` detects internal tokens → skips org boundary checks
- No separate API keys needed — uses same RS384 signing infrastructure
- `AdminClientService` in bridge-api wraps typed HTTP calls to admin-api with auto-signed internal JWT

## Site Approval Workflow
- SMART launch auto-creates sites as `isApproved: false` when ISS matches an EHR vendor but no site exists
- Rate-limited to 5 pending sites per integration (prevents spam)
- Unapproved sites cannot be used for FHIR calls — admin must approve first
- Admin UI shows pending sites banner on application detail page

## JWE Launch Tokens (SMART)
- SMART callback returns JWE-encrypted launch tokens (not opaque Redis codes)
- Asymmetric encryption for JWKS apps (app's public key), symmetric for client-secret apps
- Public apps get opaque `session_id` (Redis-backed) instead of JWE

## FHIR Mapper Pattern
- Mixin-based mapper classes **removed** — resource mapper classes now use `@medplum/fhirtypes` directly for type safety
- FHIR write DTOs moved from `apps/bridge-api/src/dto/` to `apps/bridge-api/src/modules/fhir/dto/` (collocated with controllers)
- `IEhrService` write methods accept `any` (not typed FHIR resources) — bridge-api DTOs validate input, ehr-data-service is a dumb pass-through

## Clinical Write Pattern (CDS)
- `ConditionBodyBuilder` assembles full FHIR Condition body from lean domain DTO — client never touches FHIR URIs or HL7 code values
- `FhirCodingEnricher` auto-appends cross-mapped codings (SNOMED→ICD-10) before FHIR writes via bridge terminology API
- `PlatformTokenService` — extracted single source of truth for jwt-bearer token exchange (shared by `BridgeClientService` + `TerminologyClient`)

## EHR Vendor Pattern
- Each vendor: `packages/ehr-data-service/src/vendors/{name}/{name}.service.ts` + `{name}.mapper.ts`
- All extend `BaseEhrService` (shared token mgmt, retry, logging)
- New vendor = new directory, register in `registerAllVendors()` — zero existing code changes (OCP)
- Token caching with 30s pre-expiry buffer, 401 retry with cache clear
- `ehrFactory` + core interfaces live in `@hs/ehr-data-service/core` (no separate `@hs/core` package)

## Non-FHIR EHR Integration Strategy
- For vendors with proprietary (non-FHIR) APIs, mapping to FHIR R4 is done in **bridge-api**, never in ehr-data-service
- `ehr-data-service` is a dumb, typed HTTP wrapper — returns vendor-native types as `EhrResponse<T>`, no clinical logic
- Bridge-api translates vendor payloads to strict, logically correct FHIR R4 resources using `@medplum/fhirtypes`
- See AthenaNet implementation (`apps/bridge-api/src/services/athenanet/athenanet.mapper.ts`) as the golden reference for the pattern

## Workflow Raw EHR Pattern
- Workflow-app bypasses bridge-api for EHR calls — uses `ehrFactory.getService(ehrName)` directly
- `EhrClientService` loads `AppEhrAccess` from DB, hands vendor service + config to workflow nodes
- Tokens are minted/cached by `BaseEhrService` inside ehr-data-service (shared Redis cache)
- Rationale: workflow executes raw vendor operations (non-FHIR too); bridge's FHIR normalization layer is not needed

## Frontend Patterns
- Pages = orchestrators (API calls, state); sub-components = pure UI (props only)
- Optimistic state updates after mutations — no full refetch
- Auto-generated SDK clients with type safety
- SSO cross-app: opaque code in URL hash → PKCE flow (never JWT in URL)
- Session expired: iframe modal (preserves user state), not hard redirect

# admin-api — Hot-Zone Notes for AI

## What this app is

The control plane. **OIDC issuer** for the platform (admin operators + end users + partner apps). Owns the EndUser model, identity resolver, application/site/EHR config, LLM key storage, workflow CRUD.

## Module map (only what matters for new work)

| Module | Purpose |
|---|---|
| `modules/oauth/` | Authorize, token, introspect, revoke, userinfo, logout — full OIDC + OAuth2 surface |
| `modules/auth/` | Operator signin (email/password), OTP, session token management |
| `modules/end-user/` | EndUser CRUD, per-app access (`EndUserAppAccess`), site access, identity resolver |
| `modules/cds-auth/` | End-user OTP signin (CDS standalone mode) |
| `modules/application/` | Application CRUD, redirect URIs, capability config |
| `modules/ehr-config/` | Per-app EHR access (`AppEhrAccess`), site config (`EhrSiteConfig`), JWKS upload |
| `modules/llm-config/` | Per-app LLM key storage (Secrets Manager — never DB) |
| `modules/workflow/` | Workflow CRUD (workflow-app executes them) |
| `modules/internal-token/` | M2M token mint for internal service-to-service |

## Token types (DO NOT mix)

| Token | `token_type` | `aud` | `sub` | Used by |
|---|---|---|---|---|
| Operator session | `session` | `{issuer}/admin` | userId | admin-ui, admin-api CRUD |
| End-user session | `session` | `{client_id}` | endUserId | partner OIDC apps |
| API token | `api` | `{issuer}/api` | applicationId | bridge-api consumers |
| Refresh | opaque hex | — | — | Redis-backed, single-use |

`SessionGuard` accepts only `session`; bridge-api's `DualAuthGuard` accepts only `api`. Don't try to make them interchangeable.

## SSO code flow (cross-app)

Never put JWTs in URLs. Use opaque SSO codes (32-byte hex, 30s TTL, one-time via `cache.getdel`). admin-ui mints via `POST /admin/auth/sso-code`; consumer (workflow-ui, cds-ui) hits `/oauth/authorize?sso_code=...&...PKCE...`.

## Identity resolver (Phase C of SSO)

`utils/identity-resolver.ts` accepts `(ehrName, fhirId, email, applicationId)` and returns `{ endUser, action: 'matched' | 'auto-created' | 'rejected' }`.

Auto-provisioning policy per app:
- `closed` → 403 + admin notification (default)
- `open` → auto-create EndUser + auto-grant
- `domain-locked` → auto-create only if email domain matches `Organization.domain`

Used by:
- bridge-api SMART launch (via `/internal/access/check` endpoint)
- admin-api `/oauth/authorize` (partner OIDC)
- cds-app `POST /launch/system`

## Tenant isolation rule

**Every** query that returns user/org data MUST include `organizationId` in the WHERE clause. Tested in code review. Cross-org access is allowed only for internal-service tokens with explicit `crossOrg` flag (logs `logger.warn` with both org ids).

## Email infra

`@hs/mailer` package. Init in `main.ts` with provider (SES prod / Mailtrap dev / console fallback). Templates: invite, otp, access-request-pending, AVS (Phase 5), inbox-reply (Phase 4).

Never block requests on email send (fire-and-forget with Sentry alert on failure).

## Common gotchas

- **Tokens expire — refresh is single-use.** Replay returns `invalid_grant`.
- **Refresh + DB user check.** Always re-verify the user is `ACTIVE` before issuing new tokens.
- **`redirect_uri` whitelist:** `validateRedirectUri()` fails closed if no allowedOrigins configured. Localhost allowed only when `NODE_ENV !== 'production'`.
- **Sign-out:** must call `/oauth/revoke` server-side before clearing local state. Best-effort (`.catch(() => {})`) — don't block.
- **Internal token mint** logs `crossOrg` warning on org mismatch. Don't suppress.

## When adding a new admin-ui feature

1. Backend controller + DTO + RolesGuard
2. Generated SDK (`apps/admin-ui/src/lib/sdk/generated/` — OpenAPI-driven, regenerate on schema change)
3. Page or component using the typed client
4. RolesGuard at controller, `getUser().role` at component for additional UI gating

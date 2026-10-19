# SSO & OAuth 2.0 Rules

## OAuth 2.0 Standards (RFC 6749 + RFC 7636)

### Grant Types Supported
- `client_credentials` — machine-to-machine (Bridge API consumers)
- `urn:ietf:params:oauth:grant-type:jwt-bearer` — JWT assertion (SMART on FHIR apps)
- `authorization_code` + PKCE (S256) — browser-based UI clients (admin-ui, workflow-ui)
- `refresh_token` — token rotation with atomic consumption

### Authorization Code + PKCE Flow
```
Client → GET /oauth/authorize
  ?response_type=code
  &redirect_uri=<registered-uri>
  &state=<random-uuid>
  &code_challenge=<sha256-of-verifier>
  &code_challenge_method=S256
  &sso_code=<opaque-code>     ← for cross-app SSO (not a JWT)

Server → validates → 302 redirect_uri?code=<auth-code>&state=<state>

Client → POST /oauth/token
  grant_type=authorization_code
  code=<auth-code>
  redirect_uri=<same-as-above>
  code_verifier=<pkce-verifier>

Server → validates PKCE (timing-safe) → returns access_token + refresh_token
```

### Token Types

| Token | Type Claim | Audience | Lifetime | Storage |
|-------|-----------|----------|----------|---------|
| Session JWT | `token_type: 'session'` | `{issuer}/admin` | 15 min | Client (localStorage) |
| API JWT | `token_type: 'api'` | `{issuer}/api` | Configurable (default 1h) | Client |
| Refresh token | Opaque hex | — | 7 days | Redis (`session:refresh:{token}`) |
| SSO code | Opaque hex | — | 30 seconds | Redis (`sso:code:{code}`) |
| Authorization code | Opaque hex | — | 60 seconds | Redis (`oauth:code:{code}`) |

## Token Separation: Session vs API

### The Rule
Session tokens and API tokens serve fundamentally different purposes and **MUST NOT be interchangeable**.

| Aspect | Session Token | API Token |
|--------|--------------|-----------|
| `token_type` | `session` | `api` |
| `aud` | `{issuer}/admin` | `{issuer}/api` |
| `sub` | userId | applicationId |
| Claims | email, org_id, role | client_id, org_id, scope, ehr_access, app_type, app_name |
| Issued via | signin, authorization_code (PKCE) | client_credentials, jwt-bearer |
| Used by | admin-ui, workflow-ui → admin-api CRUD | bridge-api, workflow-app → FHIR data |
| Guard | `SessionGuard` (admin-api) | `DualAuthGuard` (bridge-api) |

- **Workflow-UI's session token CANNOT access bridge-api** — `DualAuthGuard` requires `token_type: 'api'`
- **API tokens CANNOT access admin-api CRUD** — `SessionGuard` requires `token_type: 'session'`
- Workflow execution: admin-api (session) → Kafka → workflow-app (gets own API token internally) → bridge-api

### Application Types and Token Scope

| App Type | Max EHRs | Allowed on Bridge API | Workflows | CDS |
|----------|----------|----------------------|-----------|-----|
| BRIDGE | Unlimited | Yes | No | No |
| WORKFLOW | 1 | Yes | Yes | No |
| CDS | Unlimited | Yes | No | Yes |
| CUSTOM | Unlimited | No | No | No |

App type constraints are centralized in `@hs/config` `APP_TYPE_DEFINITIONS` — used by admin-api for validation and admin-ui for rendering.

## SSO Cross-App Authentication

### The Problem
admin-ui and workflow-ui are separate origins. Users need seamless navigation between them without re-authenticating.

### The Rule: Never Put JWTs in URLs
- **NEVER pass session tokens, access tokens, or any JWT via URL** — not in query params, not in hash fragments, not in path segments.
- Tokens in URLs are logged in server access logs, browser history, proxy logs, CDN/WAF logs, and `Referer` headers.
- This applies to ALL token types — session, API, refresh.

### SSO Code Flow (the correct approach)
```
1. admin-ui → POST /api/admin/auth/sso-code (Bearer session JWT in header)
   ← { sso_code: "opaque-random-hex" }

2. admin-ui → window.open(workflow-ui/auth/sso-launch#sso_code=<code>&appId=<id>)
   (only opaque, 30-second, one-time code in URL — not a JWT)

3. workflow-ui → reads hash → generates PKCE pair → redirects to:
   GET /oauth/authorize?...&sso_code=<code>

4. admin-api → validates SSO code (cache.getdel — atomic, one-time) → issues auth code → redirects to callback

5. workflow-ui → exchanges auth code + PKCE verifier → receives access_token + refresh_token
```

### SSO Code Properties
- **Opaque:** `randomBytes(32).toString('hex')` — reveals nothing about the user
- **Short-lived:** 30-second TTL in Redis
- **One-time use:** consumed via `cache.getdel()` — atomic, prevents replay
- **Bound to user:** stores `userId`, `email`, `orgId`, `role` in Redis (never in the code itself)
- **No audience or scope:** the subsequent PKCE flow handles authorization

## Redirect URI Validation

### The Rule
- **Every `redirect_uri` MUST be validated against a whitelist** before issuing an authorization code (RFC 6749 Section 3.1.2.2).
- For first-party UI clients: validate against configured origins (`ADMIN_UI_URL`, `WORKFLOW_UI_URL`).
- For third-party applications: validate against `Application.redirectUris` stored in the database.
- Localhost origins (`localhost`, `127.0.0.1`) are always allowed in development.
- Non-localhost URIs MUST use HTTPS.

### Anti-Pattern
```typescript
// BAD — accepts any HTTPS URL
const url = new URL(redirectUri);
if (url.protocol === 'https:') { /* allow */ }

// GOOD — checks against registered origins
const allowedOrigins = [ADMIN_UI_URL, WORKFLOW_UI_URL].map(u => new URL(u).origin);
if (!allowedOrigins.includes(parsed.origin)) {
  throw new BadRequestException('redirect_uri origin is not registered');
}
```

## Return URL Validation

### The Rule
- **Any `return_url` parameter MUST be validated against a whitelist of trusted origins** before redirecting.
- admin-ui signin accepts `return_url` only if its origin matches `ADMIN_API_URL` (admin-api's authorize endpoint).
- Never redirect to an arbitrary URL with authentication data.

### Anti-Pattern
```typescript
// BAD — open redirect with token theft
const url = new URL(returnUrl);
url.searchParams.set('session_token', jwt);  // NEVER put JWTs in URLs
window.location.href = url.toString();

// GOOD — validate origin + use SSO code
const allowedOrigin = new URL(ADMIN_API_URL).origin;
if (url.origin !== allowedOrigin) throw new Error('Untrusted return URL');
const { sso_code } = await api.post('/admin/auth/sso-code', {});
url.searchParams.set('sso_code', sso_code);
window.location.href = url.toString();
```

## Refresh Token Security

### Token Rotation
- Every refresh token is **single-use**. Consuming it via `cache.getdel()` atomically deletes the old token and a new one is issued.
- If a consumed token is replayed, the request fails with `invalid_grant` — this is expected behavior, not a bug.
- After refresh, verify the user is still `ACTIVE` in the database before issuing new tokens.

### Client-Side Auto-Refresh
- On 401 response, the `ApiClient` attempts refresh via `POST /oauth/token` with `grant_type: refresh_token`.
- Concurrent 401s are deduplicated — only one refresh attempt runs at a time (`this.refreshing` promise).
- On successful refresh, the original request is retried with the new token.
- On failed refresh, the `SessionExpiredModal` is shown (not a hard redirect) to preserve user state.

### Refresh Token in workflow-ui
```typescript
// ApiClient.tryRefresh() — called on 401
const res = await fetch(`${BASE_URL}/oauth/token`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    grant_type: 'refresh_token',
    refresh_token: storedRefreshToken,
  }),
});
// On success: setAuthTokens(data.access_token, data.refresh_token, data.user)
```

## Security Headers

### admin-api (NestJS + Helmet)
```typescript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],   // Swagger UI
      styleSrc: ["'self'", "'unsafe-inline'"],     // Swagger UI
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"],
    },
  },
}));
```

### admin-ui (Next.js headers)
- `Content-Security-Policy: frame-ancestors 'self' <WORKFLOW_UI_URL>` — allows workflow-ui to iframe the signin page for session-expired re-login
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`

### workflow-ui (Next.js headers)
- `X-Frame-Options: DENY` — workflow-ui should never be framed
- `Content-Security-Policy: frame-ancestors 'none'`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`

## Session Expired Modal (Iframe Re-Login)

### The Rule
- When refresh token fails, show a **modal with embedded admin-ui signin iframe** — do NOT hard-redirect (user loses workflow editor state).
- Iframe sandbox: `allow-same-origin allow-scripts allow-forms` only. **NEVER** `allow-top-navigation` or `allow-popups`.
- Poll `localStorage` for new token (set by `/auth/callback` after re-login completes).
- Auto-dismiss modal when `isAuthenticated()` returns `true`.
- Provide "Open full sign-in page" fallback link for cases where iframe doesn't work.

## Sign-Out

### The Rule
- **Always revoke tokens server-side before clearing local state.**
- Call `POST /oauth/revoke` with both the access token and refresh token.
- Revocation is best-effort (`.catch(() => {})`) — don't block sign-out on network failures.
- Clear `localStorage` tokens after revocation attempts complete.
- Redirect to `/auth/signin`.

## RFC Compliance Requirements

### Token Endpoint (`POST /oauth/token`) — RFC 6749 S5
- Response MUST include `access_token`, `token_type`, `expires_in`, `scope` (all snake_case).
- Error response MUST include `error` and `error_description` with correct HTTP status (400 for `invalid_request`, 401 for `invalid_client`).
- `scope` is REQUIRED in the response even for authorization_code and refresh_token grants.

### Authorization Endpoint (`GET /oauth/authorize`) — RFC 6749 S4.1
- MUST accept `client_id` parameter (RFC 6749 S4.1.1). `app_id` is accepted as a legacy alias.
- After `redirect_uri` is validated, errors MUST be returned via redirect: `redirect_uri?error=...&error_description=...&state=...` (RFC 6749 S4.1.2.1).
- Before `redirect_uri` is validated, JSON error responses are acceptable (can't redirect to unvalidated URI).

### Token Introspection (`POST /oauth/introspect`) — RFC 7662
- **Client authentication is REQUIRED** (RFC 7662 S2.1) — Basic auth or `client_id`/`client_secret` in body.
- MUST accept `token_type_hint` parameter (optional, helps server optimize lookup).
- Response: `{ active: true/false }` — never throw on invalid token.

### Token Revocation (`POST /oauth/revoke`) — RFC 7009
- **Client authentication is REQUIRED** (RFC 7009 S2.1).
- MUST accept `token_type_hint` parameter (`access_token` or `refresh_token`).
- MUST support revoking both JWTs (via `jti` blacklist) and opaque refresh tokens (via Redis delete).
- Always return HTTP 200 regardless of outcome.

### Discovery (`GET /.well-known/openid-configuration`) — RFC 8414
- MUST include: `issuer`, `authorization_endpoint`, `token_endpoint`, `jwks_uri`, `response_types_supported`, `subject_types_supported`, `id_token_signing_alg_values_supported`.
- SHOULD include: `introspection_endpoint_auth_methods_supported`, `revocation_endpoint_auth_methods_supported`.

### SMART Configuration (`GET /.well-known/smart-configuration`)
- MUST include `capabilities` array per SMART App Launch IG.
- Capabilities include: `launch-ehr`, `launch-standalone`, `client-public`, `client-confidential-symmetric`, `context-ehr-patient`, `context-ehr-encounter`.

### One-Time Code Consumption
- ALL one-time codes (SSO codes, authorization codes, SMART launch codes, SMART state tokens) MUST be consumed atomically via `cache.getdel()` — never `cache.get()` + `cache.del()` (race condition).

### Deprecated Endpoints
- Deprecated endpoints MUST include `Deprecation: true`, `Sunset: <date>`, and `Link: <successor>; rel="successor-version"` HTTP headers.

## Anti-Patterns

| Anti-pattern | Correct Approach |
|-------------|-----------------|
| JWT in URL query param (`?session_token=eyJ...`) | SSO code: `?sso_code=<opaque-hex>` (30s TTL, one-time) |
| JWT in URL hash (`#token=eyJ...`) | SSO code: `#sso_code=<opaque-hex>` |
| `redirect_uri` without whitelist check | Validate against configured allowed origins |
| `return_url` without origin validation | Check origin matches `ADMIN_API_URL` |
| Building URLs from `req.get('host')` | Use configured `ADMIN_API_URL` env var |
| `unsupported_grant_type` returning 200 | `throw new BadRequestException(...)` (RFC 6749 requires 400) |
| Iframe with `allow-top-navigation` | Remove — prevents parent navigation attacks |
| `JSON.parse(localStorage)` without try/catch | Wrap in try/catch, call `clearAuth()` on failure |
| Direct `localStorage.setItem` for tokens | Use `setAuthTokens()` from `@/lib/auth` |
| Sign-out without server revocation | Call `/oauth/revoke` before clearing local state |
| Hard redirect on session expiry | Show `SessionExpiredModal` to preserve user state |
| Introspect/revoke without client auth | Require `client_id`/`client_secret` (RFC 7662/7009) |
| `cache.get()` + `cache.del()` for one-time codes | Use `cache.getdel()` (atomic, prevents race condition) |
| Authorize errors as JSON after redirect_uri validated | Redirect: `redirect_uri?error=...&state=...` (RFC 6749 S4.1.2.1) |
| Missing `scope` in token response | Always include `scope` (RFC 6749 S5.1) |
| Missing `token_type_hint` on introspect/revoke | Accept optional `token_type_hint` param (RFC 7662/7009) |
| `app_id` without `client_id` on authorize | Accept `client_id` as RFC-standard param (RFC 6749 S4.1.1) |

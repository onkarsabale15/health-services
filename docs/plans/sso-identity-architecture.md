# SSO Identity Architecture — Outstanding Work

> **Status (May 2026):** Largely superseded by SSO Phase A/B/C of recent work (commits `b62dd82`, `c82170c`, `7e3135b`, `9beb21b`, `6cd03dd`). Audit + BAA + multi-realm subset remain.
> **Master roadmap:** [`cds-roadmap-2026-05.md`](./cds-roadmap-2026-05.md). Closure planned in Phase 0 (heavy trim) and later phases (BAA/audit).
> **Original plan body (856 lines):** see git history; most narrative refers to EndUser model + identity resolver + per-app gating which all shipped.

## What's done (do NOT re-do)

| Capability | Where |
|---|---|
| OIDC issuer (admin-api) | `oauth.controller.ts` — authorize, token, introspect, revoke, well-known |
| EndUser data model + invite + per-app access gate | Phase C migrations, `apps/admin-api/src/modules/end-user/` |
| Identity resolver (id_token fhirUser → EndUser, with auto-provisioning policies closed/open/domain-locked) | Phase C2 |
| SMART launch enforcement on EndUserAppAccess (replaces legacy EhrProviderAccess) | Phase C3 |
| Admin-ui End-Users + per-app Allowed-Users + AutoProvPolicy radio | Phase C4 |
| Real email infra | `@hs/mailer` package |
| Refresh token rotation, atomic getdel | shipped |
| Token type separation (`session` vs `api`, audience separation) | shipped |
| SSO code (opaque, 30s TTL, one-time) for cross-app auth | shipped |
| RP-initiated logout (`/oauth/logout`) | shipped (`7e3135b`) |
| `id_token` + `userinfo` endpoints | Phase B (`0247b17`, `9d64f41`) |

## What remains

### 1. Audit framework (P3 from original plan)
- `AuditEvent` table + viewer in admin-ui.
- Schema sketch: `AuditEvent { id, applicationId, organizationId, actorType, actorId, action, resourceType, resourceId, payload Json, ip, userAgent, occurredAt }`.
- Append-only writes from a `@Audit()` decorator + `auditedSpan()` helper.
- Viewer with filters by actor / action / resource / time-range.
- HIPAA §164.312(b) coverage.
- **Sequencing:** Phase 3+ of master roadmap (after MCP + Co-Pilot ship; agentic actions need this audit chain anyway).

### 2. BAA tracking on Application records
- Schema additions: `Application.baaSignedAt DateTime?`, `Application.baaDocumentRef String?`, `Application.baaCounterparty String?`.
- Admin-ui: BAA tab on application detail (read-only history + upload new).
- Block clinical data flow on apps without BAA when a flag `requireBaa` is true.
- **Sequencing:** Phase 5+ (post-launch for first paying customer; required before broader sales).

### 3. Inbound IdP federation (SAML / OIDC from customer's own IdP)
- 2-3 week sub-project. Customer wants to use their existing Okta / Azure AD.
- Out-of-scope for current planning horizon. Capture as future work; do NOT start without explicit prioritization.

### 4. Time-bounded access grants UI
- Schema fields exist (`grantedAt`, `revokedAt`); admin-driven expiry UI doesn't.
- Small follow-up; not blocking anything.

### 5. AccessReview generator (P3 territory)
- Periodic "review who has access to what" report.
- Defer until first compliance audit demands it.

### 6. Bulk CSV user import / TOTP / passkeys / dynamic client registration
- All deferred per original plan; status unchanged.

## Open audit items (cross-reference the internal 2026-04-04 security audit)

- **F14** — `createLocalJWKSet` for SMART JWT assertion (closed in Phase 0 of master roadmap)
- **F19** — fail-closed empty `allowedOrigins` (closed in Phase 0)
- **F10** — org-boundary check on internal token mint (closed in Phase 0)

## Acceptance for closure

- Audit framework + viewer shipped (Phase 3+ of master roadmap)
- BAA tracking shipped (Phase 5+ of master roadmap)
- Plan stays open as a tracking doc until Audit + BAA both ship; archive when both close

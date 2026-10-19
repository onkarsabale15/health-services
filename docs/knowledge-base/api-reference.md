# API Reference

## admin-api (port 3002, prefix `/api`)

### Auth (`/admin/auth`)

| Method | Path | Handler | Auth | Rate Limit |
|--------|------|---------|------|------------|
| POST | /admin/auth/signup | signUp | Public | 5/min/email |
| POST | /admin/auth/signin | signIn | Public | 5/min/email |
| POST | /admin/auth/refresh | refresh | Public | 30/min/IP (DEPRECATED) |
| POST | /admin/auth/logout | logout | SessionGuard | default |
| POST | /admin/auth/sso-code | createSsoCode | SessionGuard | default |

### OAuth (`/oauth`, `/.well-known`)

| Method | Path | Handler | Auth | Rate Limit |
|--------|------|---------|------|------------|
| GET | /.well-known/openid-configuration | getOpenIdConfig | Public | — |
| GET | /.well-known/smart-configuration | getSmartConfig | Public | — |
| GET | /.well-known/jwks.json | getJwks | Public | — |
| GET | /oauth/authorize | authorize | SSO code or redirect | — |
| POST | /oauth/token | token | Basic/body | 60/min/clientId |
| POST | /oauth/introspect | introspect | Basic/body | 300/min/clientId |
| POST | /oauth/revoke | revoke | Basic/body | 30/min |

Grant types: `client_credentials`, `jwt-bearer`, `authorization_code` (PKCE S256), `refresh_token`

### Organization (`/organizations`)

| Method | Path | Handler | Auth | Role |
|--------|------|---------|------|------|
| GET | /organizations/me | getMyOrganization | SessionGuard | any |
| PATCH | /organizations/me | updateOrganization | SessionGuard+Roles | OWNER |

### Users (`/users`)

| Method | Path | Handler | Auth | Role |
|--------|------|---------|------|------|
| GET | /users | listUsers | SessionGuard+Roles | any |
| GET | /users/pending | listPendingUsers | SessionGuard+Roles | OWNER, ADMIN |
| PATCH | /users/:id/approve | approveUser | SessionGuard+Roles | OWNER, ADMIN |
| PATCH | /users/:id/disable | disableUser | SessionGuard+Roles | OWNER, ADMIN |
| PATCH | /users/:id/role | changeRole | SessionGuard+Roles | OWNER |
| GET | /users/:userId/apps | listUserApps | SessionGuard+Roles | OWNER, ADMIN |
| PATCH | /users/:userId/apps/:appId | grantAppAccess | SessionGuard+Roles | OWNER, ADMIN |
| DELETE | /users/:userId/apps/:appId | revokeAppAccess | SessionGuard+Roles | OWNER, ADMIN |

### Applications (`/applications`)

| Method | Path | Handler | Auth | Role |
|--------|------|---------|------|------|
| GET | /applications | listApplications | SessionGuard+Roles | any (MEMBER: own access) |
| POST | /applications | createApplication | SessionGuard+Roles | OWNER, ADMIN |
| GET | /applications/:id | getApplication | SessionGuard+Roles | any |
| GET | /applications/:id/detail | getApplicationDetail | SessionGuard+Roles | any (composite) |
| PATCH | /applications/:id | updateApplication | SessionGuard+Roles | OWNER, ADMIN |
| POST | /applications/:id/rotate-secret | rotateSecret | SessionGuard+Roles | OWNER, ADMIN |
| PATCH | /applications/:id/jwks | updateJwks | SessionGuard+Roles | OWNER, ADMIN |
| POST | /applications/:id/jwks/refresh | refreshJwks | SessionGuard+Roles | OWNER, ADMIN |
| DELETE | /applications/:id/jwks | removeJwks | SessionGuard+Roles | OWNER, ADMIN |
| POST | /applications/:id/enable | enableApplication | SessionGuard+Roles | OWNER, ADMIN |
| GET | /applications/:id/access | listAppAccess | SessionGuard+Roles | OWNER, ADMIN |
| DELETE | /applications/:id | deleteApplication | SessionGuard+Roles | OWNER, ADMIN |

### EHR Config (`/ehr`, `/applications/:appId/ehr`)

| Method | Path | Handler | Auth | Role |
|--------|------|---------|------|------|
| GET | /ehr/definitions | getDefinitions | Public | — |
| GET | /ehr/definitions/:ehrName | getDefinition | Public | — |
| GET | /ehr/scopes | getAllPlatformScopes | Public | — |
| GET | /ehr/definitions/:ehrName/scopes | getScopes | Public | — |
| GET | /ehr/definitions/:ehrName/endpoints | getEndpoints | Public | — |
| GET | /ehr/definitions/:ehrName/token-scopes | getTokenScopes | Public | — |
| GET | /applications/:appId/ehr | listEhrAccess | SessionGuard | any |
| PUT | /applications/:appId/ehr/:ehrName | upsertEhrAccess | SessionGuard+Roles | OWNER, ADMIN |
| POST | /applications/:appId/ehr/:ehrName/enable | enableEhrAccess | SessionGuard+Roles | OWNER, ADMIN |
| DELETE | /applications/:appId/ehr/:ehrName | removeEhrAccess | SessionGuard+Roles | OWNER, ADMIN |
| PUT | /applications/:appId/ehr/:ehrName/jwks/:env | uploadJwks | SessionGuard+Roles | OWNER, ADMIN |
| GET | /applications/:appId/ehr/:ehrName/jwks/status | getJwksStatusAll | SessionGuard | any |
| GET | /applications/:appId/ehr/:ehrName/jwks/:env/status | getJwksStatus | SessionGuard | any |
| DELETE | /applications/:appId/ehr/:ehrName/jwks/:env | deleteJwks | SessionGuard+Roles | OWNER, ADMIN |
| GET | /applications/:appId/ehr/:ehrName/sites | listSites | SessionGuard | any |
| POST | /applications/:appId/ehr/:ehrName/sites | createSite | InternalOrAuthGuard | OWNER, ADMIN (or internal) |
| PUT | /applications/:appId/ehr/:ehrName/sites/:siteId | updateSite | SessionGuard+Roles | OWNER, ADMIN |
| DELETE | /applications/:appId/ehr/:ehrName/sites/:siteId | removeSite | SessionGuard+Roles | OWNER, ADMIN |
| PATCH | /applications/:appId/ehr/:ehrName/sites/:siteId/default | setDefaultSite | SessionGuard+Roles | OWNER, ADMIN |

### Unified Lookups (`/sites`, `/applications`, `/integrations`)

| Method | Path | Handler | Auth | Notes |
|--------|------|---------|------|-------|
| GET | /sites/lookup | lookupSite | InternalOrAuthGuard | By siteId or integrationId+vendorIdentifiers |
| GET | /applications/lookup | lookupApplication | InternalOrAuthGuard | By id or clientId |
| GET | /integrations/lookup | lookupIntegration | InternalOrAuthGuard | By appId+ehrName or clientId+ehrName |

### LLM Config (`/applications/:appId/llm-keys`)

| Method | Path | Handler | Auth | Role |
|--------|------|---------|------|------|
| PUT | /applications/:appId/llm-keys/:provider | setKey | SessionGuard+Roles | OWNER, ADMIN |
| DELETE | /applications/:appId/llm-keys/:provider | removeKey | SessionGuard+Roles | OWNER, ADMIN |
| GET | /applications/:appId/llm-keys/status | getKeyStatus | SessionGuard+Roles | OWNER, ADMIN |

### Workflows (`/applications/:appId/workflows`, `/workflow-templates`)

| Method | Path | Handler | Auth | Role |
|--------|------|---------|------|------|
| POST | /applications/:appId/workflows | create | SessionGuard+Roles | OWNER, ADMIN |
| GET | /applications/:appId/workflows | list | SessionGuard+Roles | any |
| GET | /applications/:appId/workflows/:id | getById | SessionGuard+Roles | any |
| PATCH | /applications/:appId/workflows/:id | update | SessionGuard+Roles | OWNER, ADMIN |
| DELETE | /applications/:appId/workflows/:id | delete | SessionGuard+Roles | OWNER, ADMIN |
| GET | /workflow-templates | listTemplates | SessionGuard+Roles | any |
| GET | /workflow-templates/:id | getTemplate | SessionGuard+Roles | any |
| POST | /applications/:appId/workflows/from-template | createFromTemplate | SessionGuard+Roles | OWNER, ADMIN |

### Workflow Execution (`/applications/:appId/...`)

| Method | Path | Handler | Auth | Role |
|--------|------|---------|------|------|
| POST | /applications/:appId/workflows/:workflowId/execute | execute | SessionGuard+Roles | OWNER, ADMIN |
| GET | /applications/:appId/executions | listExecutions | SessionGuard+Roles | any |
| GET | /applications/:appId/executions/:execId | getExecution | SessionGuard+Roles | any |
| GET | /applications/:appId/executions/:execId/steps | getSteps | SessionGuard+Roles | any |
| POST | /applications/:appId/executions/:execId/cancel | cancel | SessionGuard+Roles | OWNER, ADMIN |

### Internal (`/internal`)

| Method | Path | Handler | Auth |
|--------|------|---------|------|
| POST | /internal/token-for-app | tokenForApp | x-internal-key header |

Note: `InternalOrAuthGuard` accepts Bearer tokens and distinguishes: `internal: true` JWT (bridge-api self-signed) → skip org boundaries; session JWT → standard admin auth; API JWT → external client.

### Health

| Method | Path | Handler | Auth |
|--------|------|---------|------|
| GET | / | checkRoot | Public |
| GET | /health | check | Public |

---

## bridge-api (port 3000, prefix `/api`)

### FHIR R4 (`/fhir/r4/v1/{ResourceType}`)

All require: Bearer token (DualAuthGuard) + IntegrationId header + ScopeGuard

| Resource | GET (search) | GET /:id | POST | PUT | DELETE |
|----------|:---:|:---:|:---:|:---:|:---:|
| Patient | Y | Y | Y | — | — |
| Appointment | Y | Y | — | — | — |
| Condition | Y | Y | Y | Y | — |
| Encounter | Y | Y | — | Y | — |
| Observation | Y | Y | — | — | — |
| AllergyIntolerance | Y | Y | — | — | — |
| Practitioner | Y | Y | — | — | — |
| ServiceRequest | Y | Y | — | — | — |
| MedicationRequest | Y | Y | — | — | — |
| MedicationStatement | Y | Y | — | — | — |
| Communication | Y | Y | — | — | — |
| DocumentReference | Y | Y | — | — | — |
| Coverage | Y | Y | — | — | — |
| Location | Y | Y | — | — | — |
| Task | Y | Y | — | — | — |

| Method | Path | Handler | Auth |
|--------|------|---------|------|
| GET | /fhir/r4/v1/metadata | getMetadata | Public |

### SMART Launch (`/v1/smart`)

| Method | Path | Handler | Auth | Rate Limit |
|--------|------|---------|------|------------|
| GET | /v1/smart/launch/:applicationId/:ehrName | launch | Public | 30/min |
| GET | /v1/smart/callback/:applicationId/:ehrName | callback | Public | 30/min |
| POST | /v1/smart/token | exchangeToken | Client auth | 30/min |
| POST | /v1/smart/session | fetchSession | Client auth | 30/min |

### Terminology (`/terminology`)

Global terminology service — not tied to any EHR. Uses bridge's global `DualAuthGuard`.

| Method | Path | Handler | Auth | Rate Limit |
|--------|------|---------|------|------------|
| GET | /terminology/search | search | DualAuthGuard | 300/min |
| GET | /terminology/lookup | lookup | DualAuthGuard | 300/min |

Query params:
- `search`: `system` (snomed\|icd10), `q` (text query), `limit` (default 20)
- `lookup`: `system` (snomed\|icd10), `code` (exact code)

Returns concepts with cross-mappings (e.g. SNOMED result includes paired ICD-10 code).

### Health

| Method | Path | Handler | Auth |
|--------|------|---------|------|
| GET | / | checkRoot | Public |
| GET | /health | check | Public |

---

## cds-app (port 3003, prefix `/api`)

| Method | Path | Handler | Auth |
|--------|------|---------|------|
| GET | / | checkRoot | Public |
| GET | /health | check | Public |
| GET | /launch | launch | Public (SMART launch entry) |
| GET | /api/analysis/:sessionId | getAnalysis | Public (poll results) |

### Clinical Write (`/clinical-data`, CdsSessionGuard)

| Method | Path | Handler | Auth |
|--------|------|---------|------|
| POST | /clinical-data/conditions | createCondition | CdsSessionGuard |
| PUT | /clinical-data/conditions/:id | updateCondition | CdsSessionGuard |
| POST | /clinical-data/allergies | createAllergy | CdsSessionGuard |
| POST | /clinical-data/observations | createObservation | CdsSessionGuard |
| POST | /clinical-data/appointments | createAppointment | CdsSessionGuard |
| POST | /clinical-data/encounters | createEncounter | CdsSessionGuard |

Note: Condition create/update accepts a lean domain DTO (concept + state + severity). Backend assembles full FHIR body via `ConditionBodyBuilder`.

---

## workflow-app (port 3004, prefix `/api`)

No HTTP endpoints for execution — triggered via Kafka topic `workflow.execute`.

| Method | Path | Handler | Auth |
|--------|------|---------|------|
| GET | / | checkRoot | Public |
| GET | /health | check | Public (DB+Redis+Kafka) |

---

## Guard Chain Summary

| App | Guard Order |
|-----|-------------|
| admin-api | ThrottlerGuard (global) → SessionGuard (per-route) → RolesGuard (per-route) |
| bridge-api | ThrottlerGuard (global) → DualAuthGuard (global) → ScopeGuard (global) → RolesGuard (optional) |
| cds-app | No guards (public endpoints) |
| workflow-app | No guards (Kafka-driven) |

## Rate Limit Tiers

| Endpoint | Limit | Bucket Key |
|----------|-------|------------|
| Auth signin/signup | 5/min | email |
| Auth refresh | 30/min | IP |
| OAuth token | 60/min | clientId |
| OAuth introspect | 300/min | clientId |
| OAuth revoke | 30/min | identity |
| Bridge FHIR (default) | 600/min | clientId |
| Bridge burst | 20/sec | IP |
| Admin default | 200/min | identity |
| Admin burst | 10/sec | IP |
| SMART launch | 30/min | — |

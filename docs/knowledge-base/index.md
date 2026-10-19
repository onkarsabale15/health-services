# Knowledge Base Index

> Updated 2026-04-21. Health Services healthcare integration platform.

## Core Documentation

| File | Description |
|------|-------------|
| [overview.md](./overview.md) | Tech stack, architecture diagram, apps, packages, startup order |
| [api-reference.md](./api-reference.md) | All HTTP endpoints across 5 backend apps (admin-api, bridge-api, cds-app, workflow-app, terminology-sync) |
| [data-models.md](./data-models.md) | Prisma schema: 14 models, enums, indexes, relations, FHIR resource mapping |
| [frontend-map.md](./frontend-map.md) | admin-ui + workflow-ui + cds-ui: pages, components, API calls, auth flows |
| [patterns.md](./patterns.md) | Architecture patterns, NestJS conventions, cache/token/EHR/terminology/clinical-write patterns |
| [compliance-map.md](./compliance-map.md) | HIPAA safeguards, auth/authz, rate limiting, input validation, secrets, OAuth security, terminology |

## Quick Stats

- **9 apps:** admin-api, bridge-api, cds-app, cds-ui, workflow-app, admin-ui, workflow-ui, docs, terminology-sync
- **7 packages:** `@hs/infra` + `@hs/observability` (consolidated infra bundles), `@hs/bootstrap`, `@hs/config`, `@hs/ehr-data-service` (absorbs former `@hs/core`), `@hs/ai`, `@hs/bridge-client` (admin-sdk killed — admin-ui generates inline)
- **15 FHIR resources** supported (Patient, Encounter, Condition, MedicationRequest, Observation, etc.)
- **10 EHR vendors** (Epic, Cerner, AthenaNet, NextGen, eClinicalWorks, DrChrono, Elation, Meditech, Medent, Greenways)
- **6 LLM providers** (Anthropic, OpenAI, Gemini, Ollama, Bedrock, vLLM)
- **4 OAuth grant types** (client_credentials, jwt-bearer, authorization_code+PKCE, refresh_token)
- **14 Prisma models** + 10 enums
- **2 code systems:** SNOMED CT, ICD-10-CM (cross-mapped via terminology service)

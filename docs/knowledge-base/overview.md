# Health Services — Overview

## What It Is
Healthcare integration platform that bridges EHR systems (Epic, Cerner, Athena, etc.) to third-party apps via FHIR R4 APIs, with clinical decision support (CDS) and workflow automation.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | NestJS 11 (TypeScript), Prisma 6, PostgreSQL (Aiven) |
| Frontend | Next.js 16 (admin-ui, workflow-ui), Nextra 3 (docs) |
| Cache/State | Redis (Aiven Valkey) via ioredis |
| Messaging | Kafka (KafkaJS) |
| AI/LLM | LangChain, Anthropic SDK, OpenAI SDK, Google Gemini, AWS Bedrock |
| Auth | JWT (RS384 via jose), OAuth 2.0 + PKCE, SMART on FHIR |
| Secrets | Doppler (dev/staging), AWS Secrets Manager (prod) |
| Storage | AWS S3 |
| Observability | OpenTelemetry, OneUptime, Winston logging |
| Monorepo | Turborepo + npm workspaces |
| Workflow Canvas | @xyflow/react (node-based editor) |

## Architecture

```
                    ┌─────────────┐   ┌──────────────┐   ┌──────────┐
                    │  admin-ui   │   │ workflow-ui   │   │   docs   │
                    │  :3001      │   │  :3005        │   │  :3006   │
                    └──────┬──────┘   └──────┬────────┘   └──────────┘
                           │                 │
                    ┌──────▼─────────────────▼────────┐
                    │         admin-api :3002          │
                    │  (CRUD, OAuth, SSO, Workflows)   │
                    └──────┬──────────────────────────┘
                           │              │ Kafka
              ┌────────────▼───┐    ┌─────▼──────────┐
              │ bridge-api     │    │ workflow-app    │
              │ :3000 (FHIR)  │    │ :3004 (executor)│
              └───┬────────┬──┘    └────────┬────────┘
                  │        │                │
           ┌──────▼──┐  ┌─▼─────────┐  ┌───▼──────┐
           │ EHR APIs │  │ cds-app   │  │ Bridge   │
           │ (10 EHRs)│  │ :3003(AI) │  │ API calls│
           └──────────┘  └───────────┘  └──────────┘
```

## Apps (8)

| App | Port | Purpose | Entry |
|-----|------|---------|-------|
| admin-api | 3002 | CRUD, OAuth 2.0, SSO, user/app/EHR/workflow management | NestJS |
| bridge-api | 3000 | FHIR R4 proxy to 10 EHR vendors, SMART launch, terminology service | NestJS |
| cds-app | 3003 | Clinical decision support via LangChain ReAct agents | NestJS |
| cds-ui | — | Clinical summary UI (conditions, allergies, meds, vitals) | Next.js |
| workflow-app | 3004 | DAG-based workflow execution (Kafka consumer) | NestJS |
| admin-ui | 3001 | Management dashboard | Next.js |
| workflow-ui | 3005 | Visual workflow designer (XYFlow canvas) | Next.js |
| docs | 3006 | Developer documentation | Nextra |
| terminology-sync | CLI | Batch sync of ICD-10↔SNOMED mappings (ECS task) | NestJS standalone |

## Packages (7)

| Package | Type | Purpose |
|---------|------|---------|
| @hs/infra | Infra bundle | `cache` (Redis + `getOrSet`), `db` (Prisma), `http-client` (Axios + retry), `secrets` (Doppler/AWS), `storage` (S3), `kafka`, `messaging` — all singletons with lazy init |
| @hs/observability | Infra bundle | `logger` (Winston) + `tracing` (OpenTelemetry + Sentry + `withSpan`) + `RequestTimingMiddleware` |
| @hs/bootstrap | Infra | `bootstrapNestApp()` — standard NestJS startup (helmet, CORS, Swagger, pipes) used by all backend apps |
| @hs/config | Types-only | App type definitions, EHR capabilities/definitions/endpoints, ISS registry, token scopes, FHIR routes |
| @hs/ehr-data-service | Domain | 10 EHR vendor services (Epic, Cerner, AthenaNet, NextGen, eCW, DrChrono, Elation, Meditech, Medent, Greenways) + `core/` (interfaces, base services, ehrFactory, errors) + `terminology/` |
| @hs/ai | Domain | LLM provider factory (Anthropic, OpenAI, Gemini, Ollama, Bedrock, vLLM) |
| @hs/bridge-client | Generated | Bridge API typed client — OpenAPI spec extracted from bridge-api Swagger decorators at build time; consumed by cds-app, workflow-app. Admin SDK removed; admin-ui generates its own client inline at `apps/admin-ui/src/lib/sdk/generated/`. |

## Cross-Service Communication
- **bridge-api → admin-api:** `AdminClientService` self-signs JWT (`internal: true`) using shared platform JWKS, calls admin-api lookup/site endpoints
- **admin-api → workflow-app:** Kafka topic `workflow.execute`
- **workflow-app → EHR:** Direct raw vendor integration via `@hs/ehr-data-service` `ehrFactory.getService()` — no longer proxies through bridge-api (non-FHIR pivot). Workflow internally mints tokens via `TokenService`. Bridge-api still owns FHIR R4 normalization for external callers.

## Startup Order (all NestJS apps)
1. tracing.init() → 2. logger.init() → 3. secrets.loadSecrets() → 4. cache.init()+connect() → 5. db.init()+connect() → 6. httpClient.init() → 7. NestFactory.create() → 8. helmet + CORS + Swagger + pipes + interceptors → 9. listen()

## EHR Vendors (10)
Epic, Cerner, AthenaNet, NextGen, eClinicalWorks, DrChrono, Elation, Meditech, Medent, Greenways

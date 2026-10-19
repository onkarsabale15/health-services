# Health Services

A healthcare interoperability platform: one FHIR R4 API in front of many EHR vendors (Epic, Cerner, athenahealth, NextGen and others), plus an AI-assisted clinical decision support app, a workflow engine and an admin control plane.

> **Not for clinical use.** This is a reference implementation. It has not been certified, validated or audited for use with real patient data.

## What's inside

| Path | What it is | Dev port |
|---|---|---|
| `apps/bridge-api` | FHIR R4 gateway. Normalizes vendor EHR APIs, handles SMART on FHIR launch and token management, opt-in caching. | 3000 |
| `apps/admin-ui` | Admin console (Next.js) | 3001 |
| `apps/admin-api` | Control plane and OIDC/OAuth 2.0 issuer: organizations, applications, EHR config, users | 3002 |
| `apps/cds-app` | Clinical decision support service (LLM agents over FHIR data, care plan PDFs) | 3003 |
| `apps/workflow-app` | Reactive workflow execution engine (Kafka) | 3004 |
| `apps/workflow-ui` | Workflow builder (Next.js) | 3005 |
| `apps/cds-ui` | CDS front end (Next.js) | 3007 |
| `apps/mcp-app` | MCP server exposing FHIR tools to AI assistants | |
| `apps/terminology-sync` | Terminology data sync job | |
| `packages/*` | Shared `@hs/*` libraries: infra (cache, db, secrets), observability, EHR data service, generated API clients, mailer, AI helpers | |

See [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) for the product picture and [docs/](docs/) for architecture notes and plans.

## Tech stack

TypeScript, NestJS, Next.js, Turborepo with npm workspaces, Prisma on PostgreSQL, Redis/Valkey, Kafka, LangChain, OpenTelemetry.

## Getting started

Requirements: Node.js 22+, npm 10+, Docker.

```bash
# 1. Start Postgres and Redis
docker compose up -d postgres redis

# 2. Configure environment
cp .env.example .env            # then fill in values; see the comments in the file
# per-app overrides live in apps/*/.env.example

# 3. Install, generate the Prisma client and build
npm install
npm run build

# 4. Run everything in watch mode
npm run dev
```

Secrets (database URL, Redis URL, platform JWKS, LLM API keys) are read from Doppler when `DOPPLER_TOKEN` is set, or from AWS Secrets Manager / plain environment variables otherwise. The platform signing keys are expected under the secret name `HS_PLATFORM_JWKS`. Never commit real secrets; `.env` files are git-ignored.

Telemetry is exported over OTLP/HTTP to `OTEL_EXPORTER_OTLP_ENDPOINT` (browser apps: `NEXT_PUBLIC_OTEL_EXPORTER_OTLP_ENDPOINT`), defaulting to a local collector at `http://localhost:4318`.

## Common commands

```bash
npm run build      # build all apps and packages
npm run lint       # lint
npm run lint:fix   # lint and auto-fix
npm test           # run tests
```

Use `npx turbo run build --filter=@hs/<app>` to work on a single app.

## Contributing

Engineering conventions (security, caching, error handling, API design and more) are in [.claude/rules/](.claude/rules/README.md). Pull requests should pass build, lint and tests.

## License

[MIT](LICENSE)

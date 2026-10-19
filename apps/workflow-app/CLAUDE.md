# workflow-app — Hot-Zone Notes for AI

## What this app is

Reactive workflow executor. Subscribes to Kafka topics, runs DAG-based workflows defined in admin-api, calls bridge-api FHIR. Stateless executor — workflow definitions and execution status live in DB managed by admin-api.

## Module map

| Module | Purpose |
|---|---|
| `modules/auth/` | Service-to-service OAuth (PKCE) for workflow-ui sign-in |
| `modules/execution/` | DAG executor, node handlers, execution lifecycle |
| `modules/health/` | Health endpoint |
| `services/kafka-consumer.service.ts` | Subscribes to `workflow.execute` topic |
| `engine/dag-executor.ts` | Topological sort + node-by-node execution |

## DAG node types (8)

| Node | Purpose |
|---|---|
| `trigger` | Entry point — defines what fires the workflow |
| `raw-ehr` | Direct EHR call via `ehrFactory` from `@hs/ehr-data-service`. SiteData (creds + URLs) loaded via `@hs/admin-client` (HTTP → admin-api), NOT direct Prisma. Vendor service call goes direct to EHR (NOT through bridge-api). |
| `transform` | Pure data transformation |
| `condition` | Branching |
| `llm-prompt` | LLM call via `createModel(config)` from `@hs/ai` |
| `set-variable` | Mutate workflow context |
| `merge` / `loop` | Control flow |
| `output` | Workflow result |

## Trigger types (current)

- `manual` — admin invokes via UI
- `webhook` — external HTTP POST
- `schedule` — cron-like

**Phase 4 of master roadmap** adds `event` trigger type subscribing to clinical Kafka topics (`clinical.observation.created`, etc.). See `docs/plans/phase-4-clinical-events.md`.

## Two-hop architecture: admin-api for SiteData, ehrFactory for the EHR call

Workflow-app uses TWO independent paths to do its job:

1. **SiteData lookup (creds + URL config) → admin-api over HTTP** via `@hs/admin-client`'s `AdminClient` (instantiated with `serviceName: 'workflow-service'`). admin-api owns Prisma; workflow-app does NOT touch the DB directly. Same pattern as bridge-api and mcp-app. See `apps/workflow-app/src/services/ehr-client.service.ts` (`EhrClientService.getRawClient(siteId)`).

2. **Actual EHR call → vendor service directly** via `ehrFactory.getService(ehrName)`. Skips bridge-api's FHIR translation layer. Performance trade-off: workflow execution is async / batch / non-clinical-interactive, so the extra hop through bridge-api adds latency without value. Trade-off: workflow-app gets raw vendor payloads, not FHIR-uniform shapes.

For interactive clinical paths (cds-app SMART launch), always use bridge-api. Workflow-app is the batch path.

**Why not direct Prisma for SiteData?** Until May 2026 workflow-app used `db.getClient()` directly. Migrated to admin-client to:
- Centralize tenant boundary enforcement at admin-api
- Reduce the number of services with DB credentials
- Match bridge-api + mcp-app for consistency
The admin-api hop adds ~10ms cold; SiteData is cached for the session lifetime so it's amortized.

## Kafka topics

| Topic | Direction | Producer | Consumer |
|---|---|---|---|
| `workflow.execute` | inbound | admin-api (on user trigger) | workflow-app (this service) |
| `workflow.status` | outbound (planned) | workflow-app | admin-api (status updates) |
| `clinical.{resource}.{action}` (Phase 4+) | inbound | bridge-api | workflow-app + cds-app inbox |

## Execution lifecycle

1. Kafka message arrives on `workflow.execute` with `{ executionId, workflowId, applicationId, triggerInput }`
2. Load workflow definition from DB (admin-api owns the table)
3. Build DAG, topological sort
4. Execute nodes in order, each producing typed output for the next
5. Persist `WorkflowExecution.status` per node
6. Failure: mark execution failed; emit Sentry alert; status visible in admin-ui

## When adding a new node type

1. Define handler in `engine/dag-executor.ts` (extend the type union + handler dispatch)
2. Add typed input/output schema
3. Update workflow-ui canvas with node rendering + property panel
4. Update workflow validation (admin-api side)

## Common gotchas

- **Stateless executor.** Don't cache workflow state in workflow-app; always read from admin-api DB (via admin-client HTTP, not Prisma).
- **No direct Prisma.** Workflow-app stopped importing `db.getClient()` in May 2026. All persistent state lookups go through `@hs/admin-client` → admin-api.
- **Circular workflows are blocked at validation time** in admin-api; runtime assumes DAG.
- **LLM nodes need per-app keys.** `Application.llmConfig` is loaded by admin-api and resolved at execution start; key fetch goes through `@hs/infra/secrets`.
- **EHR token refresh is the vendor service's job.** `BaseEhrService` (in `@hs/ehr-data-service`) handles token caching + refresh internally via `@hs/infra`'s shared cache. Workflow-app's `raw-ehr` node just calls the vendor method and lets the service deal with auth.

## Observability

- Each execution emits OTel traces with `executionId` as the trace id.
- Per-node duration / status / output-size logged.
- Failed executions have full error in Sentry with workflowId + executionId tags.

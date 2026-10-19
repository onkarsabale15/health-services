# MCP Server v2 — ehr-data-service as Single Source of Truth

> **Status (2026-05-14):** active plan. Supersedes the original `mcp-server-v1.md` (deleted; recoverable via `git log --diff-filter=D -- docs/plans/`).
> **v2.1 pivot (2026-05-14, user-confirmed):** tool metadata is **generated at build time from typed, `@mcptool`-tagged service methods** — not hand-authored in `{vendor}.tools.ts`, not Zod. Authoring a tool = adding a documented, typed method. The Zod + `{vendor}.tools.ts` design (still described in git history of this file) is replaced; see "Schema strategy" and "How tool discovery works" below. The PR1 vertical slice already merged to `main` (`cerner.tools.ts`, `tools/types.ts`, `zod`/`zod-to-json-schema`, Zod `safeParse` in the executor) is **migrated, not extended** — see "What changes per service".
> **Working agreement:** approval ≠ start coding. Wait for explicit "start phase X" before touching non-plan files. Each PR (PR1–PR7) needs its own go-ahead.
> **Master roadmap:** [`cds-roadmap-2026-05.md`](./cds-roadmap-2026-05.md) Phase 1 — this plan is the deep-dive for that phase.

## Context

Direction (user-confirmed, May 2026):

> "MCP and workflow won't use bridge. They use ehr-data-service directly — same way bridge does. ehr-data-service methods carry their own descriptions/schemas and **double as tools**. Workflow and MCP both expose every registered ehr-data-service method."

Core idea: **`packages/ehr-data-service` becomes the single source of truth for vendor methods + their metadata.** Bridge-api, mcp-app, workflow-app are three independent consumers. Adding a method in ehr-data-service automatically appears in MCP (as a tool) and workflow (as a node type), without changing those services.

### Why MCP cannot be a transport over bridge-api

Bridge-api is the **FHIR R4 translation gateway** — it exposes only the subset of EHR capabilities that map cleanly to FHIR resources. Real EHR vendor APIs are wider:

| Surface | In bridge-api? | Examples |
|---|---|---|
| FHIR-mappable reads/writes | ✅ | Patient, Condition, Observation, Encounter, MedicationStatement |
| Vendor-proprietary endpoints | ❌ | Athena enterprise/department-scoped queries; Cerner non-FHIR Millennium endpoints; Epic MyChart/billing |
| Vendor-specific search modes | ❌ | Custom filters, vendor-only query parameters, change-feed APIs |
| Non-FHIR clinical data | ❌ | Vendor-specific document upload, imaging refs, scheduling shortcuts |
| Workflow/admin operations | ❌ | Bulk export, eligibility, vendor admin endpoints |

If MCP wrapped bridge-api, every operation in the bottom four rows would be unreachable to LLM agents — forever — because exposing them is not bridge-api's responsibility. **The full vendor surface lives only in `packages/ehr-data-service`.** That's the only viable source for an MCP catalog that covers what agents actually need.

Bridge-api is therefore a **peer consumer**, not a gateway. mcp-app and workflow-app are sibling consumers reaching deeper into the same shared layer.

### LangChain — where it does and doesn't belong

MCP has two sides; LangChain is appropriate on one of them and not the other.

| Side | Lives in | LangChain? | Why |
|---|---|---|---|
| **MCP server** (exposes tools to any client) | `apps/mcp-app/`, `packages/ehr-data-service/` | ❌ Never | LangChain is an agent (client) framework. Putting it on the server side would couple the catalog to one specific consumer and pull NestJS-incompatible weight into ehr-data-service. mcp-app uses `@modelcontextprotocol/sdk` directly. |
| **MCP client / agent** (consumes tools, runs reasoning loop) | `apps/cds-app/` Phase 2 Co-Pilot | ✅ On the table | Cds-app is where an actual agent loop runs. Two viable options for Phase 2 — pick one then. |

Phase 2 Co-Pilot will choose between:

- **Option A — LangChain + `@langchain/mcp-adapters`.** Reuses cds-app's existing LangChain engine code; the adapter wraps mcp-app's catalog into `DynamicStructuredTool`s automatically. Familiar pattern. Trade-offs: known TS issues with `DynamicStructuredTool` (existing `as any` casts), heavier dep footprint, LangChain's API churn.
- **Option B — Anthropic SDK native tool-use + `@modelcontextprotocol/sdk` client.** Lighter, more direct, no `as any` workarounds. Means rewriting cds-app's existing LangChain agent code in Phase 2.

Decision is Phase 2's. **PR1 doesn't pick.** What PR1 locks: mcp-app and ehr-data-service have zero LangChain dependency. Whatever Phase 2 chooses on the client side is independent.

## Research findings (May 2026)

| Source | Key finding |
|---|---|
| [AWS HealthLake MCP Server](https://aws.amazon.com/blogs/industries/building-healthcare-ai-agents-with-open-source-aws-healthlake-mcp-server/) | Production reference — vendor-specific tools, dynamic discovery, no descriptor catalog |
| [WSO2 FHIR MCP](https://github.com/wso2/fhir-mcp-server) | OSS, similar pattern — server-specific tools, schemas per method |
| [@modelcontextprotocol/sdk](https://modelcontextprotocol.io/specification/2025-11-25) | Tool manifest = name + description + inputSchema. Per-server, not per-package. |
| [arxiv.org/2506.13800 — MCP-FHIR Framework](https://arxiv.org/html/2506.13800v1) | Academic reference for MCP+FHIR — confirms vendor-specific tool catalogs are the norm |
| [Visor MCP server lessons](https://www.visor.us/blog/lessons-learned-developing-visors-mcp-server/) | 2026 production lessons — keep MCP servers thin transports over typed services |
| [ts-json-schema-generator (vega)](https://github.com/vega/ts-json-schema-generator) | Recommended over `typescript-json-schema` (maintenance mode). AST-based (preserves type aliases), JSDoc `extended` mode emits per-field descriptions into the schema. Picked for TS-type → JSON Schema. |
| [ts-morph](https://ts-morph.com/details/documentation) | TS Compiler API wrapper. Walks class methods + reads custom JSDoc tags (`@mcptool`) **without decorators** — fits the NestJS/decorator-free constraint. Picked for method discovery + description extraction. |
| [Ajv standalone validation](https://ajv.js.org/standalone.html) | Compiles JSON Schema → standalone validator functions at build time. Zero runtime Ajv init; replaces Zod's `safeParse`. |
| [AjvMCPServer / dynamic tool generation](https://github.com/modelcontextprotocol/typescript-sdk) | The MCP TS SDK prefers Zod, but documents a JSON-Schema-+-Ajv path for **dynamically generated** tool catalogs. Our catalog is already hand-built (not via SDK `registerTool`), so dropping Zod for generated-schema + Ajv is consistent with that pattern. |

**Verdict:** the 2026 best practice for a *large, machine-maintained* vendor surface is **build-time codegen** of the tool catalog from typed method signatures + doc comments — not a hand-maintained registry. Hand-written registries (the prior v2 design) are appropriate for a handful of tools; they don't scale to 10 vendors × dozens of methods without per-tool authoring drift. mcp-app and workflow-app consume the **generated** catalog; ehr-data-service ships it as a build artifact.

## Hard constraints (non-negotiable)

1. **`packages/ehr-data-service/` stays NestJS-free.** No NestJS imports, no decorators, no DI. Pure TypeScript + HTTP client. **No Zod runtime dependency** — tool input schemas are generated at build time (`ts-json-schema-generator`) and validated at runtime with a generated Ajv validator; the generator (`ts-morph`, `ts-json-schema-generator`, `ajv`) is a **devDependency** that runs in the build, not shipped runtime weight. All consumers (bridge-api, mcp-app, workflow-app) wire DI on their side.

2. **No regression of existing behavior.**
   - Bridge-api FHIR REST surface unchanged — same paths, same shapes, same status codes.
   - Bridge-api's existing consumption of ehr-data-service unchanged — it does NOT need to migrate to the new registries.
   - `@hs/bridge-client` SDK regen produces zero diffs in existing operations.
   - cds-app, admin-api, workflow-app's existing functionality continues to work.
   - Existing tests pass.

3. **mcp-app and workflow-app do NOT depend on `@hs/bridge-client` or call bridge-api.** They depend ONLY on `@hs/ehr-data-service`. Verified by `grep -rn "@hs/bridge-client\\|bridge-api" apps/mcp-app/src/` returning zero (same for workflow-app's new registry-driven path).

4. **bridge-api stays the FHIR R4 gateway.** It continues to wrap ehr-data-service and translate to FHIR for cds-app and SMART consumers. It does NOT consume the new tool registries — its translation logic is FHIR-shaped, not method-shaped.

## Architecture

```
                    ┌────────────────────────────────────┐
                    │  External MCP clients               │
                    │  (Claude Desktop, custom agents)    │
                    └─────────────────┬──────────────────┘
                                      │ MCP Streamable HTTP
                                      ▼
       ┌────────────────┐    ┌────────────────────┐    ┌───────────────────┐
       │  cds-app       │    │  apps/mcp-app      │    │  apps/workflow-app│
       │  (FHIR-flavored│    │  (vendor tools)    │    │  (DAG nodes)      │
       │   SMART app)   │    │                    │    │                   │
       └───────┬────────┘    └──────────┬─────────┘    └────────┬──────────┘
               │ FHIR REST              │                        │
               ▼                        │                        │
       ┌────────────────┐               │                        │
       │  bridge-api    │               │                        │
       │  (FHIR R4)     │               │                        │
       └───────┬────────┘               │                        │
               │                        │                        │
               ├────────┬───────────────┴────────────────────────┘
               │        │
               ▼        ▼
       ┌──────────────────────────────────────────────────────────────┐
       │  packages/ehr-data-service                                   │
       │  ─────────────────────────────────────────                   │
       │  Per-vendor service class (existing):                        │
       │    src/vendors/cerner/cerner.service.ts                      │
       │    src/vendors/athenanet/athenanet.service.ts                │
       │    ... (10 vendors)                                          │
       │                                                              │
       │  Tool source = the method itself (NO tools.ts/schemas.ts):  │
       │    src/vendors/cerner/cerner.service.ts                      │
       │      /** Read a Cerner Patient by ID. ...                    │
       │       *  @mcptool */                                         │
       │      getPatient(c: EhrClientConfig,                          │
       │                  p: GetPatientParams)                        │
       │        : Promise<CernerPatient>                              │
       │    src/vendors/cerner/cerner.params.ts                       │
       │      export interface GetPatientParams {                     │
       │        /** Cerner Patient resource ID. */ id: string }       │
       │                                                              │
       │  NEW: build-time codegen (devDep, runs in build):           │
       │    scripts/gen-tools.ts                                      │
       │      ts-morph  → find @mcptool methods, read TSDoc + the    │
       │                   single params type name + return type      │
       │      ts-json-schema-generator → params type → JSON Schema   │
       │      ajv (standalone) → JSON Schema → validator fn          │
       │      emits: src/tools/tools.generated.ts                     │
       │        allVendorTools: Record<EhrName, ToolDescriptor[]>     │
       │        where ToolDescriptor = { name, description,           │
       │          jsonSchema, validate, vendorMethod }                │
       └──────────────────────────────┬──────────────────────────────┘
                                      │
                                      ▼
                              EHR vendor APIs
```

## Schema strategy — generated from typed methods (no Zod, no hand-written registry)

**Decision (2026-05-14, user-confirmed):** the tool catalog is generated at build
time from the service methods themselves. Authoring a tool = writing a typed,
documented, `@mcptool`-tagged method. There is no `{vendor}.tools.ts`, no
`{vendor}.schemas.ts`, and no Zod.

| Concern | Mechanism | Why |
|---|---|---|
| **Which methods are tools** | `@mcptool` JSDoc tag on the method | Not every method is a tool (`refreshToken`, pagination internals). One tag line, co-located, greppable. No central allowlist to drift. |
| **Tool name** | Derived: `{ehrName}_{methodName}` | `getPatient` → `cerner_getPatient`. Cmd+Click from the name lands on the function. |
| **Tool description** | Method's TSDoc summary | The doc comment you'd write anyway *is* the LLM description. `ts-morph` reads it. |
| **Tool input schema (MCP `tools/list`)** | `ts-json-schema-generator` on the method's **single named params type** | TS types are erased at runtime — codegen at build time emits JSON Schema; per-field JSDoc on the params interface becomes per-field schema `description`. |
| **Runtime input validation** | Generated **Ajv** validator (standalone, compiled at build) | LLM can send malformed args to a live PHI system. Validate before the EHR call. No runtime Zod/Ajv init. |
| **Vendor output shape** | The method's TS return type (`Promise<CernerPatient>`) | Plain TS interfaces in `{vendor}.types.ts`; LLM consumes raw JSON. Unchanged from v2. |

**Why codegen over the hand-written Zod registry:** the registry was ~10 lines
of metadata *per tool* duplicating the method signature in Zod. Across 10
vendors × dozens of methods that is hundreds of lines that drift from the
implementation. Generating from the typed method makes the signature the single
source of truth — a renamed param can't desync the schema because there is no
second declaration.

**The authoring rule (non-breaking by design):** the existing service method
signatures and `EhrResponse<T>` return type are **NOT changed** — bridge-api
calls them positionally and workflow-app calls them duck-typed via DB-stored
DAGs (`(svc as any)[method](config, ...args)`), so a signature change is an
un-fixable runtime regression PR5 owns, not PR1. Instead a `@mcptool` method
declares its schema source with a second tag:

```
/**
 * <TSDoc summary — becomes the LLM description>
 * @mcptool
 * @mcpparams GetPatientParams
 */
async getPatient(config: EhrClientConfig, id: string): Promise<EhrResponse<CernerPatient>> { … }
```

`GetPatientParams` is a **named, JSDoc'd interface** in `{vendor}.params.ts`
whose property names equal the method's post-`config` parameter names (here:
`id`). The codegen generates the schema from that interface and a dispatcher
that maps the validated params object onto the method's positional args
(`svc.getPatient(config, p.id)`), then unwraps `.data` — exactly what the old
Zod `invoke` did by hand. For a method whose single post-`config` parameter is
itself an object (`searchPatients(config, params: Record<string,string>)`), the
params interface describes that object's fields and the whole validated object
is passed through. The codegen **hard-fails** if `@mcptool` has no TSDoc
summary, no `@mcpparams`, the named interface is missing, or its property set
can't be mapped to the method's parameters. You write an interface + two tag
lines on the method you already have — no Zod, no schema, no signature change.

## How tool discovery works (build-time codegen)

```typescript
// packages/ehr-data-service/src/vendors/cerner/cerner.params.ts
/** Inputs for cerner_getPatient. */
export interface GetPatientParams {
  /** Cerner Patient resource ID — opaque string, e.g. from a prior search. */
  id: string;
}
```

```typescript
// packages/ehr-data-service/src/vendors/cerner/cerner.service.ts
// SIGNATURE UNCHANGED — only two JSDoc tags added. bridge-api + workflow-app
// keep calling this exactly as before.
/**
 * Read a single Cerner Patient by ID. Returns the raw FHIR R4 Patient —
 * name, identifiers, birthDate, gender, address, telecom. Use when you
 * already have a Patient ID; for name/DOB lookup use cerner_searchPatients.
 * @mcptool
 * @mcpparams GetPatientParams
 */
async getPatient(config: EhrClientConfig, id: string): Promise<EhrResponse<CernerPatient>> {
  return this.makeAuthenticatedRequest(config, { url: `${base}/Patient/${id}`, method: 'get' });
}
```

```typescript
// packages/ehr-data-service/scripts/gen-tools.ts   (devDependency, runs in build)
// 1. ts-morph: load the project, find every method with an @mcptool JSDoc tag.
//    For each: vendor (from folder), methodName, TSDoc summary (description),
//    the @mcpparams interface name, the method's post-config parameter list.
//    Hard-fail the build if @mcptool has no TSDoc summary, no @mcpparams, the
//    named interface is missing, or its properties can't map to the params.
// 2. ts-json-schema-generator: params type → JSON Schema (jsonSchema7 target,
//    JSDoc=extended so field doc comments become field descriptions).
// 3. ajv standalone: JSON Schema → a compiled validate() function (string).
// 4. Emit src/tools/tools.generated.ts:
//      export const allVendorTools: Record<EhrConfigName, ToolDescriptor[]>
//    ToolDescriptor carries an `invoke(svc, config, validatedInput)` thunk
//    that maps the params object onto the method's positional args and
//    unwraps `.data` — generated, not hand-written.
```

```typescript
// packages/ehr-data-service/src/tools/types.ts   (hand-written, stable)
export interface ToolDescriptor {
  name: string;                               // `${ehrName}_${methodName}`
  description: string;                        // from method TSDoc
  jsonSchema: Record<string, unknown>;        // generated; sent in tools/list
  validate: (input: unknown) => { ok: true } | { ok: false; errors: string };
  vendorMethod: string;                       // method key (audit/debug)
  // generated dispatcher: positional-arg mapping + `.data` unwrap baked in
  invoke: (svc: unknown, config: EhrClientConfig, input: unknown) => Promise<unknown>;
}
```

- The committed artifact is `src/tools/tools.generated.ts`. It is regenerated by
  the package build (turbo `db:generate`-style task, `cache: false`) and **also
  checked in** so consumers building without the codegen step still resolve it;
  CI fails if `git diff` on it is non-empty after regen (drift guard).
- Dispatch (`executor`): `const d = catalog.resolve(name); if (!d.validate(input).ok) 400; return d.invoke(ehrFactory.getService(ehrName), config, input)` — the generated `invoke` does the positional-arg mapping + `.data` unwrap.
- `EhrConfigName` (the discriminated-union vendor key, already exported) is the
  catalog key. Vendors with no `@mcptool` methods yet → empty array, no error.

### Why this works

- **Single source of truth is the method.** Method + TSDoc + `@mcpparams` interface fully determine name, description, schema, validation, dispatch. The params interface is the only second declaration; codegen asserts it maps to the real parameters, so it can't silently drift.
- **Authoring cost = the method.** Add a typed, documented, `@mcptool` method. No registry file, no Zod, no schema by hand.
- **NestJS-free at runtime.** Generator deps (`ts-morph`, `ts-json-schema-generator`, `ajv`) are **devDependencies**; the shipped artifact is plain data + a compiled validator string. Zod removed entirely.
- **Build catches drift.** Rename a param → schema regenerates; rename a method → `vendorMethod` dispatch key changes and TS dispatch test fails; missing TSDoc / wrong signature → codegen hard-fails the build.
- **Bridge-api opt-out unchanged.** Bridge-api keeps calling service classes directly and imports the same `{vendor}.types.ts` interfaces. The `@mcptool` tag + params types are additive; bridge-api ignores them.
- **Per-session vendor filtering unchanged** — still load-bearing; the catalog is keyed by `EhrConfigName`.

## What changes per service

### `packages/ehr-data-service/` — bulk of the work

| Change | Detail |
|---|---|
| Add devDeps | `ts-morph`, `ts-json-schema-generator`, `ajv` — **devDependencies only** (build-time codegen). No `zod` runtime dep. |
| Remove | `src/vendors/cerner/cerner.tools.ts`; `ToolDefinition`/`ToolRegistry` in `src/tools/types.ts`; the `cernerTools`/`allVendorRegistries` exports in `src/tools/index.ts`. **`zod` stays** — `src/core/dto/auth-context.dto.ts` uses it independently of tools (pre-existing, unrelated). `zod-to-json-schema` was never an ehr-data-service dep (mcp-app only). (Tool-path artifacts were merged in the PR1 vertical slice — **migrated**, see note below.) |
| `scripts/gen-tools.ts` | NEW — the codegen: ts-morph scan → ts-json-schema-generator → ajv standalone → emits `src/tools/tools.generated.ts`. Hard-fails on convention violations. |
| `src/tools/types.ts` | REWRITTEN — hand-written, stable `ToolDescriptor` interface only (no generics, no Zod). |
| `src/tools/tools.generated.ts` | NEW — generated + **checked in**; `allVendorTools: Record<EhrConfigName, ToolDescriptor[]>`. CI drift guard: regen + `git diff --exit-code`. |
| `src/tools/index.ts` | Re-exports `allVendorTools` + `ToolDescriptor`. |
| Per vendor: `{vendor}.params.ts` | NEW — named, JSDoc'd input interfaces (`GetPatientParams`, …). The codegen's schema source. |
| Per vendor: `{vendor}.types.ts` | UNCHANGED role — plain TS output interfaces, imported by bridge-api mappers + method return types. |
| `package.json` build script | Add a `gen:tools` step before `tsc` (turbo task, `cache: false`, like `db:generate`). |
| Service classes | **Signatures + `EhrResponse<T>` return UNCHANGED.** Only additive: a TSDoc summary + `@mcptool` + `@mcpparams XxxParams` tags on the methods we expose. Zero bridge-api / workflow-app changes (no signature break to propagate). |

**Migration of the already-merged PR1 slice:** `cerner.tools.ts`, the Zod
`ToolDefinition`/`ToolRegistry` types, the `zod`/`zod-to-json-schema` deps,
mcp-app's `zodToJsonSchema` catalog build, and the executor's Zod `safeParse`
are all **deleted and replaced** by the codegen path — not kept alongside it.
`docs/mcp-claude-desktop.md` and `apps/mcp-app/CLAUDE.md` are updated to the
generated-catalog model.

### `apps/mcp-app/` — NEW

| File | Purpose |
|---|---|
| `package.json` | Depends on `@hs/ehr-data-service`, `@hs/bootstrap`, `@hs/observability`, `@hs/config`, `@modelcontextprotocol/sdk`. **No `zod`, no `zod-to-json-schema`.** **NOT** `@hs/bridge-client`. |
| `src/main.ts` | Boots NestJS app + MCP transports |
| `src/app.module.ts` | Imports `CatalogModule`, `ExecutorModule`, `TransportsModule`, `HealthModule` |
| `src/modules/catalog/catalog.service.ts` | At boot, loads the **already-generated** `allVendorTools` from `@hs/ehr-data-service` (no Zod→JSON-Schema conversion — `jsonSchema` is shipped). Indexes by name + vendor. |
| `src/modules/catalog/catalog-filter.service.ts` | Per-session: resolves vendor via `SessionContextService` (siteId → SiteData.ehrName) → returns only that vendor's `ToolDescriptor[]` |
| `src/modules/executor/executor.service.ts` | On `tools/call`: `catalog.resolve(name)` → `descriptor.validate(input)` (generated Ajv) → `ehrFactory.getService(ehrName)[descriptor.vendorMethod](config, input)` |
| `src/modules/executor/vendor-pool.service.ts` | Holds a per-tenant pool of vendor service instances (re-uses `ehrFactory` from ehr-data-service the same way workflow-app does today) |
| `src/modules/transports/mcp-server.service.ts` | Builds the `@modelcontextprotocol/sdk` MCP `Server` for a session (wires `tools/list` + `tools/call`). |
| `src/modules/transports/http.controller.ts` | **MCP Streamable HTTP** transport — `POST/GET/DELETE /api/mcp` (JSON-RPC 2.0, stateful sessions via `Mcp-Session-Id`, `enableJsonResponse`). The SDK's `StreamableHTTPServerTransport` handles framing + lifecycle. Per-request `Authorization: Bearer`. **stdio is NOT supported** (decision 12). |
| `src/modules/health/health.module.ts` | `/health` endpoint |
| `src/__tests__/` | Catalog build, filter, executor (mocked vendor service), transport smoke tests |
| `docs/mcp-claude-desktop.md` | Sample `claude_desktop_config.json` |
| `CLAUDE.md` | Module CLAUDE.md (per Phase 0 pattern) |

### `apps/workflow-app/` — small additive change (PR5, not PR1)

| File | Change |
|---|---|
| `src/engine/dag-executor.ts` | Extend the existing `raw-ehr` node handler to consume the generated `allVendorTools` for typed method dispatch + the generated Ajv validator. Backwards-compatible: existing untyped `raw-ehr` calls still work. |
| `src/modules/registry/registry.service.ts` | NEW — exposes the catalog over an internal endpoint so workflow-ui can populate the method dropdown with descriptions + schemas (autocomplete UX) |
| `apps/workflow-ui/.../RawEhrNodeProperties.tsx` | Extend to fetch the catalog and show typed input fields with descriptions |

### `apps/bridge-api/` — UNCHANGED

Bridge-api continues to use `ehrFactory.getService(ehrName)` exactly as it does today. It does NOT consume the new registries. Its FHIR translation logic doesn't need them. (One small additive: vendor mappers may import vendor types from ehr-data-service — strict deduplication, no behavior change.)

### `apps/cds-app/` — UNCHANGED at PR1

Phase 2 (Co-Pilot) is the MCP **client** layer — that's where an agent loop actually runs. Two viable options (LangChain+adapters or Anthropic SDK native — see Context section). PR1 makes no client-side commitment.

## Implementation phases

| PR | Scope | Acceptance | Effort |
|---|---|---|---|
| **PR1** | **The codegen toolchain + Cerner read slice.** ehr-data-service: `scripts/gen-tools.ts` (ts-morph → ts-json-schema-generator → ajv standalone), stable `ToolDescriptor` type, generated+checked-in `tools.generated.ts`, turbo `gen:tools` build task. Migrate the merged Zod slice away. Cerner `cerner.params.ts` + `@mcptool`/`@mcpparams` TSDoc tags on 8 read methods (getPatient, searchPatients, getCondition, searchConditions, getAllergy, getObservation, getEncounter, getAppointment) — **signatures unchanged**. mcp-app consumes the generated catalog (no Zod). | codegen hard-fails on a convention violation (proven by a deliberate bad fixture); `tools.generated.ts` regen is diff-clean in CI; mcp-app boots; `tools/list` returns 8 Cerner tools via stdio AND HTTP with field-level descriptions sourced from params-interface JSDoc; `tools/call cerner_getPatient {id}` returns raw Cerner Patient JSON; malformed input rejected by the generated Ajv validator with a 400 before any EHR call; **bridge-api + workflow-app untouched** — full no-regression suite + bridge-client SDK regen show zero diff | ~2.5 weeks |
| **PR2** | **Full Cerner surface — dumb vendor-native (decision A/11, 2026-05-14; scope expanded from "Condition writes" to "all Cerner methods" by user request).** Tag every public `CernerService` method (`getToken` excluded — internal auth) with `@mcptool`/`@mcpparams` + a `cerner.params.ts` interface; signatures unchanged. **34 tools** across 13 resources (Patient, Appointment, Encounter, Coverage, Condition, AllergyIntolerance, MedicationRequest, MedicationStatement, Observation, DocumentReference, Practitioner, Communication, ServiceRequest) — reads (`get*`/`search*`), creates (`create*`), and `updateCondition`. Cerner's native format IS FHIR R4, so write tools take a FHIR body (a DrChrono tool would take DrChrono JSON — per-vendor native, no normalization). No capability validation in the MCP path (rule-16 guardrails stay cds-app-internal); write-tool descriptions encode the Cerner constraints (Condition: `note` create-only/silently-discarded on PUT, `If-Match` required, allowedStates, max-1-category, encounter-diagnosis restrictions). `If-Match` is an explicit `updateCondition` param. MedicationStatement tools carry a "Millennium generally unsupported — prefer MedicationRequest" note. | `tools/list` shows 34 Cerner tools; generated Ajv rejects malformed write bodies (missing `resourceType`) with 400 before the EHR call; `updateCondition` dispatch maps `{id,data,options}` → positional + `If-Match` passthrough (verified); codegen drift-clean + deterministic; full `build lint` 37/37; **bridge-api/workflow-app untouched** (JSDoc-only change). Sandbox round-trip = manual smoke (no creds in CI). | done |
| **PR3** | Epic registry (reads + writes) | Epic tools work via mcp-app | 1 week |
| **PR4** | Athena registry (proprietary surface + FHIR) | Athena dual-API tools work via mcp-app | 2 weeks |
| **PR5** | Workflow-app integration: `raw-ehr` node consumes the generated catalog; workflow-ui shows a typed method picker with descriptions | New workflows can be authored against any `@mcptool` vendor method with autocompletion + the generated Ajv validation | 1 week |
| **PR6** | Hardening — rate limiting, retries, structured errors, observability across all transports; shared/invalidating SiteData cache (replaces the 30s memo) | 100 RPS load test green | 1 week |
| **PR2.5 — MCP application management + managed auth** ✅ **CODE DONE** (live re-test pending real backend creds; decisions 13–15) | **No new admin-api endpoints** — reused existing ones. Added `MCP` to `AppType` (enum + migration), `APP_TYPE_DEFINITIONS`, and `VALID_APP_TYPES`/createable types (system-only: `allowedEhrAppTypes: ['system']`, `allowedGrantTypes: ['client_credentials']`). Create via existing `POST /applications`; EHR access via existing `upsertEhrAccess` (`ehrAppType: system`); token via existing `POST /oauth/token` `client_credentials` → API token; site via existing `adminClient.getSite`. Replaced mcp-app's dev `Bearer {"siteId"}` with a real **`McpAuthService`** that JWKS-verifies the API token via the **shared `@hs/infra` `platformJwks.verifyApiToken`** (extracted from bridge-api's `DualAuthGuard`, which now consumes it too — one verifier, no copy), requires `app_type === 'MCP'`, reads the scope from an **`X-Site-Id` header** (not the token), and checks the token's org + `ehr_access` against the resolved site. admin-api `upsertEhrAccess` now also rejects launch modes outside the app type's `allowedEhrAppTypes`; admin-ui's EHR-add dropdown filters modes by the same (so an MCP app offers system-only). | An MCP app is created in admin (type `MCP`, system Cerner access with backend creds), gets an API token via `/oauth/token`, and Claude Code/Gemini authenticate with THAT token + `X-Site-Id` (not a raw siteId); mcp-app verifies it + authorizes the site; `cerner_getPatient` succeeds against a real backend app. | 1 week |
| **PR7** | OAuth 2.1 + **Dynamic Client Registration** for third-party MCP clients (the in-house API-token auth lands in PR2.5) | Non-first-party MCP clients can self-register | 1 week |

**Total: ~10.5 weeks** (PR1 +0.5 wk codegen, +1 wk PR2.5 managed auth — paid once). Recurring marginal cost for new tools after PR4: **a typed, documented, `@mcptool`-tagged method — nothing else, nowhere else**. It surfaces in MCP automatically at build time and (post-PR5) in workflow.

## Existing utilities to reuse

| Utility | Where | Reuse for |
|---|---|---|
| `ehrFactory` | `packages/ehr-data-service/src/factory.ts` | mcp-app's `vendor-pool.service.ts` (mirrors workflow-app's pattern at `apps/workflow-app/src/services/ehr-client.service.ts`) |
| Vendor service classes | `packages/ehr-data-service/src/vendors/*` | Underlying methods called by registries |
| `@hs/bootstrap` | `packages/bootstrap/` | mcp-app's NestJS startup |
| `@hs/observability` | `packages/observability/` | Logger + tracing in mcp-app |
| `@hs/config` | `packages/config/` | EhrName enum, transport flags |
| `@modelcontextprotocol/sdk` | NEW dep in mcp-app | MCP protocol layer (`Server` + `StreamableHTTPServerTransport`) |
| Internal-token mint | `apps/admin-api/src/modules/workflow/internal-token.controller.ts` | Stdio transport's service-bound auth path |

## Verification (PR1 acceptance)

### Functional

| Item | Pass criterion |
|---|---|
| ehr-data-service builds | `npm run check:ehr-data-service` green; `gen:tools` runs as part of build; `tools.generated.ts` compiles |
| Codegen drift guard | Re-running `gen:tools` produces **zero** `git diff` on `tools.generated.ts` (CI enforces) |
| Codegen hard-fails on violations | A fixture `@mcptool` method with no TSDoc / missing `@mcpparams` / a params interface whose properties don't map to the method's parameters fails the build with a clear message (asserted by a codegen unit test) |
| No Zod in the tool path | `grep -rn "from 'zod'\\|zod-to-json-schema" packages/ehr-data-service/src/tools apps/mcp-app/src` returns **zero**; `zod`+`zod-to-json-schema` absent from `apps/mcp-app/package.json`. (`zod` legitimately remains in `ehr-data-service` for the pre-existing `core/dto/auth-context.dto.ts` — out of scope.) |
| Field-level descriptions | `tools/list` schema for `cerner_getPatient` has `properties.id.description` sourced from the `GetPatientParams.id` JSDoc |
| Bridge-api type reuse unchanged | `apps/bridge-api/src/services/{vendor}/{vendor}.mapper.ts` still imports vendor output types from `@hs/ehr-data-service` (no duplicated interfaces) |
| mcp-app boots | `npm run dev` starts mcp-app; logs show "MCP catalog loaded { tools: N, vendors: 1 }" |
| `tools/list` via Streamable HTTP | `initialize` (POST /api/mcp) returns an `Mcp-Session-Id`; `tools/list` with that header returns the Cerner catalog with LLM-readable descriptions |
| `tools/call cerner_getPatient` | Executes against Cerner sandbox via `ehrFactory` → `CernerService.getPatient`; returns raw Cerner Patient JSON |
| **Per-session vendor filtering (load-bearing)** | A Cerner-tenanted session sees ONLY Cerner tools in `tools/list` — never Athena/Epic/etc. when those land in later PRs. This is mandatory, not nice-to-have: with vendor-specific tools (FHIR + proprietary), the catalog without filtering becomes 200+ tools for an LLM that only operates in one tenant. Test: switch the tenant's vendor in admin-api → next session's `tools/list` returns the new vendor's catalog. |
| Auth (HTTP) | Missing/invalid bearer → JSON-RPC `-32001`; valid → session opens and tool calls succeed |
| Gemini CLI integration | Per `apps/mcp-app/docs/smoke-test.md`, Gemini CLI (`httpUrl` in `~/.gemini/settings.json`) lists + calls the tools |
| Build + lint | `npm run check:mcp-app` green |

### Non-regression (the hard constraints)

| Item | Pass criterion |
|---|---|
| ehr-data-service NestJS-free | `grep -rn "@nestjs" packages/ehr-data-service/src/` returns **zero** matches |
| Bridge-api unchanged | All FHIR REST endpoints respond identically before + after PR1 (request/response shape, status codes, headers) |
| bridge-client SDK | Re-run openapi-typescript generation; **zero diff** in `packages/bridge-client/src/generated/` |
| Existing test suites | `npm run check` (full repo) green |
| mcp-app does NOT use bridge-api | `grep -rn "@hs/bridge-client\\|bridge-api" apps/mcp-app/src/` returns zero |
| workflow-app's direct path | Manual smoke: trigger a workflow with a `raw-ehr` node; existing path still works |
| cds-app | Manual smoke: launch CDS via Cerner sandbox; bridge-client consumption unchanged |
| SSO Phase C | Manual smoke: end-user login + SMART launch + capability gate — all unchanged |

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| **mcp-app exposes the FULL vendor surface (FHIR + proprietary)** | Necessary by design — bridge-api's FHIR subset is too narrow for clinical AI agents. Trade-off: vendor-specific tool shapes (no FHIR uniformity). Mitigated by mandatory per-session vendor filtering (a single tenant only ever sees one vendor's catalog). |
| **LangChain scope** | OFF on the MCP server side (mcp-app, ehr-data-service — never). OPEN on the client/agent side (cds-app Phase 2 Co-Pilot — picks at Phase 2 between LangChain+`@langchain/mcp-adapters` or Anthropic SDK native + MCP client). PR1 makes no client-side commitment. |
| **Codegen toolchain fragility** (TS upgrades break `ts-morph`/`ts-json-schema-generator`) | Pin all three devDeps. `tools.generated.ts` is **checked in**, so a generator break can't break consumer builds — it only fails the regen drift-guard CI job, caught before merge. Generator isolated to one `scripts/gen-tools.ts`. |
| **TSDoc / tag discipline** | The codegen *hard-fails the build* on a `@mcptool` method missing a TSDoc summary, missing `@mcpparams`, a missing/un-exported params interface, or a params interface whose property set can't map to the method's post-`config` parameters. Enforced mechanically, not by review. |
| **Outputs are plain TS interfaces** | Unchanged from v2: TS interfaces are erased at runtime — fine because the LLM consumes raw EHR JSON and MCP only requires *input* schemas in `tools/list`. No output schema generated. |
| **Method↔tool drift** | The `@mcpparams` interface is the one declaration that can drift from the real parameters — the codegen asserts the mapping at build time and hard-fails on mismatch, so a renamed parameter or interface field breaks the build, not runtime. The drift guard catches an un-regenerated `tools.generated.ts` checkin. |
| **JSON Schema draft** | `ts-json-schema-generator` emits draft-07 (same as the prior `zod-to-json-schema` `jsonSchema7` target — no behavior change for Claude, which accepts draft-07 inputSchemas). 2020-12 only if a future MCP client requires it; isolated to the generator config. |
| **Generated Ajv validator trust** | Ajv standalone compiles the schema to a pure validator function at build; covered by an executor test feeding known-bad input and asserting a 400 before any EHR call. |
| **Hand-rolling MCP transport glue** | ~500 lines across `transports/` + executor. Reference implementations exist (AWS HealthLake MCP, WSO2). Pin `@modelcontextprotocol/sdk`. |
| **MCP protocol churn** | Pin `@modelcontextprotocol/sdk` version. Isolate transport code in `apps/mcp-app/src/modules/transports/`. |
| **Concurrent EHR calls / connection pooling** | `vendor-pool.service.ts` follows workflow-app's pattern (per-tenant `ehrFactory.getService` instances, keep-alive). |
| **Bridge-api stays alongside MCP — duplication?** | They serve different consumers: bridge-api for FHIR-flavored REST (cds-app, SMART), mcp-app for raw-vendor agent tools (Claude Desktop, custom agents). Different shapes for different needs. No code duplication — both use ehr-data-service classes underneath. |
| **Workflow-app integration deferred to PR5** | Existing `raw-ehr` node keeps working unchanged in PR1–PR4. PR5 adds the typed registry consumption as a non-breaking enhancement. |

## Resolved decisions

1. **mcp-app + workflow-app use ehr-data-service directly, NOT bridge-api** ✅ — non-negotiable: ehr-data-service holds the FULL vendor surface (FHIR + proprietary). Bridge-api covers only the FHIR-mappable subset.
2. **Tool catalog is generated at build time from typed `@mcptool` methods** ✅ (user-confirmed 2026-05-14) — no `{vendor}.tools.ts`, no hand-written registry. Authoring a tool = a typed, documented, `@mcptool`-tagged method. Supersedes the prior "ehr-data-service grows tool registries" decision.
2a. **Service method signatures are NOT changed** ✅ (2026-05-14 — discovered during PR1 mapping: methods return `EhrResponse<T>` and workflow-app dispatches them duck-typed from DB-stored DAGs, so a signature change is an un-fixable runtime regression PR5 owns). A `@mcptool` method adds only TSDoc + `@mcptool` + `@mcpparams XxxParams` tags; the codegen maps the validated params object onto the existing positional args and unwraps `.data`. Convention mechanically enforced (codegen hard-fails on missing TSDoc / `@mcpparams` / unmappable interface).
3. **ehr-data-service stays NestJS-free *and* Zod-free at runtime** ✅ — codegen devDeps (`ts-morph`, `ts-json-schema-generator`, `ajv`) run in the build; the shipped artifact is plain data + a compiled validator.
3a. **No Zod in the tool path** ✅ — tool inputs: generated JSON Schema + generated Ajv validator; outputs: plain TS interfaces. (`zod` stays in ehr-data-service only for the unrelated pre-existing `auth-context.dto.ts`; mcp-app is fully Zod-free.)
3b. **`tools.generated.ts` is checked in with a CI drift guard** ✅ — consumers build without the codegen step; CI fails on un-regenerated drift.
4. **bridge-api AND workflow-app are unchanged** — zero lock-step changes, because no service signature changes (decision 2a). The `@mcptool`/`@mcpparams` tags are inert JSDoc to every existing caller. Verified by the full no-regression suite.
5. **Hand-roll MCP over `@modelcontextprotocol/sdk`** — no third-party MCP-Nest framework ✅
6. **MCP Streamable HTTP is the sole transport** ✅ (decision 12, user-confirmed 2026-05-14) — spec-compliant JSON-RPC 2.0 via the SDK's `StreamableHTTPServerTransport` (stateful sessions, `enableJsonResponse`). **stdio is NOT supported** — dropped to avoid the clean-stdout / per-spawn-env friction; HTTP is the better DX (point a client at a URL). The earlier "stdio + HTTP from day 1" plan is superseded.
7. **Tools are vendor-specific, not FHIR-uniform** — `cerner_get_patient` ≠ `athena_get_patient` ✅
8. **No `@hs/ehr-mcp-descriptors` package** — registries live next to vendor implementations ✅
9. **LangChain — server side only is locked** ✅ — `apps/mcp-app/` and `packages/ehr-data-service/` never depend on LangChain. Client side (cds-app Phase 2) is unconstrained.
10. **Per-session vendor filtering is load-bearing** ✅ — mandatory in PR1 acceptance, not deferred.
11. **Dumb vendor-native tools + an intelligent client** ✅ (user-confirmed 2026-05-14, decision A). The MCP tool layer is a 1:1 mirror of the `ehr-data-service` methods — it does **no mapping and no cross-vendor normalization**. Each tool speaks its vendor's *native* format: Cerner's native API is FHIR R4, so Cerner tools take/return FHIR; DrChrono's native API is its own proprietary JSON, so DrChrono tools take/return DrChrono JSON. The **intelligence lives in the MCP client** (Gemini / Claude / OpenAI), which reads each tool's schema + description and constructs the correct per-vendor payload. Consequences:
    - **Writes carry no capability validation in the MCP path.** Rule-16 guardrails (allowedStates, immutableFields, note-immutability, per-category) + the `ConditionBodyBuilder` stay **cds-app-internal**, enforced only on cds-app's own clinical-write controller path — intentionally NOT duplicated into mcp-app.
    - **Mitigation = descriptions.** Each write tool's `@mcptool` TSDoc encodes the vendor constraints (the client's only guidance channel); `If-Match` is an explicit tool param. Trade-off accepted: an agent can submit an invalid / note-discarding payload; the vendor API is the backstop.
    - **Rejected:** (B) a shared `@hs/clinical-write` builder + capabilities for a structured/validated MCP write — contradicts "dumb tools mirror vendor-native," and would force a single normalized shape across vendors that don't share one. (D) deferring MCP writes entirely.
12. **Streamable HTTP only; no stdio** ✅ (user-confirmed 2026-05-14). The sole transport is MCP Streamable HTTP (SDK `StreamableHTTPServerTransport`, stateful sessions, `enableJsonResponse`) at `POST/GET/DELETE /api/mcp`. stdio was built then dropped — it forced clean-stdout plumbing (logs→stderr, no HTTP listen) and a per-spawn env model; a long-running HTTP server a client points at by URL is the better DX and works for Gemini CLI / any MCP HTTP client. `MCP_STDIO`, the stdio runner, and the Claude-Desktop stdio guide were removed.
13. **MCP is a first-class `AppType` (`MCP`)** ✅ (user-confirmed 2026-05-14). Add `MCP` to the `AppType` enum (+ prisma migration), `APP_TYPE_DEFINITIONS`, and `VALID_APP_TYPES`/createable types. A dedicated single-purpose app type (not a capability flag on CDS/BRIDGE) — chosen for clean separation. The dev `Bearer {"siteId"}` is replaced by a managed API token for an `MCP` app.
14. **MCP apps are system-only (client_credentials)** ✅ (user-confirmed 2026-05-14). `APP_TYPE_DEFINITIONS.MCP`: `allowedEhrAppTypes: ['system']`, `defaultEhrAppType: 'system'`, `allowedGrantTypes: ['client_credentials']`, `requiresSmartLaunchUrl: false`. A headless MCP server has no SMART launch / user context, so it authenticates to the EHR via `client_credentials` against a backend-services app; tools take explicit ids. (The SMART-session flow that bridge uses for provider apps is explicitly out of scope for MCP.)
15. **Reuse existing admin APIs; share the auth verifier** ✅ (user-confirmed 2026-05-14). MCP app management adds **no new admin-api endpoints** — creation, EHR access, token issuance, and site lookup all reuse the existing `POST /applications`, `upsertEhrAccess`, `POST /oauth/token` (client_credentials), and `adminClient.getSite`. The only new code is mcp-app's auth guard, and it **reuses** bridge-api's platform-JWKS verification by extracting `PlatformJwksService`/`DualAuthGuard` into a shared package (one verifier for bridge + mcp), rather than duplicating it.

## What this plan replaces

- Original `mcp-server-v1.md` (deleted; in git history) — `@hs/ehr-mcp-descriptors` package + `apps/mcp-app/` consuming it. **Replaced** by ehr-data-service owning the tool surface + apps/mcp-app/ consuming it directly.
- The v2 hand-written Zod registry (`{vendor}.tools.ts` + `{vendor}.schemas.ts`, `ToolRegistry`/`ToolDefinition`, `zod-to-json-schema`) — **superseded by the v2.1 codegen pivot** (this file, 2026-05-14; prior text recoverable via `git log -p -- docs/plans/mcp-server-v2.md`). The merged PR1 vertical slice that used it is migrated, not extended.

## Document this decision

After PR1 ships:
- `packages/ehr-data-service/CLAUDE.md` — document the codegen: `@mcptool` + `@mcpparams` tags, the params-interface↔parameter-name mapping rule (signatures unchanged), where `tools.generated.ts` comes from, the drift guard
- `apps/mcp-app/CLAUDE.md` — update to the generated-catalog model (no Zod, no `zodToJsonSchema`); already-merged version is migrated
- `.claude/recipes/add-mcp-tool.md` — revise to: "1. Add a `XxxParams` interface in `{vendor}.params.ts`, one JSDoc'd property per the method's post-`config` parameter (same names). 2. On the existing/new service method add a TSDoc summary, `@mcptool`, and `@mcpparams XxxParams` — **do not change the signature**. 3. (If new return shape) add the output interface to `{vendor}.types.ts`. 4. Build — `gen:tools` regenerates `tools.generated.ts`; commit it. Done; appears in MCP and (post-PR5) workflow."
- `.claude/recipes/add-ehr-vendor.md` — extend the recipe to include the `{vendor}.params.ts` + `{vendor}.types.ts` files and the `@mcptool` convention for the new vendor

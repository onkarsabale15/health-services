# mcp-app — Hot-Zone Notes for AI

## What this service is

MCP (Model Context Protocol) server exposing per-vendor EHR methods as LLM-callable tools. Sibling to `bridge-api` and `workflow-app` — all three consume `@hs/ehr-data-service` directly. mcp-app does NOT call bridge-api.

**Single transport: MCP Streamable HTTP** (`POST /api/mcp`). No stdio.

Plan: [`docs/plans/mcp-server-v2.md`](../../docs/plans/mcp-server-v2.md). Testing: [`docs/smoke-test.md`](./docs/smoke-test.md).

## Module map

| Module | Purpose |
|---|---|
| `modules/catalog/` | Loads the build-time generated tool catalog (`allVendorTools` from `@hs/ehr-data-service`) at boot. JSON Schema is shipped generated (no Zod). Filters per-session by vendor. |
| `modules/executor/` | Handles a tool call: resolve tool → validate input (generated Ajv) → resolve SiteData via `@hs/admin-client` → `ehrFactory` → invoke the generated dispatcher. |
| `modules/transports/mcp-server.service.ts` | Builds the `@modelcontextprotocol/sdk` MCP `Server` for a session (wires `tools/list` + `tools/call`). One place for the handler logic. |
| `modules/transports/http.controller.ts` | MCP **Streamable HTTP** transport — `POST /api/mcp` (JSON-RPC 2.0, stateful sessions via `Mcp-Session-Id`, JSON responses; the `api` prefix is added by `bootstrapNestApp`). Every request is re-authorized via `McpAuthService`. |
| `modules/transports/auth.ts` | `McpAuthService` — verifies the `Authorization: Bearer` platform API token against the platform JWKS (shared `@hs/infra` `platformJwks`, same primitive bridge-api uses), requires `app_type === 'MCP'`, reads the scope from the `X-Site-Id` header, and checks the token's org + `ehr_access` against the resolved site. PR7 adds OAuth 2.1 / DCR for third-party clients. |
| `modules/health/` | `/health` endpoint reporting catalog size. |

## Three load-bearing rules

1. **No direct Prisma.** Site lookups go through `@hs/admin-client` → admin-api HTTP. Same pattern as bridge-api and workflow-app.
2. **No bridge-api dependency.** mcp-app talks to admin-api (for SiteData) and directly to EHRs (via `ehrFactory` from `@hs/ehr-data-service`). No `@hs/bridge-client` import.
3. **Per-session vendor filter is load-bearing.** A Cerner session sees only Cerner tools. The token carries `siteId` only — `ehrName` is resolved from SiteData at request time via `SessionContextService.resolve()`. Single source of truth = `EhrSiteConfig.ehrName`. Without this filter, 10 vendors × N tools each would overwhelm the LLM.

## How a request flows

```
MCP HTTP client (Claude Code | Gemini CLI | curl | agent)
    │ POST /api/mcp   (JSON-RPC 2.0; Authorization: Bearer <platform API token>; X-Site-Id: <siteId>)
    ▼
HttpTransportController
    │ McpAuthService.authenticate(bearer, X-Site-Id)
    │   ├─ platformJwks.verifyApiToken → claims (token_type 'api', issuer/aud)
    │   ├─ require claims.app_type === 'MCP'
    │   ├─ sessionContext.resolve(siteId) → { ehrName, organizationId }
    │   ├─ tenant boundary: claims.org_id === site.organizationId
    │   └─ grant: claims.ehr_access includes ehrName
    │   → ResolvedSession { siteId, applicationId, organizationId, clientId }
    │ McpServerService.build(session) → SDK Server
    │ StreamableHTTPServerTransport (stateful, Mcp-Session-Id, JSON) → handleRequest(req,res,body)
    ▼
  tools/list → catalog.listForVendor(ehrName)   (ehrName from SessionContextService)
  tools/call → ExecutorService.call(session, name, args)
    ├─ catalog.resolve(name) → ToolDescriptor
    ├─ descriptor.validate(args) → JSON-RPC error on fail (generated Ajv)
    ├─ sessionContext.resolve(siteId) → { config, ehrName }
    ├─ ehrFactory.getService(ehrName) → vendor service
    └─ descriptor.invoke(svc, config, args) → raw vendor JSON
       (generated dispatcher: positional-arg map + `.data` unwrap)
                                                    │
                                          back to the client as
                                          { content: [{ type:'text', text: JSON }] }
```

## Adding a new tool

DO NOT add code in mcp-app. The catalog is generated from `@hs/ehr-data-service`. To add a tool:

1. Add a `XxxParams` interface in `packages/ehr-data-service/src/vendors/{vendor}/{vendor}.params.ts`, one JSDoc'd property per the method's post-`config` parameter (same names)
2. On the service method (existing or new) add a TSDoc summary + `@mcptool` + `@mcpparams XxxParams` tags — **do not change the signature**
3. (If new return shape) add the output interface to `{vendor}.types.ts`
4. (If first tool from a new vendor) add the vendor dir → ehrName entry in `scripts/gen-tools.ts` `VENDOR_DIR_TO_EHRNAME`
5. Build (`npm run gen:tools` runs in the package build); commit the regenerated `src/tools/tools.generated.ts`; restart mcp-app

See `.claude/recipes/add-mcp-tool.md` for the full pattern.

## Schema strategy (carry-forward from `mcp-server-v2.md`)

- Tool **input** schemas are **generated at build time** from the `@mcpparams` interface (ts-json-schema-generator → draft-07 JSON Schema), validated at runtime by a generated Ajv validator. No Zod in the tool path.
- Tool **output** types are plain TypeScript interfaces — no schema (avoids 30-field FHIR resource bloat); the LLM consumes raw EHR JSON.
- Service method signatures are **unchanged**; the generated `descriptor.invoke` maps validated input onto positional args and unwraps `EhrResponse.data`.

## Local development

- Streamable HTTP transport on at `http://localhost:3005/api/mcp` — point any MCP HTTP client at it (e.g. Gemini CLI `httpUrl`).
- See `docs/smoke-test.md` for boot + JSON-RPC `curl` + Gemini CLI config.

## What this app does NOT do (yet)

- **No OAuth 2.1 / Dynamic Client Registration.** Clients authenticate with a platform API token minted via admin-api's `client_credentials` grant (an `MCP`-type app). Self-service DCR for third-party MCP clients lands in PR7.
- **No `tools/listChanged` notifications.** Catalog is static after boot (rebuilt on process restart only).
- **No rate limiting per session.** PR6.
- **No shared/invalidating config cache.** `SessionContextService` has a 30s in-process memo (collapses one session's repeated lookups); the shared cache + explicit invalidation hooks land in PR6.

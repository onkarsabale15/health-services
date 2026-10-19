# Recipe — Add a Tool to the MCP Server

For Phase 1+ work. The MCP server lives at `apps/mcp-app/`. Per [`docs/plans/mcp-server-v2.md`](../../docs/plans/mcp-server-v2.md), tools are defined as plain TypeScript registries in `packages/ehr-data-service` — **NOT** in mcp-app, and **NOT** as a separate descriptor package.

## Step 1 — Add the vendor service method (if missing)

`packages/ehr-data-service/src/vendors/{vendor}/{vendor}.service.ts` — existing service class. Add a typed method:

```typescript
export class CernerService extends BaseEhrService {
  async getCondition(siteId: string, id: string): Promise<RawCernerCondition> {
    return this.makeAuthenticatedRequest(siteId, `/Condition/${id}`);
  }
}
```

If the method already exists, skip to step 2.

## Step 2 — Add the output TS interface (if new return shape)

`packages/ehr-data-service/src/vendors/{vendor}/{vendor}.types.ts` — plain TypeScript, **no Zod** for outputs:

```typescript
export interface RawCernerCondition {
  resourceType: 'Condition';
  id: string;
  clinicalStatus?: { coding?: Array<{ code?: string }> };
  // ... 25+ fields, all plain TS
}
```

If a similar shape exists already (e.g. `RawCernerObservation`), reuse it.

## Step 3 — Add the registry entry

`packages/ehr-data-service/src/vendors/{vendor}/{vendor}.tools.ts` — extend the existing object literal:

```typescript
import { z } from 'zod';
import type { ToolRegistry } from '../../tools/types';
import type { CernerService } from './cerner.service';
import type { RawCernerCondition } from './cerner.types';

export const cernerTools: ToolRegistry<CernerService> = {
  // ... existing entries
  get_condition: {
    name: 'cerner_get_condition',                    // vendor-prefixed
    description: `Read a Cerner Condition by ID. Returns the raw FHIR R4
                  payload — clinicalStatus, verificationStatus, category,
                  code, note[]. Use for single-resource detail; for lists
                  use cerner_search_conditions.`,    // multi-paragraph LLM-friendly
    inputSchema: z.object({                          // Zod ONLY for inputs
      siteId: z.string().uuid().describe('Bridge site UUID'),
      id: z.string().describe('Cerner Condition resource ID'),
    }),
    invoke: async (svc, input): Promise<RawCernerCondition> =>
      svc.getCondition(input.siteId, input.id),     // explicit return type
  },
};
```

**No `outputSchema` field.** The TS return type from `invoke` is the contract.

**No LangChain.** Plain object literal, no decorators, no reflection.

## Step 4 — Aggregated registry (already wired; no change)

`packages/ehr-data-service/src/tools/index.ts` already aggregates all vendor registries into `allVendorRegistries`. New tools surface automatically once they're in `{vendor}.tools.ts`.

## Step 5 — Verify

- `npm run check:ehr-data-service` (build + lint) — TypeScript catches if `invoke` references a method that doesn't exist or the wrong shape.
- Restart `apps/mcp-app/` — its `CatalogService.onModuleInit` walks the registries; logs show "Catalog built: N tools".
- `tools/list` via stdio (Claude Desktop) or HTTP (`POST /mcp/tools/list`) returns the new tool.
- `tools/call cerner_get_condition {siteId, id}` round-trips Cerner sandbox.
- Per-session vendor filtering (load-bearing): a Cerner-tenanted session sees this tool; a non-Cerner tenant does NOT.

## Acceptance

- Tool listed in `tools/list` for sessions whose vendor matches the registry's vendor.
- Schema validation rejects malformed LLM input with clear messages (Zod errors).
- Round-trip against vendor sandbox works.
- Cerner / Epic / Athena specific invariants (If-Match, immutable fields, etc.) enforced at the underlying `{vendor}.service.ts` method, not duplicated in the registry.

## What this recipe does NOT do

- Does NOT add code to `apps/mcp-app/` — mcp-app auto-discovers from the registry.
- Does NOT add code to `apps/workflow-app/` — workflow consumes the same registry (post-PR5).
- Does NOT touch `apps/bridge-api/` — bridge-api uses the service classes directly, not the registry.
- Does NOT create LangChain tools — that's a Phase 2 client-side concern (cds-app Co-Pilot), independent of this server-side registry.

## When the workflow auto-discovery (PR5) lands

After mcp-server-v2 PR5, this same registry entry also surfaces in workflow-ui's `raw-ehr` node method dropdown with the description and Zod-derived input form. No additional work in workflow-app.

# Recipe — Add a Tool to the cds-app Agent (Legacy Pattern)

> **Heads up:** this recipe describes the **existing** LangChain `DynamicStructuredTool` pattern used by `apps/cds-app/src/engine/`. It is the **legacy** path — Phase 2 Co-Pilot is expected to consume MCP tools via mcp-app instead of hand-rolling per-tool LangChain wrappers. See [`docs/plans/mcp-server-v2.md`](../../docs/plans/mcp-server-v2.md) for the new architecture.
>
> **When to use this recipe:**
> - You're patching the existing `apps/cds-app/src/engine/` agent before Phase 2 ships.
> - You're maintaining an analysis agent that's been on this pattern.
>
> **When NOT to use this recipe:**
> - Adding a new EHR tool — use [`add-mcp-tool.md`](./add-mcp-tool.md) instead. The tool surfaces in mcp-app automatically; cds-app's Phase 2 Co-Pilot consumes it via either `@langchain/mcp-adapters` OR Anthropic SDK native tool-use (Phase 2 picks).
>
> **Phase 2 client-side choice (still open):** LangChain + `@langchain/mcp-adapters` (reuses this engine pattern) vs Anthropic SDK native tool-use + `@modelcontextprotocol/sdk` client (rewrites the engine, drops `as any` casts). Either is viable; mcp-app and ehr-data-service stay LangChain-free regardless.

## Step 1 — Tool definition

`apps/cds-app/src/engine/tools/{tool-name}.tool.ts`:

```typescript
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

export interface XxxToolDeps {
  // Inject what the tool needs — bridge client, terminology client, etc.
  bridge: BridgeClientService;
  patientId: string;  // closure-captured per session
}

export function makeXxxTool(deps: XxxToolDeps): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'fhir_xxx',
    description: 'Plain-language description for the LLM. Be specific about inputs/outputs.',
    schema: z.object({
      param1: z.string().describe('What this is'),
      // ...
    }),
    func: async ({ param1 }) => {
      // Implementation. Return string (LLM consumes the result).
      const result = await deps.bridge.searchFhir(...);
      return JSON.stringify(result);
    },
  }) as any; // LangChain types have known issues; cast required
}
```

## Step 2 — Wire into agent

`apps/cds-app/src/engine/agents/clinical-analyst.agent.ts` (or whatever agent uses it):

```typescript
const tools = [
  makeFhirSearchTool({ bridge, patientId }),
  makeFhirReadTool({ bridge, patientId }),
  makeXxxTool({ bridge, patientId }),  // NEW
];
const agent = createReactAgent({ llm, tools });
```

## Step 3 — System prompt update

`apps/cds-app/src/engine/prompts/system.ts` — add a sentence describing when to use the new tool. Don't try to enumerate all use cases; describe the primitive.

## Step 4 — Tests

- Mock the dep, invoke `tool.func(input)`, assert the call shape and return
- Integration: spin up the full agent with a fixture patient, assert the tool is called for the right kind of question

## When to use this recipe vs. `add-mcp-tool.md`

- **Pre-Phase 1 (no MCP server yet) and the existing engine needs a new tool**: this recipe.
- **Post-Phase 1 (MCP shipped — most cases going forward)**: use [`add-mcp-tool.md`](./add-mcp-tool.md). The tool lands in `packages/ehr-data-service` registries; mcp-app exposes it; the cds-app Co-Pilot consumes it via its chosen client adapter (LangChain MCP adapter or Anthropic SDK native).

## Acceptance

- Agent invokes the tool when prompted with the relevant question
- Tool's response is structured enough for the LLM to extract and reason with
- No PHI leaked to LLM context beyond what's necessary

# CLAUDE.md

## 🚀 Agent Efficiency Rules (Context & Token Optimization)
To minimize token usage and maintain a lean context window, follow these mandates:

1. **The Golden Path:** To understand EHR patterns, look **only** at `apps/bridge-api/src/services/athenanet/athenanet.mapper.ts`. All other vendors follow this pattern. Do not read other vendor implementations unless debugging a vendor-specific issue.
2. **Never Read Full SDKs:** Files in `packages/*-sdk/src/generated/` are massive (>3000 lines). **NEVER** use `read_file` on them in full. Use `grep_search` to find specific DTOs or methods.
3. **Contract-First Truth:** The generated SDK is the source of truth for the API. Do not rely on manual markdown docs in `docs/` for API endpoints; they may be stale.
4. **Graph-First RAG:** This project uses a knowledge graph as its primary RAG engine. **You MUST query the graph before manual exploration.** 
   - For overview: Read `graphify-out/GRAPH_REPORT.md`.
   - For specific concepts: Use `/graphify query "<question>"` or `/graphify explain "<node>"`.
   - Goal: Use the graph to identify the exact 1-2 files needed rather than searching the whole directory.
5. **No PHI/Secrets:** Never log, print, or include Patient Health Information (PHI) or API keys in your responses.
6. **Prefer @medplum/fhirtypes:** Avoid custom mapper mixins. Use standardized FHIR interfaces from `@medplum/fhirtypes` directly for type safety and property assignment.
7. **Dumb but Typed Data Service:** `packages/ehr-data-service` is a low-level HTTP wrapper. **No FHIR mapping or clinical logic is allowed here.** It must return `EhrResponse<T>` using specific vendor types.
8. **Non-FHIR Integration Strategy**: For proprietary EHR APIs, the mapping must be done in `bridge-api`. The Bridge must ensure strict, logically correct FHIR R4 compliant mappings.
9. **Strict Documentation-First EHR Updates**: When modifying `ehr-data-service`, you **MUST** verify all technical details against official EHR documentation. If inaccessible, ask the user. **NEVER make changes blindly.**
10. **Mandatory Linting:** You **MUST** run `npm run lint:fix` after modifying code and before submitting. The CI and pre-commit hooks will reject any code with linting or formatting errors.
11. **Atomic & Verified Commits:** After completing a logical unit of work and verifying it (build + lint + tests pass), you MUST commit the changes. Use `npm run commit` to ensure full verification before committing. Always provide a descriptive commit message following the project's style (e.g., `feat: ...`, `fix: ...`, `chore: ...`).


## 🏗 Architecture Overview & Anchors
These "Anchor Nodes" must persist in all knowledge representations:
- **Admin API:** The central management plane (`apps/admin-api`).
- **Bridge API:** The FHIR translation gateway (`apps/bridge-api`).
- **Workflow Engine:** The reactive execution core (`apps/workflow-app`).
- **CDS App:** The clinical decision support logic (`apps/cds-app`).
- **SDKs:** The auto-generated interfaces (`packages/*-sdk`).

*Note: All files within an application's directory should be linked to their respective Anchor Node via "contains" relationships during extraction.*

## 🛠 Commands
- **Build:** `npm run build` (or `turbo build`)
- **Test:** `npm test`
- **Lint:** `npm run lint`
- **Update Graph:** `python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"`

## 📊 graphify
This project has a knowledge graph at `graphify-out/`.
- **Read First:** Always check `graphify-out/GRAPH_REPORT.md` before answering architecture questions.
- **Update KB:** Run `./scripts/update-kb.sh` to sync the graph after structural changes.
- **Live Query:** Use `python3 -m graphify.serve graphify-out/graph.json` to start an MCP server for live graph traversal.
- **Node Focus:** Focus on Module-to-Module edges. Ignore individual utility method connections.

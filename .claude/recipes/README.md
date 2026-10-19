# Cookbook Recipes

Concrete step-by-step playbooks for recurring tasks. Each recipe is file-level, copy-paste-ready, and pinned to current architecture conventions. Replaces re-deriving the path from rules + grep on every recurring task.

## Recipes

| Recipe | When to use |
|---|---|
| [`add-ehr-vendor.md`](./add-ehr-vendor.md) | Onboarding a new EHR (Cerner/Epic/Athena/etc. style) end-to-end |
| [`add-fhir-resource-write.md`](./add-fhir-resource-write.md) | New write controller for a FHIR resource (Observation, Allergy, etc.) |
| [`add-cds-tool.md`](./add-cds-tool.md) | New tool for the cds-app LangChain agent loop |
| [`add-mcp-tool.md`](./add-mcp-tool.md) | New method on the MCP server (Phase 1+) |
| [`add-workflow-trigger.md`](./add-workflow-trigger.md) | New trigger type for workflow-app DAG executor |
| [`add-admin-ui-page.md`](./add-admin-ui-page.md) | New admin-ui page with capability-driven gating |
| [`debug-cerner-write.md`](./debug-cerner-write.md) | Cerner-specific write gotchas (the note-saga playbook) |

## Conventions

- **File-level paths.** Don't say "the controller for X" — say `apps/cds-app/src/modules/...`.
- **Working code samples.** Snippets must compile against current types.
- **Acceptance criteria** at the end of each recipe.
- **Update when patterns drift.** A stale recipe is worse than no recipe.

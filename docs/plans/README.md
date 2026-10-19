# `docs/plans/` — Active Plan Index (May 2026)

> Single source of truth for what's in flight, what's done, what's archived. The master roadmap lives at [`cds-roadmap-2026-05.md`](./cds-roadmap-2026-05.md) — start there.
>
> **Convention** (see `.claude/rules/17-plans-in-repo.md`): all durable plans live HERE in the repo. `.claude/plans/` is plan-mode scratch only — never the source of truth.

## Active master plan

| File | Scope | Status |
|---|---|---|
| [`cds-roadmap-2026-05.md`](./cds-roadmap-2026-05.md) | Master roadmap — plan inventory, repo/rules refactor, phased feature roadmap (Phases 0–5) | **CURRENT** — Phase 0 shipped; Phase 1 sequenced via `mcp-server-v2.md` |

## Phase deep-dives

| File | Scope | When to read |
|---|---|---|
| [`mcp-server-v2.md`](./mcp-server-v2.md) | **Phase 1** — MCP Server: build-time tool codegen from `@mcptool`-tagged ehr-data-service methods (v2.1 pivot 2026-05-14 — no Zod, no hand-written registry), mcp-app NestJS service, stdio + HTTP transports | PR1 vertical slice merged to `main`; v2.1 codegen rework awaiting go-ahead |
| [`phase-3-copilot-writes-and-admin.md`](./phase-3-copilot-writes-and-admin.md) | **Phase 3** — Co-Pilot v2 writes + Coding Asst + AI SBAR + Prior-Auth Bot v0 | Before starting Phase 3 |
| [`phase-4-clinical-events.md`](./phase-4-clinical-events.md) | **Phase 4** — Bridge events + Workflow event triggers + Smart Inbox + Med Reconciliation | Before starting Phase 4 |
| [`phase-5-quality-and-patient-facing.md`](./phase-5-quality-and-patient-facing.md) | **Phase 5** — HEDIS measure library + QRDA export + AVS + Patient inbox auto-replier | Before starting Phase 5 |

> Phase 0 (cleanup) shipped May 2026. Phase 2 (Co-Pilot v1 + Pre-Visit Brief + Care-Gap v0) is detailed inline in `cds-roadmap-2026-05.md`; a deep-dive will be written when Phase 1 nears completion.

## Future-tracking plans (low-activity, kept for reference)

| File | Scope | Status |
|---|---|---|
| [`sso-identity-architecture.md`](./sso-identity-architecture.md) | Forward-looking SSO work — Audit framework (Phase 3+), BAA tracking (Phase 5+), inbound IdP federation (deferred) | Most original P0–P2 scope shipped via SSO Phase A/B/C. Heavily trimmed in Phase 0; remaining items are pointers to future phase work. |

## Historical plans

Closed / superseded plans are **not retained** — git history is the authoritative record. To recover a deleted plan:

```bash
# Find the deletion commit
git log --diff-filter=D --summary -- docs/plans/

# View the file at its last commit before deletion
git show <commit>:docs/plans/<filename>.md
```

Plans removed in May 2026 cleanup (recoverable via git): `mcp-server-v1.md` (superseded by v2), `cds-multi-mode-architecture.md` (shipped), `cds-service-refactor.md` (95% shipped, Phase 2 deferred), `workflow-architecture-v2.md` (fully shipped), the internal 2026-04-04 security audit (all findings closed), `bridge-api-remove-direct-db-access.md` (closed). Pre-existing archived plans (`plans-verification-2026-04-21.md`, `sso-identity-architecture-v0.2-edit-plan.md`, `workflow-engine-plan.md`) also removed at the same time.

## How to use this directory

- **Starting a new feature:** read the master roadmap first; identify the phase; read the phase deep-dive.
- **Mid-phase:** the deep-dive's "Critical files" + "Acceptance" tables are the contract — work to those.
- **Adding a new plan:** create the file in this directory; add it to this README; update the master roadmap if it shifts the sequence.
- **Closing a plan:** when work is fully shipped or the plan is superseded, **delete the file** and update the README. Git history preserves it. Do not maintain an archive directory — closed plans should not occupy the active workspace.
- **Plan-mode iteration:** `.claude/plans/` is fine for in-flight drafts. **As soon as a plan is approved or substantially finalized, copy it here and commit.** Don't reference `.claude/plans/` from any committed file.

## Conventions

- **Working agreement** at the top of every plan: plan-mode approval ≠ start coding. Always wait for explicit "start" / "implement" before touching non-plan files.
- **Status header** at the top of every plan: shipped / in-progress / planned / abandoned.
- **Critical files** sections are file-level paths so the work is unambiguous.
- **Acceptance** sections describe pass criteria, not steps.
- **No prose narratives** — tables + bullets. Token-efficient.

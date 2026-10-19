# Plans Live in the Repo, Not in `.claude/plans/`

## Rule

**All durable plans MUST live under `docs/plans/` in the repo, indexed by `docs/plans/README.md`.** The `.claude/plans/` directory is plan-mode scratch space — it survives across sessions but is NOT part of the repo and is NOT visible to teammates, CI, or future agents that don't share this filesystem.

## Why

We've had plans drift between two locations:

- `.claude/plans/` — auto-generated filenames (e.g. `federated-tinkering-pascal.md`), invisible to teammates, lost on machine swap, not version-controlled.
- `docs/plans/` — human-named, version-controlled, indexed, reviewed in PRs, discoverable by every agent.

Plans in `.claude/plans/` that survived a single session became stale or duplicated work. The fix is a hard rule: finalized plans always go to `docs/plans/`.

## When to apply

- **Reading plans:** always check `docs/plans/README.md` first. That index is the source of truth for active plans, deferred plans, and archives.
- **Writing plans (plan mode):** plan-mode auto-creates files under `.claude/plans/` — that's fine *during* iteration. Once a plan is approved or substantially finalized, **copy it to `docs/plans/<descriptive-name>.md` and commit**. Update `docs/plans/README.md` to index it.
- **Revising plans:** edit the file in `docs/plans/`. If a fresh plan-mode iteration is needed (significant rewrite), use plan mode for the draft; final state lands in `docs/plans/`.
- **Closing plans:** when a plan is fully shipped or superseded, **delete the file** and update README. Do not maintain an `archive/` directory — git history is the authoritative record (`git log --diff-filter=D -- docs/plans/` recovers any deleted plan).

## What NOT to do

- Don't leave a final plan in `.claude/plans/` and call it done.
- Don't reference `.claude/plans/<file>.md` from any committed file (CLAUDE.md, READMEs, code comments, commit messages). Reference `docs/plans/<file>.md` instead.
- Don't fork a plan into both locations and let them drift.

## Naming convention for `docs/plans/`

- Master roadmap: `cds-roadmap-{YYYY-MM}.md`
- Phase deep-dives: `phase-{N}-{slug}.md`
- Topic-scoped plans: `{topic}-{vN}.md` (e.g. `mcp-server-v2.md`, `sso-identity-architecture.md`)
- Closed plans: deleted from disk; recoverable via git history

## Plan structure

Per existing convention (see master roadmap as a reference), each plan should have:

- Status header (active / planned / shipped / superseded) with date
- Working agreement (when approval triggers implementation)
- Context (why this plan, what problem it solves)
- Architecture / approach
- Critical files to modify (file-level paths)
- Implementation phases / PR breakdown
- Acceptance criteria (per phase)
- Risks + mitigations
- Resolved decisions (capture user-confirmed trade-offs explicitly)

## Quick check before ending a planning session

1. Is the plan in `docs/plans/`? (If still in `.claude/plans/`, copy + commit.)
2. Is `docs/plans/README.md` updated to point at it?
3. Is the master roadmap updated if the plan changes Phase scope?
4. Are old plans it supersedes deleted (with the README updated to note the deletion)? Git history preserves them.

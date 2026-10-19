# CDS Roadmap & Plan Cleanup — May 2026

> **Purpose:** consolidate every active plan, archive what's shipped, refactor the repo for token-efficient agentic development, and sequence the next 16–22 weeks of work in a way that respects existing dependencies. This document supersedes the loose collection in `docs/plans/` as the new authoritative master plan.

> **Working agreement:** plan-mode approval is NOT a signal to start coding. Wait for explicit "start phase X" before touching non-plan files. Each phase has its own go-ahead.

---

## Part A — Plan Inventory & Cleanup

### Active plans in `docs/plans/` (post-cleanup, May 2026)

| Plan | Status | Notes |
|---|---|---|
| `cds-roadmap-2026-05.md` (this file) | Active master | Phase 0 shipped; Phase 1 sequenced via `mcp-server-v2.md`; Phases 2–5 captured in deep-dive plans |
| `mcp-server-v2.md` | Active, planned-not-started | Phase 1 deep-dive. Read+write tool surface via `packages/ehr-data-service` registries. Supersedes `archive/mcp-server-v1.md`. |
| `phase-3-copilot-writes-and-admin.md` | Active, future | Phase 3 deep-dive (Co-Pilot writes + Coding Asst + AI SBAR + Prior-Auth Bot v0) |
| `phase-4-clinical-events.md` | Active, future | Phase 4 deep-dive (Clinical events + Smart Inbox + Med Recon) |
| `phase-5-quality-and-patient-facing.md` | Active, future | Phase 5 deep-dive (HEDIS measures + QRDA + AVS + Patient inbox) |
| `sso-identity-architecture.md` | Active, future-tracking | Forward-looking SSO work: Audit framework (Phase 3+), BAA tracking (Phase 5+). Heavily trimmed in Phase 0. |
| `README.md` | Active | Plan index |

### Historical plans (deleted, recoverable via git)

Closed / superseded plans are not retained on disk. `git log --diff-filter=D -- docs/plans/` recovers any of:
- `mcp-server-v1.md` — superseded by `mcp-server-v2.md`
- `cds-multi-mode-architecture.md` — shipped (residual polish lives in this roadmap's Phase 0 polish backlog)
- `cds-service-refactor.md` — 95% shipped; Phase 2 (per-EHR provider overrides) deferred-by-design
- `workflow-architecture-v2.md` — fully shipped (`LLMConfigTab.tsx` in admin-ui)
- the internal 2026-04-04 security audit — all findings closed during Phase 0
- `bridge-api-remove-direct-db-access.md` — closed
- pre-existing archives: `plans-verification-2026-04-21.md`, `sso-identity-architecture-v0.2-edit-plan.md`, `workflow-engine-plan.md`

### Memory at `~/.claude/projects/.../memory/`

| File | Status | Action |
|---|---|---|
| `MASTER_PLAN.md` (March 2026) | Stale — predates Phase B/C/MCP | **Replace** pointer to point at this doc |
| `architecture.md` | Current | Keep |
| `architecture_three_layer_ehr.md` | Current | Keep |
| `codebase-improvements.md` (March 2026) | Mostly stale — most P0/P1 items shipped | **Re-scan & re-rank** in Phase 0; drop closed items |
| `feedback_*.md` | Active feedback memories | Keep |
| `MEMORY.md` | Active index | Update with this doc's pointer |

### Cleanup actions (Phase 0, Day 1)

1. ~~Move `bridge-api-remove-direct-db-access.md` → `archive/`~~ — superseded; closed plans are now deleted (git history retains them).
2. Rewrite each "in-progress" plan's body to a 30–80 line "outstanding work only" head with a pointer to git history for the shipped portions.
3. Add a `docs/plans/README.md` index that lists active plans + status in one place.
4. Update `MEMORY.md` master-plan pointer to this file. Mark `MASTER_PLAN.md` as historical.
5. Re-scan `codebase-improvements.md` and drop closed items (most P0s are shipped).

---

## Part B — Repo & Rules Refactor for Token-Efficient Agentic Dev

### Diagnosis — what's eating tokens today

| Source | Lines | Always-loaded? | Hottest pain |
|---|---|---|---|
| `.claude/rules/` (16 files) | **2077** | Yes (loaded as project instructions) | `07-typescript.md` 243 ln, `15-sso-oauth.md` 280 ln, `09-frontend.md` 162 ln |
| `CLAUDE.md` (project) | 43 | Yes | Tight, fine |
| `~/.claude/CLAUDE.md` (global) | 63 | Yes | Fine |
| `graphify-out/GRAPH_REPORT.md` | ~? | Read-on-demand | Fine — graphify is the right RAG path |
| `MEMORY.md` index + memory files | 200+ on first 200 lines | Yes (truncated at 200) | OK |

**Total always-loaded baseline:** ~2,200+ lines per session start. That's roughly 25–30k tokens before the user types anything. With long debugging chains (like the Cerner note saga), this compounds.

### B1. Rules: split "core" vs "reference"

For each rule file, extract a **core summary** (≤ 60 lines, tables + bullet rules only — no examples) and move detailed examples + extended discussion to a **reference companion** that's fetched on demand via a new skill.

| Rule | Action | Target core size |
|---|---|---|
| `01-solid.md` (60 ln) | Already small — keep | — |
| `02-database.md` (96 ln) | Trim ACID prose; tables stay | 60 |
| `03-security.md` (96 ln) | Trim duplicated content with 15-sso-oauth | 60 |
| `04-caching.md` (106 ln) | Move multi-tier examples to reference | 60 |
| `05-api-design.md` (85 ln) | Trim verbose examples | 50 |
| `06-error-handling.md` (108 ln) | Trim FHIR Bundle response example | 60 |
| `07-typescript.md` (243 ln) | **Aggressive split** — keep type-safety + naming, move generics tutorial to ref | 70 |
| `08-nestjs.md` (94 ln) | Already tight | — |
| `09-frontend.md` (162 ln) | Move Button-component examples to a `cookbook/` md | 80 |
| `10-monorepo.md` (107 ln) | Trim turbo.json verbatim | 60 |
| `11-testing.md` (152 ln) | Move full test examples to ref | 70 |
| `12-git.md` (83 ln) | Already tight — keep | — |
| `13-observability.md` (113 ln) | Trim tables + examples | 70 |
| `14-performance.md` (112 ln) | Move "expected ranges" table to ref | 60 |
| `15-sso-oauth.md` (280 ln) | **Heavy trim** — most is shipped, move to reference | 60 |
| `16-cds-capability-driven.md` (129 ln) | Keep — actively shaping new code | 100 |

**Target:** rules trimmed from 2,077 → ~900 lines (-57% tokens always loaded).

### B2. Add skill: `/rules:<topic>`

Create `~/.claude/skills/rules/SKILL.md` (or project-level `.claude/skills/rules/`) that loads the full reference companion for one topic on demand:
```
/rules typescript    → loads typescript-reference.md
/rules sso           → loads sso-reference.md
/rules testing       → loads testing-reference.md
```
Lets the agent stay shallow by default and pull deep only when it actually matters.

### B3. Module-level `CLAUDE.md` hints (hot-zones)

Today the global `CLAUDE.md` describes the whole architecture. Adding small `CLAUDE.md` files at module roots scopes the loaded context to where Claude is actually working.

| Path | What it documents |
|---|---|
| `apps/cds-app/CLAUDE.md` | session model, capability-driven providers, write-rule pattern, agent loop entry points |
| `apps/bridge-api/CLAUDE.md` | dual-auth, FHIR proxy semantics, cache key contract, EHR vendor mapper rules |
| `apps/admin-api/CLAUDE.md` | OAuth/IdP surface, EndUser model, identity resolver |
| `apps/workflow-app/CLAUDE.md` | DAG executor, node types, Kafka topics, trigger types |
| `packages/ehr-data-service/CLAUDE.md` | golden-path rule (athenanet.mapper.ts as reference) |
| `apps/cds-app/src/engine/CLAUDE.md` | LangChain agent layout, tool injection pattern, prompt families |

Claude Code auto-loads the nearest `CLAUDE.md` for the file being edited (subtree-scoped). 60–100 lines each, focused on patterns relevant to that subtree only.

### B4. Cookbook recipes for common tasks

Add `.claude/recipes/` with one file per recurring task. Lets Claude one-shot common changes without re-deriving the pattern from rules + grep.

| Recipe | When useful |
|---|---|
| `add-ehr-vendor.md` | New EHR provider integration |
| `add-fhir-resource-write.md` | New write controller (Observation, Allergy, etc.) |
| `add-cds-tool.md` | Adding a tool to the agent loop |
| `add-mcp-tool.md` | Adding a method to the MCP server |
| `add-workflow-trigger.md` | New clinical event trigger |
| `add-admin-ui-page.md` | New admin-ui page with capability-driven gating |
| `debug-cerner-write.md` | Cerner-specific gotchas (the note-saga playbook) |

These ARE essentially mini-plans extracted from common patterns — they replace re-discovering the path each time.

### B5. Graphify as default RAG (already a rule, but reinforce)

Already covered in CLAUDE.md §4. Add to recipes/cookbook a "before reading any file, ask graphify" reminder for surface-area-spanning tasks. Update `.claude/rules/README.md` to surface this as the FIRST principle.

### B6. Test patterns as templates

Drop concrete test scaffolds in `apps/<app>/test/templates/` (one per resource type, one per guard, one per service). When asked "add a test for X", Claude copies + modifies rather than re-deriving the AAA structure each time.

### B7. `npm run` consolidation

Multiple workflows today (`npm run lint`, `npm run lint:fix`, `npx turbo build --filter=...`). Add:
- `npm run check` — `turbo build && lint --no-fix && test` (full pre-commit)
- `npm run check:cds` (and per-app) — scoped check for the app being edited
- Surface in CLAUDE.md so Claude reaches for them before per-tool invocations

**Token impact (estimated):**
- B1+B2 (rules split): −1,200 lines always-loaded ≈ −15k tokens
- B3 (module CLAUDE.md): +400 lines but only when working in that module ≈ neutral
- B4 (recipes): cuts 5–10 grep+read iterations per common task ≈ −3–8k tokens per task
- Net: ~30–40% reduction in tokens spent on routine changes

---

## Part C — Phased Feature Roadmap

### Phase 0 — Cleanup & Foundations ✅ SHIPPED (May 2026)

**Status:** complete. Delivered across commits in early May 2026:
- Plans archived/trimmed; `docs/plans/README.md` index created
- 5 module-level `CLAUDE.md` files (cds-app, bridge-api, admin-api, workflow-app, ehr-data-service)
- 7 cookbook recipes under `.claude/recipes/`
- `npm run check[:*]` shortcuts in root `package.json`
- Audit items F14/F19/F10 verified closed (already shipped pre-Phase-0; doc was lagging)
- LLMConfigTab.tsx confirmed shipped at `apps/admin-ui/src/app/dashboard/applications/[id]/_components/`
- New rule `.claude/rules/17-plans-in-repo.md`
- `notReadyForVendor` helper extracted; per-app turbo `check:*` scripts collapsed to single invocation
- Athena/DrChrono/Elation provider stubs intentionally NOT shipped (deferred-by-design)

**Polish backlog** (low-priority, tracked via TaskCreate, not as a separate plan):
- Tighten standalone-launch integration lookup at `apps/cds-app/src/modules/launch/launch.controller.ts:184`
- `AnimatePresence` route-level transitions in `apps/cds-ui/src/app/layout.tsx`
- "Switch to provider launch" button in system-mode header
- Partial-data warnings on the AI care-plan tab
- Rules trim (16 files → ~900 lines target — original Part B1 work, deferred to a fresh session)

---

### Phase 1 — MCP Server (4–9 weeks; deep plan: [`mcp-server-v2.md`](./mcp-server-v2.md))

**Goal:** ship the EHR access layer that every agentic feature in later phases will depend on. **Architecture (May 2026 revision):** mcp-app is its own NestJS service that consumes `packages/ehr-data-service` directly via tool registries (`{vendor}.tools.ts` + `{vendor}.schemas.ts` + `{vendor}.types.ts`). Bridge-api unchanged. No LangChain on the server side. FHIR + proprietary vendor surface (not just FHIR). Full detail in `mcp-server-v2.md`.

**Re-trimmed plan content** moved into Part C of this doc (the existing 799-line plan stays as reference):

| PR | Scope | Deliverable | Acceptance |
|---|---|---|---|
| **PR1** | `@hs/ehr-mcp-descriptors` package + Cerner profile | Tool catalog as descriptors (read+write); ID transform helpers | Cerner descriptor passes round-trip schema validation |
| **PR2** | `apps/mcp-app` scaffold + Cerner end-to-end | MCP stdio + HTTP server; auth via session-id / site-id; Cerner reads + writes work in Claude Desktop | Tool list visible; condition.create + condition.read return real Cerner data |
| **PR3** | Epic profile (reads + writes) | Epic descriptor + ID handlers + encounter-diagnosis-only condition writes | Epic launch + read + write works |
| **PR4** | Athena profile + dual-API surface (FHIR + proprietary) | Athena descriptor + ID transforms (enterprise / FHIR / department-scoped) | Athena dual-surface works |
| **PR5** | OAuth 2.1 + DCR | Standard MCP auth | External agents (non-Anthropic) can connect |
| **PR6** | Hardening | Rate limiting, retries, structured errors, observability | Load test 100 RPS green |

**Phase boundaries:** PR1+PR2 are the **hard prerequisite** for Phase 2. PR3+PR4 can run in parallel with Phase 2 work. PR5+PR6 are pre-public-beta.

**Effort:** 4 weeks PR1+PR2 (1 eng), 2 weeks PR3+PR4 in parallel.

---

### Phase 2 — Patient Co-Pilot v1 (Read-Only) + Pre-Visit Brief + Care-Gap v0 (3 weeks)

**Goal:** clinical interactive surface (provider-facing) and the first system-launch dashboard (admin-facing) — both ride the MCP layer.

**Three deliverables:**

#### 2A — Patient Co-Pilot v1 (read-only voice + text)

**Critical files (cds-app BE):**
- `apps/cds-app/src/modules/copilot/copilot.module.ts` — NEW
- `apps/cds-app/src/modules/copilot/copilot.controller.ts` — NEW: `POST /copilot/chat` (text), `POST /copilot/transcribe` (audio→text), `GET /copilot/conversation/:id` (history)
- `apps/cds-app/src/modules/copilot/copilot.service.ts` — NEW: orchestrates agent loop, persists conversation
- `apps/cds-app/src/modules/copilot/conversation.service.ts` — NEW: `CdsConversation` persistence (turns, tool-calls, citations, audit)
- `apps/cds-app/src/engine/agents/copilot.agent.ts` — NEW: ReAct agent with MCP tools
- `apps/cds-app/src/engine/prompts/copilot.system.ts` — NEW: persona prompts (general / pediatric / mental-health)
- `apps/cds-app/src/engine/tools/mcp-bridge.tool.ts` — NEW: bridge from LangChain DynamicStructuredTool → MCP tool calls (in-process, not over MCP transport — same package)
- `packages/infra/prisma/schema.prisma` — extend with `CdsConversation`, `CdsConversationTurn` models
- STT integration: `apps/cds-app/src/services/transcription.service.ts` — NEW: Whisper API wrapper (fallback: Web Speech in browser)

**Critical files (cds-ui FE):**
- `apps/cds-ui/src/components/copilot/ChatDock.tsx` — NEW: persistent right-side dock
- `apps/cds-ui/src/components/copilot/MicButton.tsx` — NEW: hold-to-talk + click-toggle, browser audio recording
- `apps/cds-ui/src/components/copilot/MessageList.tsx` — NEW: turns + action-card renderer
- `apps/cds-ui/src/components/copilot/CitationCard.tsx` — NEW: links to source FHIR resource
- `apps/cds-ui/src/hooks/useCopilot.ts` — NEW: SSE/streaming integration with `/copilot/chat`
- `apps/cds-ui/src/lib/api.ts` — extend with `cdsApi.copilotChat`, `cdsApi.copilotTranscribe`

**Tool surface (read-only Phase 2A):**
- `fhir_search`, `fhir_read` (already exist)
- `mcp_patient_summary`, `mcp_recent_labs`, `mcp_active_conditions`, `mcp_active_medications`, `mcp_recent_encounters` (NEW, via MCP)
- `mcp_terminology_lookup` (NEW, via MCP)

**Acceptance:**
- Text chat works end-to-end with patient context
- Mic button records, transcribes, sends as user turn
- Streaming response with tool-call traces
- Conversation persists across page navigations
- Audit event emitted per agent action

**Effort:** 2 weeks (1 BE eng + 1 FE eng).

#### 2B — Pre-Visit Brief

**Critical files:**
- `apps/cds-app/src/modules/previsit/previsit.module.ts` — NEW
- `apps/cds-app/src/modules/previsit/previsit.controller.ts` — NEW: `GET /previsit/:patientId`
- `apps/cds-app/src/modules/previsit/previsit.service.ts` — NEW: reuses analysis.service primitives, new system prompt
- `apps/cds-app/src/engine/prompts/previsit.system.ts` — NEW
- `apps/cds-ui/src/components/previsit/PreVisitBrief.tsx` — NEW: card on patient open

**Acceptance:**
- Auto-renders within 5 seconds of patient open
- Shows: last 3 visits + outcomes, active problems with delta, recent labs/imaging trends, open orders, care gaps
- Cached server-side per (patient, encounter, visit-time-window)

**Effort:** 1 week (mostly reuse).

#### 2C — Care-Gap Dashboard v0 (system-launch)

**Critical files:**
- `apps/cds-app/src/modules/quality/quality.module.ts` — NEW
- `apps/cds-app/src/modules/quality/care-gap.controller.ts` — NEW: `POST /quality/care-gap-scan` (system token), returns gap report
- `apps/cds-app/src/modules/quality/care-gap.service.ts` — NEW: applies USPSTF / HEDIS rule subset
- `apps/cds-app/src/modules/quality/measures/uspstf-2026.ts` — NEW: rule library (start with 5: A1C, BP, CRC screening, mammogram, colonoscopy)
- `apps/admin-ui/src/app/dashboard/quality/page.tsx` — NEW (system-launch consumer)

**Acceptance:**
- System-token authenticated; returns paginated gap list for an organization
- 5 measure rules implemented
- Admin UI shows aggregate count + drill-down

**Effort:** 1 week.

**Dependencies:** PR1 + PR2 of Phase 1 must be merged.

---

### Phase 3 — Co-Pilot v2 (Writes) + Hospital Admin Wave (4 weeks)

> **Deep plan:** [`phase-3-copilot-writes-and-admin.md`](./phase-3-copilot-writes-and-admin.md) (file-level critical files, acceptance, effort per sub-phase)


**Goal:** the agent can act, not just answer — but always with provider confirm-and-sign. First major hospital-admin / RCM-facing automation.

#### 3A — Co-Pilot v2 (write actions)

**Critical files:**
- `apps/cds-app/src/engine/tools/clinical-write.tool.ts` — NEW: agent tool that posts to `/clinical-data/conditions`, `/allergies`, etc., returning a confirm-and-sign card payload (does NOT execute server-side until user confirms)
- `apps/cds-ui/src/components/copilot/ConfirmActionCard.tsx` — NEW: capability-aware action card (uses existing `writeRules` envelope to render the right form fields read-only / editable)
- `apps/cds-app/src/modules/copilot/copilot.controller.ts` — extend with `POST /copilot/confirm-action/:id` to execute previously-drafted action

**Acceptance:**
- Agent says "I'll add Type 2 diabetes as a problem-list item — confirm?" and renders a ConditionForm-equivalent card pre-filled
- User confirms → executes via existing clinical-write controller (capability rules enforced)
- Immutable fields shown read-only per per-EHR rules
- Audit events for both draft and execute

**Effort:** 1.5 weeks.

#### 3B — Coding Assistant

**Critical files:**
- `apps/cds-app/src/modules/coding/coding.controller.ts` — NEW: `POST /coding/suggest` (chief complaint + problem list → ICD-10/CPT suggestions)
- `apps/cds-app/src/modules/coding/coding.service.ts` — NEW: agent + terminology client
- `apps/cds-ui/src/components/coding/CodingSuggestionDrawer.tsx` — NEW: invoked from Co-Pilot or standalone

**Effort:** 0.5 week.

#### 3C — AI SBAR Handoff (nurse-facing)

**Critical files:**
- `apps/cds-app/src/modules/handoff/handoff.controller.ts` — NEW: `POST /handoff/sbar/:patientId`
- `apps/cds-app/src/engine/prompts/sbar.system.ts` — NEW
- `apps/cds-ui/src/components/handoff/SbarHandoff.tsx` — NEW

**Effort:** 0.5 week.

#### 3D — Prior-Auth Bot v0

**Critical files:**
- `apps/cds-app/src/modules/prior-auth/prior-auth.controller.ts` — NEW: CDS Hooks `order-sign` consumer
- `apps/cds-app/src/modules/prior-auth/prior-auth.service.ts` — NEW: CRD (Coverage Requirements Discovery) + LLM-drafted appeal letters
- `apps/cds-app/src/modules/prior-auth/payers/uhc-rules.ts` — NEW: one payer profile to start
- `apps/admin-ui/src/app/dashboard/prior-auth/page.tsx` — NEW: PA queue + status

**Acceptance:**
- Single payer profile (UnitedHealthcare or BCBS) wired
- CDS Hooks card returns CRD result; user can request LLM-drafted appeal
- PA queue visible to admin

**Effort:** 1.5 weeks.

**Dependencies:** Phase 2 complete; Phase 1 PR3 (Epic) recommended for full coverage but not strict blocker.

---

### Phase 4 — Clinical Events + Smart Inbox + Med Reconciliation (3 weeks)

> **Deep plan:** [`phase-4-clinical-events.md`](./phase-4-clinical-events.md)


**Goal:** turn the bridge into a clinical-event publisher. Workflow-app subscribes. AI reasons over events. This unlocks "lab released → AI drafts response" and similar high-value automations.

#### 4A — Bridge as event publisher

**Critical files:**
- `apps/bridge-api/src/modules/events/events.module.ts` — NEW
- `apps/bridge-api/src/modules/events/event-publisher.service.ts` — NEW: emits Kafka events on FHIR write completions
- `apps/bridge-api/src/interceptors/event-emit.interceptor.ts` — NEW: post-handler interceptor on FHIR write controllers
- New Kafka topics: `clinical.observation.created`, `clinical.medicationrequest.created`, `clinical.encounter.finished`, `clinical.condition.updated`

**Effort:** 1 week.

#### 4B — Workflow trigger spec extension

**Critical files:**
- `apps/workflow-app/src/engine/dag-executor.ts` — extend `trigger` node to handle `event` source with topic + filter
- `apps/admin-ui/src/app/dashboard/workflows/[id]/_components/TriggerSelector.tsx` — extend with event-trigger UX
- `packages/infra/prisma/schema.prisma` — `Workflow.triggerSpec` extended

**Effort:** 0.5 week.

#### 4C — Smart Inbox v1

**Critical files:**
- `apps/cds-app/src/modules/inbox/inbox.module.ts` — NEW
- `apps/cds-app/src/modules/inbox/inbox.controller.ts` — NEW: drafts replies for unread Communications/refills
- `apps/cds-app/src/modules/inbox/inbox.service.ts` — NEW: subscribes to `clinical.observation.created` etc., generates draft Communication
- `apps/cds-ui/src/app/app/inbox/page.tsx` — NEW: triage view

**Effort:** 1 week.

#### 4D — Med Reconciliation Assistant

**Critical files:**
- `apps/cds-app/src/modules/med-recon/med-recon.controller.ts` — NEW
- `apps/cds-app/src/engine/agents/med-recon.agent.ts` — NEW: compares MedicationStatement (home meds) ↔ MedicationRequest (active orders) ↔ discharge summary

**Effort:** 0.5 week.

---

### Phase 5 — Quality Reporting + Patient-Facing (3 weeks)

> **Deep plan:** [`phase-5-quality-and-patient-facing.md`](./phase-5-quality-and-patient-facing.md)


**Goal:** complete the holistic surface. System-launch quality measure reporting (HEDIS, eCQM). Patient-facing after-visit summary + auto-replier.

| Sub-phase | Scope | Critical files | Effort |
|---|---|---|---|
| 5A | Full HEDIS-2026 measure library (15+ measures) | `apps/cds-app/src/modules/quality/measures/hedis-2026/*.ts` | 1 week |
| 5B | eCQM reporting export (QRDA Cat I) | `apps/cds-app/src/modules/quality/exports/qrda-cat1.ts` | 0.5 week |
| 5C | After-visit summary | `apps/cds-app/src/modules/avs/avs.controller.ts`, multilingual | 0.5 week |
| 5D | Patient inbox auto-replier (HITL escalation) | `apps/cds-app/src/modules/patient-inbox/*` | 1 week |

---

## Sequencing Diagram

```
Week 1   Phase 0 (cleanup, rules trim, audit close, Refactor Ph2, LLMConfigTab)
Week 2-7 Phase 1 — MCP Server v2 (ehr-data-service registries)
         ├─ PR1+PR2 (Cerner end-to-end)              [weeks 2-5]
         └─ PR3 (Epic) || PR4 (Athena)               [weeks 6-7, parallel]
Week 6-8 Phase 2 — Co-Pilot v1 + Pre-Visit + Care-Gap (starts mid-Ph1)
Week 9-12 Phase 3 — Co-Pilot v2 + Coding + SBAR + Prior-Auth Bot
Week 13-15 Phase 4 — Clinical events + Smart Inbox + Med Recon
Week 16-18 Phase 5 — Quality + Patient-facing
Week 19-22 Buffer + Phase 1 PR5/PR6 (DCR + hardening)
```

**Total:** 22 weeks single-engineer, ~16 weeks with parallelization across BE / FE / agent specialty.

---

## Decisions Worth Pinning

1. **MCP server is the load-bearing layer.** Every agentic feature reaches FHIR through it. We do NOT build parallel agent → bridge paths.
2. **Confirm-and-sign for every write.** No autonomous AI prescribing. Card-pattern UX with capability-driven read-only fields.
3. **Voice is opt-in, text is default.** Mic button optional; keyboard works first. Web Speech in-browser → Whisper API server-side fallback.
4. **System launch is a first-class audience.** Hospital admin / RCM features sit on the same agent + MCP infra as provider features.
5. **Conversation persistence is mandatory.** HIPAA audit, "what did we discuss yesterday," and prompt-engineering iteration all require it. Schema lands in Phase 2A.
6. **Per-app LLM config (already shipped).** Practices pick the model. Co-Pilot uses `Application.llmConfig` resolution.
7. **Capability envelope drives UI.** Agent's action cards are the same component family as today's Condition/Allergy forms — `writeRules` envelope is the contract.
8. **No new vendor packages without descriptors.** All future EHRs added via the MCP descriptor pattern (Phase 1 establishes this).
9. **Workflow events = clinical events.** When agent + workflow both need a "lab released" trigger, they share one Kafka stream.

---

## Risks & Open Questions

| Risk | Mitigation |
|---|---|
| MCP spec churn (still moving) | Pin to specific MCP SDK version; isolate transport in `apps/mcp-app` only |
| LLM hallucination on clinical content | Confirm-and-sign on every write; "suggested code, click to verify" pattern; cite source FHIR ID on every claim |
| Voice transcription latency / accuracy | Stream STT; fall back to text on failure; never block the conversation on STT |
| Cerner / Epic / Athena PUT validators (the note saga taught us this) | Capability-driven write rules in MCP descriptors; per-vendor smoke tests; treat 200-with-silent-discard as a known failure mode |
| Patient-portal regulatory exposure (Phase 5D) | Phase 5D ships behind feature flag + BAA gating; HITL escalation is mandatory |
| Token cost of the Co-Pilot loop | Per-app LLM config + model selection (Sonnet vs Haiku per practice); aggressive caching of tool results; conversation summarization on long chats |

---

## What This Document Replaces

| Old | New role |
|---|---|
| `MEMORY.md` MASTER_PLAN pointer (March 2026) | Points to this doc instead |
| `docs/plans/MASTER_PLAN.md` (memory) | Marked historical |
| The 7 individual plan files | This doc has the cross-cutting view; individual plans are kept ONLY for outstanding-work-only narratives |
| Loose understanding of "what's next" | Single sequence above |

---

## Next Steps

When you're ready, say "start Phase 0" and I'll begin with the plan cleanup + rules trim + the three audit closes + LLMConfigTab + the three CDS provider overrides.

Or pick any phase / sub-phase to start out of order — Phase 1 PR1 (MCP descriptors) and Phase 0 are independent and can run in parallel if you want to put the agentic groundwork in motion immediately.

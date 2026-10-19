# Phase 3 — Co-Pilot Writes + Coding / SBAR / Prior-Auth Bot

> **Master plan:** `docs/plans/cds-roadmap-2026-05.md` Part C Phase 3.
> **Working agreement:** plan-mode approval ≠ start coding. Each sub-phase (3A–3D) needs its own go-ahead.

## Context

Phase 2 shipped Co-Pilot v1 (read-only voice + text), Pre-Visit Brief, and Care-Gap Dashboard v0. Phase 1 shipped MCP Server v2 (Cerner / Epic / Athena read+write tool surface via `packages/ehr-data-service` registries — see [`mcp-server-v2.md`](./mcp-server-v2.md)). Phase 3 turns the agent from "informer" into "actor" — every write goes through a confirm-and-sign card so the provider stays in control. Phase 3 also lands the first major hospital-admin / RCM-facing automation (Prior-Auth Bot) which is where the system-launch infra finally pays off.

## Goals

1. **Co-Pilot v2 writes** — agent can draft FHIR writes (Condition, Allergy, Observation, MedicationRequest, ServiceRequest); user confirms; existing capability-driven write rules enforced.
2. **Coding Assistant** — ICD-10 / CPT / SNOMED suggestions from problem list + chief complaint; reduces billing time.
3. **AI SBAR Handoff** — nurse-facing structured handoff generator; reduces near-misses on shift change.
4. **Prior-Auth Bot v0** — CDS Hooks `order-sign` consumer; CRD lookup; LLM-drafted appeals; PA queue for admin.

## Architecture (this phase)

```
Co-Pilot conversation
   │
   ▼ user asks "add T2DM as a problem"
Agent (Phase 1+2) ──draft──▶ ConfirmActionCard
                                  │
                                  │ user reviews + edits + clicks confirm
                                  ▼
                           clinical-write controllers (existing)
                                  │
                                  ▼
                           bridge → EHR (capability rules enforced)
                                  │
                                  ▼ AuditEvent emitted
                           Conversation persistence
```

**Cross-cutting decisions:**
- **No autonomous writes.** Every PUT/POST goes through ConfirmActionCard. The agent's job is to draft + explain.
- **Capability envelope is the contract.** ConfirmActionCard reads `writeRules` from the envelope just like existing forms — no parallel UX.
- **Audit chain is explicit.** Every draft + every confirm emits a separate `AuditEvent`. The pair is linked by `draftId`.
- **Coding Asst is reachable from anywhere.** Co-Pilot can call it; standalone drawer can call it. One service.
- **Prior-Auth uses CDS Hooks `order-sign`** — single canonical entry. We do NOT build a parallel UI flow; the EHR's existing order-entry pipeline lights up the card.

---

## Sub-Phase 3A — Co-Pilot v2 (Write Actions with Confirm-and-Sign)

**Scope:** agent gains 5 write tools (Condition / Allergy / Observation / MedicationRequest / ServiceRequest). Each tool returns a "draft action" envelope; the FE renders ConfirmActionCard; user confirms; controller executes.

### Critical files

**cds-app BE:**
- `apps/cds-app/src/engine/tools/clinical-write.tool.ts` — NEW: 5 DynamicStructuredTool instances. Each takes lean DTO + returns `{ draftId, resourceType, payload, capabilityGates: { readOnlyFields, requiredFields } }`. Does NOT call write controllers — only persists the draft.
- `apps/cds-app/src/modules/copilot/draft.service.ts` — NEW: draft lifecycle (`createDraft`, `getDraft`, `consumeDraft` — atomic via `cache.getdel`). Drafts TTL 10 min.
- `apps/cds-app/src/modules/copilot/copilot.controller.ts` — extend with `POST /copilot/confirm-action/:draftId` → loads draft, validates session.patient binding, hands to existing clinical-write service.
- `apps/cds-app/src/modules/copilot/copilot.module.ts` — wire `DraftService`.
- `apps/cds-app/src/engine/prompts/copilot-write.system.ts` — NEW: prompt fragment that teaches the agent when to draft vs ask clarifying questions.
- `apps/cds-app/src/modules/audit/audit.service.ts` — extend with `recordCopilotDraft(...)` and `recordCopilotConfirm(...)`.

**cds-ui FE:**
- `apps/cds-ui/src/components/copilot/ConfirmActionCard.tsx` — NEW: capability-gated form pre-filled from draft. Reuses `<ConditionForm>`, `<AllergyForm>` etc. as the inner renderer when the resource type matches; falls back to a generic FieldRenderer otherwise.
- `apps/cds-ui/src/components/copilot/ConfirmActionCard.helpers.ts` — NEW: maps `(resourceType, payload, capabilityGates)` → existing form props.
- `apps/cds-ui/src/lib/api.ts` — extend with `cdsApi.copilotConfirm(draftId, edits)`.
- `apps/cds-ui/src/components/copilot/MessageList.tsx` — extend renderer to recognize "draft action" turns and render ConfirmActionCard inline.

**Schema:**
- `packages/infra/prisma/schema.prisma` — extend `CdsConversationTurn` with `draftId String?` (nullable), `draftStatus enum('pending','confirmed','expired','rejected')`.

### Tool surface (Phase 3A)

| Tool | Inputs | Capability gates respected |
|---|---|---|
| `cds_draft_condition` | concept, state, category, severity?, abatementDate?, note? | `writeRules.create.allowedStates`, `forbiddenFields`, `notesAccepted` per EHR + category |
| `cds_draft_allergy` | substance concept, severity, reaction, criticality | `allergy.requiresVerificationStatus` per EHR |
| `cds_draft_observation` | category, code (LOINC), value, unit | `observationCategories` per EHR |
| `cds_draft_medication_request` | medication concept, dose, frequency, duration | per-EHR rule (declared in capability) |
| `cds_draft_service_request` | code, intent, priority, encounter | per-EHR rule |

Each tool runs the same input validation as the existing controllers (rejects state/category combinations the EHR doesn't allow) — agent gets actionable error messages, can self-correct.

### Acceptance

- Agent says "I'll add Type 2 diabetes as a problem-list item — confirm?" and renders ConfirmActionCard pre-filled.
- Form fields that are immutable on update show read-only with a tooltip ("Cerner doesn't allow editing this on update — record a new condition instead").
- User edits any editable field, clicks Confirm.
- POST/PUT executes via existing clinical-write controllers; same audit + capability path as form-driven writes.
- AuditEvent pair (`copilot.draft` + `copilot.confirm`) emitted, linked by `draftId`.
- Reject button discards draft; agent acknowledges in next turn.
- Draft TTL 10 min; expired drafts return 410 Gone with explanatory message.

### Effort

1.5 weeks (1 BE + 1 FE eng).

### Risks

- **Form components weren't designed to be embedded inside chat cards.** Mitigation: ConfirmActionCard wraps in a smaller container; some padding/header tweaks may be needed.
- **Agent may draft the wrong resource type.** Mitigation: prompt-engineering + validation before draft persistence.

---

## Sub-Phase 3B — Coding Assistant

**Scope:** suggest ICD-10 / CPT / SNOMED codes for a visit based on chief complaint + problem list + recent encounter notes. Reduce billing-time ambiguity.

### Critical files

**cds-app BE:**
- `apps/cds-app/src/modules/coding/coding.module.ts` — NEW
- `apps/cds-app/src/modules/coding/coding.controller.ts` — NEW: `POST /coding/suggest` with `{ context: { chiefComplaint?, encounterId?, problemListIds?, noteText? } }` → `{ icd10: ConceptCandidate[], cpt: ConceptCandidate[], snomed: ConceptCandidate[] }`.
- `apps/cds-app/src/modules/coding/coding.service.ts` — NEW: agent uses terminology client + LLM scoring.
- `apps/cds-app/src/engine/agents/coding.agent.ts` — NEW: scoped agent with `terminology_search` + `terminology_lookup` tools.
- `apps/cds-app/src/engine/prompts/coding.system.ts` — NEW: persona ("billing-aware coder, evidence-cited").

**cds-ui FE:**
- `apps/cds-ui/src/components/coding/CodingSuggestionDrawer.tsx` — NEW: invokable from the patient view + from inside Co-Pilot.
- `apps/cds-ui/src/lib/api.ts` — extend with `cdsApi.codingSuggest`.

**Co-Pilot integration:**
- `apps/cds-app/src/engine/tools/coding.tool.ts` — NEW: agent tool `cds_suggest_codes` that invokes coding.service. Result is rendered as a CodingCard (similar to ConfirmActionCard but lower stakes — copy-to-clipboard, not a write).

### Acceptance

- Drawer opens with current patient context auto-loaded.
- Returns 3–5 candidates per code system, each with display, system URI, and a confidence score.
- Each candidate has a "why" tooltip explaining the match.
- Co-Pilot can call this and surface the result inline.
- Cached per `(chiefComplaint hash, problemListIds, encounterId)` for 30 min.

### Effort

0.5 week.

---

## Sub-Phase 3C — AI SBAR Handoff (Nurse-Facing)

**Scope:** generate an SBAR-formatted handoff for a patient using the past 24h of data — vitals, events, pending tasks, active conditions, recent meds.

### Critical files

**cds-app BE:**
- `apps/cds-app/src/modules/handoff/handoff.module.ts` — NEW
- `apps/cds-app/src/modules/handoff/handoff.controller.ts` — NEW: `POST /handoff/sbar/:patientId` → returns structured SBAR (Situation, Background, Assessment, Recommendation).
- `apps/cds-app/src/modules/handoff/handoff.service.ts` — NEW: aggregates 24h Observations + ServiceRequests + MedicationAdministrations + recent Communications + active Conditions.
- `apps/cds-app/src/engine/prompts/sbar.system.ts` — NEW: prompt enforcing SBAR structure + nurse-appropriate tone.

**cds-ui FE:**
- `apps/cds-ui/src/components/handoff/SbarHandoff.tsx` — NEW: card with copy-to-clipboard + "regenerate" + edit-in-place.
- New left-rail nav entry "Handoff" in patient view (visible when session role = nurse).

**Capability:**
- Add `handoff.allow` to `ProviderCapabilities` envelope; default true; can disable per practice.

### Acceptance

- Renders within 5s for typical patient (≤200 Observations in window).
- SBAR structure is valid (4 sections, each prefixed).
- Cited resource IDs in each line so nurse can verify.
- Edit-in-place persists per (handoff session) — survives reload.

### Effort

0.5 week.

---

## Sub-Phase 3D — Prior-Auth Bot v0

**Scope:** consume CDS Hooks `order-sign` from the EHR, look up Coverage Requirements (CRD), and surface a card that either "OK to proceed", "PA needed — auto-fill", or "denied — draft appeal". Single payer profile (UnitedHealthcare OR BCBS — pick the customer-priority one).

### Critical files

**cds-app BE:**
- `apps/cds-app/src/modules/prior-auth/prior-auth.module.ts` — NEW
- `apps/cds-app/src/modules/prior-auth/prior-auth.controller.ts` — NEW: `POST /cds-services/prior-auth/order-sign` (CDS Hooks consumer endpoint).
- `apps/cds-app/src/modules/prior-auth/prior-auth.service.ts` — NEW: orchestrates CRD lookup + LLM appeal drafting + queue persistence.
- `apps/cds-app/src/modules/prior-auth/payers/uhc.profile.ts` — NEW: UHC-specific endpoint URLs, code lists, required documentation. (One file per payer; v0 ships one.)
- `apps/cds-app/src/modules/prior-auth/cds-hooks.dto.ts` — NEW: CDS Hooks request/response shapes.
- `apps/cds-app/src/engine/prompts/prior-auth.system.ts` — NEW: appeal-letter persona.
- `packages/infra/prisma/schema.prisma` — `PriorAuthRequest` model (orderId, patientId, payer, status, draftAppealText, submittedAt, decidedAt, decision).

**Admin UI:**
- `apps/admin-ui/src/app/dashboard/prior-auth/page.tsx` — NEW: PA queue with status filter (pending / approved / denied / appeal-drafted).
- `apps/admin-ui/src/app/dashboard/prior-auth/[id]/page.tsx` — NEW: PA detail with edit-and-submit on draft appeal.
- `apps/admin-ui/src/app/dashboard/applications/[id]/_components/CdsHooksTab.tsx` — extend with the prior-auth hook discovery URL for customer's EHR registration.

**CDS Hooks discovery:**
- `apps/cds-app/src/modules/prior-auth/discovery.controller.ts` — NEW: `GET /cds-services` returning the manifest with the prior-auth hook.

### Acceptance

- EHR triggers `order-sign` → cds-app returns a card within 3s.
- Card variants: OK / PA-required / denied.
- PA-required: queues a `PriorAuthRequest` row, returns "submitted" message.
- Denied: card includes "Draft Appeal" link → opens admin-ui detail with LLM-drafted text editable.
- Single-payer profile working end-to-end (UHC).
- PA queue reachable in admin-ui with status counts.

### Effort

1.5 weeks.

### Risks

- **CDS Hooks adoption varies per EHR.** Cerner / Epic both support it but rollout is per-customer. Document the 3-step EHR-side registration in `docs/recipes/register-cds-hook.md`.
- **CRD endpoints are payer-specific and hard to test against.** Mitigation: ship with a sandbox profile (uhc-sandbox) that returns canned responses for dev / demo.
- **Appeal drafting risks compliance issues.** Mitigation: every appeal text shows a banner "draft only — review before sending"; admin signs off explicitly.

---

## Verification — Phase-Level

| Item | Pass criterion |
|---|---|
| 3A end-to-end | Provider says "add T2DM" → ConfirmActionCard → confirm → Cerner returns 201 → patient view refreshes with the new condition |
| 3A capability rules | On Cerner update, immutable fields render read-only; on Cerner encounter-diagnosis create, abatement field hidden |
| 3A audit | Draft + confirm pair found in `AuditEvent` table linked by `draftId` |
| 3B coding | Suggesting codes for "T2DM with peripheral neuropathy" returns SNOMED + ICD-10-CM + relevant CPT |
| 3C SBAR | 24h handoff for a patient with 30+ vitals returns in under 5s, valid SBAR structure |
| 3D PA — happy path | UHC sandbox endpoint returns "covered" → CDS Hooks card "OK to proceed" |
| 3D PA — appeal flow | Sandbox returns "denied" → queue row created → admin opens, regenerates appeal, edits, marks "submitted" |

## What This Phase Enables Next

- Phase 4's Smart Inbox can reuse the `DraftService` from 3A (drafts of inbox replies are conceptually identical to drafts of resource writes).
- Phase 4's Med Recon can reuse the ConfirmActionCard pattern for medication change confirmations.
- Phase 5's HEDIS measure library can reuse the coding agent (3B) for measure code-set resolution.

## Risks & Open Questions

| Risk | Mitigation |
|---|---|
| CDS Hooks fan-out load on cds-app | Per-app rate limits via existing throttle infra |
| LLM hallucinates ICD codes that don't exist | Coding agent MUST verify every suggestion via terminology lookup before returning |
| Provider fatigue on confirm-and-sign | Telemetry: track time-to-confirm per draft type; if median > 30s, redesign card |
| Multiple drafts in flight (provider asks for two writes) | Drafts are independent rows; UI shows badge with count; confirms in any order |

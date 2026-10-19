# Phase 4 — Clinical Events + Smart Inbox + Med Reconciliation

> **Master plan:** `docs/plans/cds-roadmap-2026-05.md` Part C Phase 4.
> **Working agreement:** plan-mode approval ≠ start coding. Each sub-phase (4A–4D) needs its own go-ahead.

## Context

Phase 0–3 shipped the agentic foundation: MCP server, Co-Pilot v1+v2, Pre-Visit, Care-Gap, Coding, SBAR, Prior-Auth. Today the system is reactive — provider asks, agent answers/acts. Phase 4 makes it **proactive** — clinical events from the bridge fan out via Kafka, workflow-app subscribes, and AI generates drafts (inbox replies, med-recon recommendations) without waiting for a provider prompt.

This is also where the workflow-app finally earns its keep on clinical surfaces. Today it runs scheduled / webhook-triggered jobs; Phase 4 adds the missing trigger type — `event` — so a workflow can fire on `clinical.observation.created` (lab released) or `clinical.encounter.finished` (discharge) etc.

## Goals

1. **Bridge as event publisher** — every FHIR write through bridge emits a Kafka event with the resource's identity, type, and tenant context.
2. **Workflow event triggers** — `Workflow.triggerSpec` extended to subscribe to clinical Kafka topics with filter expressions.
3. **Smart Inbox v1** — providers see a triage view of unread clinical events grouped by patient + type, with AI-drafted responses ready to approve.
4. **Med Reconciliation Assistant** — at admit / discharge, AI compares home meds vs active orders vs discharge summary and surfaces a confirm-and-sign card (reuses Phase 3A pattern).

## Architecture (this phase)

```
EHR ──FHIR write──▶ bridge-api
                        │
                        ▼
               clinical-write controller
                        │
                        ▼ (post-handler interceptor)
                  EventPublisher
                        │
                        ▼
                  Kafka topics:
                   clinical.observation.created
                   clinical.medicationrequest.created
                   clinical.encounter.finished
                   clinical.condition.updated
                   clinical.allergy.created
                        │
                ┌───────┴───────┐
                ▼               ▼
        workflow-app        cds-app inbox.service
        (DAG executor)      (smart inbox draft generator)
                │
                ▼ executes user-defined workflows
        (e.g. "lab abnormal → AI draft response → queue for provider review")
```

**Cross-cutting decisions:**
- **Bridge is the only event source.** No app emits clinical events directly. Every clinical state change passes through bridge (admin-api, cds-app, workflow-app all write via bridge).
- **Event payload is minimal.** Kafka carries `{ resourceType, resourceId, tenantId, ehrName, occurredAt, action }`. Consumers do their own FHIR fetch with caching. Avoids stale-snapshot problems.
- **Tenant scoping is mandatory.** Every event carries `applicationId` and `organizationId`; consumers MUST filter by these.
- **At-least-once delivery, idempotent consumers.** No exactly-once ceremonies.
- **Smart Inbox uses the Phase 3A `DraftService`.** Conceptually identical to a Co-Pilot write draft.
- **Med Recon uses the Phase 3A ConfirmActionCard.** Reconciliation = a series of MedicationRequest creates / discontinues, each as a confirm-and-sign card.

---

## Sub-Phase 4A — Bridge as Event Publisher

**Scope:** every FHIR write via bridge-api fans out a Kafka event. No new event types yet; foundation only.

### Critical files

**bridge-api:**
- `apps/bridge-api/src/modules/events/events.module.ts` — NEW
- `apps/bridge-api/src/modules/events/event-publisher.service.ts` — NEW: thin wrapper over `@hs/infra/kafka` producer; publishes typed events.
- `apps/bridge-api/src/interceptors/clinical-event.interceptor.ts` — NEW: post-handler interceptor on FHIR write controllers (POST/PUT/DELETE). Reads response status + resource type + ID from response body; emits event on 2xx.
- `apps/bridge-api/src/main.ts` — register interceptor globally (same pattern as `FhirResponseInterceptor`).
- `apps/bridge-api/src/modules/events/event.types.ts` — NEW: `ClinicalEvent` interface.

**Schema (Kafka topic naming):**
```
clinical.{resourceType-lowercase}.{action}
   action ∈ created | updated | deleted
   resourceType: observation, medicationrequest, encounter, condition,
                 allergyintolerance, servicerequest, communication,
                 documentreference, appointment
```

**Event payload shape:**
```typescript
interface ClinicalEvent {
  eventId: string;            // UUIDv7
  resourceType: string;
  resourceId: string;
  action: 'created' | 'updated' | 'deleted';
  ehrName: string;
  applicationId: string;       // tenant scoping
  organizationId: string;
  patientId?: string;          // when present in resource
  encounterId?: string;
  versionId?: string;          // FHIR meta.versionId post-write
  occurredAt: string;          // ISO 8601
  source: { service: 'bridge-api'; clientId: string };
}
```

**Configuration:**
- New env vars: `KAFKA_CLINICAL_TOPIC_PREFIX` (default `clinical`), `KAFKA_EVENT_PUBLISHER_ENABLED` (default true).
- Per-app override: `Application.clinicalEventsEnabled bool` — lets practices opt out for compliance review.

### Acceptance

- Successful FHIR POST /Observation by bridge → `clinical.observation.created` event published with correct tenant + patient.
- Failed write (4xx/5xx) → no event published.
- Event interceptor adds < 5ms p95 to write latency.
- Disabled per-app (via `clinicalEventsEnabled = false`) → no events for that app.
- Schema-validated via JSON Schema in test suite.

### Effort

1 week.

### Risks

- **Late-binding of `applicationId` / `organizationId`.** Mitigation: interceptor reads from `request.user` (set by DualAuthGuard); fall back to omitting fields if not present (logged warn).
- **Event storm on bulk writes.** Mitigation: bulk endpoints should batch events (single event with `{ count, resourceIds: [] }` variant — defer if no current bulk endpoint).

---

## Sub-Phase 4B — Workflow Event Trigger Spec

**Scope:** workflow-app already supports `manual`, `webhook`, `schedule` triggers. Add `event` trigger type that subscribes to a clinical topic with optional filter.

### Critical files

**workflow-app:**
- `apps/workflow-app/src/modules/triggers/triggers.module.ts` — extend (or create if missing) with EventTriggerListener.
- `apps/workflow-app/src/modules/triggers/event-trigger-listener.service.ts` — NEW: Kafka consumer subscribed to `clinical.*` topics (configurable wildcard); on event, queries DB for workflows with matching trigger spec, dispatches via existing `workflow.execute` topic.
- `apps/workflow-app/src/engine/triggers/event-filter-evaluator.ts` — NEW: tiny expression evaluator (e.g., `resourceType == 'Observation' && payload.code in ['glucose', 'hba1c']`) — keep grammar small, reuse if possible.
- `apps/workflow-app/src/engine/dag-executor.ts` — extend `trigger` node to accept `triggerInput.event` shape.

**Schema:**
- `packages/infra/prisma/schema.prisma` — `Workflow.triggerSpec` JSON extended with discriminated `{ type: 'event', topic: 'clinical.observation.created', filter?: '<expression>' }`.

**Admin UI:**
- `apps/admin-ui/src/app/dashboard/workflows/[id]/_components/TriggerSelector.tsx` — extend with event trigger UX:
  - dropdown for topic
  - filter expression editor with autocomplete on common FHIR fields
  - live event preview (last 10 events of selected topic for this app)
- `apps/admin-ui/src/lib/sdk/workflows-client.ts` — extend trigger-spec types.

### Acceptance

- A workflow defined with `event` trigger + `clinical.observation.created` topic + filter `payload.code == '4548-4'` (HbA1c) fires within 2s of event.
- Filter mismatch → no execution, no log noise.
- Admin UI lets a user define this end-to-end.
- Multiple workflows on the same topic each fire independently.
- Live event preview shows recent matching events for testing.

### Effort

0.5 week.

---

## Sub-Phase 4C — Smart Inbox v1

**Scope:** triage view for clinical events that need provider attention (lab abnormal, refill request, message from patient). AI drafts a response; provider reviews and approves.

### Critical files

**cds-app BE:**
- `apps/cds-app/src/modules/inbox/inbox.module.ts` — NEW
- `apps/cds-app/src/modules/inbox/inbox.controller.ts` — NEW: `GET /inbox` (paginated triage list), `GET /inbox/:itemId`, `POST /inbox/:itemId/approve`, `POST /inbox/:itemId/reject`, `POST /inbox/:itemId/edit-and-approve`.
- `apps/cds-app/src/modules/inbox/inbox.service.ts` — NEW.
- `apps/cds-app/src/modules/inbox/inbox-listener.service.ts` — NEW: Kafka consumer on `clinical.observation.created`, `clinical.medicationrequest.created` (refills), `clinical.communication.created` (patient messages). For each, generates a draft response and persists as InboxItem.
- `apps/cds-app/src/engine/agents/inbox-draft.agent.ts` — NEW: scoped agent with read tools + a "draft response" output schema.
- `apps/cds-app/src/engine/prompts/inbox-draft.system.ts` — NEW: per-event-type prompts (lab vs refill vs message).
- `packages/infra/prisma/schema.prisma` — `InboxItem` model: id, applicationId, providerEndUserId, patientId, eventType, eventResourceId, draftAction (JSON), draftText, status (pending/approved/rejected/edited), createdAt, decidedAt.

**cds-ui FE:**
- `apps/cds-ui/src/app/app/inbox/page.tsx` — NEW: triage list, grouped by patient.
- `apps/cds-ui/src/app/app/inbox/[itemId]/page.tsx` — NEW: detail view with the source FHIR resource, AI draft, and approve/edit/reject controls.
- `apps/cds-ui/src/components/inbox/InboxItemCard.tsx` — NEW.
- `apps/cds-ui/src/lib/api.ts` — extend with `cdsApi.inbox*` methods.

### Inbox event types (v1)

| Source event | Generated draft |
|---|---|
| `clinical.observation.created` (abnormal lab) | Draft Communication to patient with result + interpretation + next step |
| `clinical.medicationrequest.created` (refill request, status=draft, intent=order with refillRequest extension) | Draft MedicationRequest approval + reasoning |
| `clinical.communication.created` (patient message inbound) | Draft Communication reply |

### Acceptance

- Lab abnormal event → InboxItem appears in provider's inbox within 10s.
- Detail view shows the source FHIR data + AI draft in side-by-side layout.
- "Approve" button creates a downstream FHIR write (Communication / MedicationRequest) and marks the item as resolved.
- "Edit and approve" lets the provider revise the draft before send.
- "Reject" marks the item with a reason; AI does not retry that event.
- Triage list paginated (50 default, 200 max).

### Effort

1 week.

### Risks

- **Liability around AI-drafted clinical messages.** Mitigation: Approve action is mandatory — no auto-send in v1. Audit trail per item.
- **Inbox storms** (e.g., bulk lab release on a Monday morning). Mitigation: rate-limit per provider, group by patient + type into one composite item when ≥ 3 same-type events within 30 min.

---

## Sub-Phase 4D — Med Reconciliation Assistant

**Scope:** at admission or discharge, surface a structured comparison of home meds (`MedicationStatement`) vs active orders (`MedicationRequest`) vs discharge summary; AI flags discrepancies; provider confirms via ConfirmActionCard chain (one card per change).

### Critical files

**cds-app BE:**
- `apps/cds-app/src/modules/med-recon/med-recon.module.ts` — NEW
- `apps/cds-app/src/modules/med-recon/med-recon.controller.ts` — NEW: `POST /med-recon/:patientId/scan` returns `{ matched: [], homeOnly: [], orderOnly: [], conflicts: [] }`.
- `apps/cds-app/src/modules/med-recon/med-recon.service.ts` — NEW: aggregates resources, normalizes by RxNorm code, runs LLM comparator for nuanced matches (e.g., generic vs brand, dose-equivalent).
- `apps/cds-app/src/engine/agents/med-recon.agent.ts` — NEW.
- `apps/cds-app/src/engine/prompts/med-recon.system.ts` — NEW: pharmacist persona.

**cds-ui FE:**
- `apps/cds-ui/src/components/med-recon/MedReconPanel.tsx` — NEW: 4-column view (matched / home-only / order-only / conflicts). Each row has "Order" / "Discontinue" / "Keep both" / "Reconcile" actions, all of which spawn ConfirmActionCard via the Co-Pilot draft pattern (reuses 3A).
- Patient view surfaces MedReconPanel as a top banner when `Encounter.class = 'IMP'` (inpatient) and `Encounter.period.start within 24h`, OR `discharge in flight`.

**Trigger integration:**
- Subscribes to `clinical.encounter.finished` from 4A → primes MedRecon for the patient (cache aggregation result).
- Subscribes to `clinical.encounter.created` with `class=IMP` → primes for admission.

### Acceptance

- For an inpatient with 8 home meds + 6 active orders + 5 discharge meds: panel renders in < 6s.
- Discrepancies clearly flagged (color-coded by severity).
- Each row's action drafts a ConfirmActionCard; multiple rows can be queued before confirming any.
- Approving a row removes it from the discrepancy list.

### Effort

0.5 week.

---

## Verification — Phase-Level

| Item | Pass criterion |
|---|---|
| 4A | Posting an Observation via bridge causes `clinical.observation.created` to land in Kafka with correct schema |
| 4B | Workflow with event trigger fires within 2s of matching event |
| 4C | Lab abnormal → inbox draft within 10s; approve writes Communication; audit trail intact |
| 4D | Inpatient encounter with discrepancies surfaces all four buckets correctly; confirm-and-sign chain works |
| Cross-cutting | Disabling `clinicalEventsEnabled` per-app stops both inbox + workflows for that app — single switch |

## What This Phase Enables Next

- Phase 5's HEDIS measure library can listen to `clinical.observation.created` to update gap-closure status in real time.
- Phase 5's patient inbox auto-replier reuses inbox.service draft generation (template substitution).
- Future "ambient" features (auto-charting based on ambient device events) can plug into the same Kafka stream once a vendor exposes them.

## Risks & Open Questions

| Risk | Mitigation |
|---|---|
| Kafka unavailability blocks bridge writes | Event publisher is best-effort; failure logged but not propagated. Writes succeed even if Kafka is down. |
| Stale events after retry | Consumers fetch fresh FHIR state by ID; minimal payload avoids stale-snapshot drift. |
| Multi-tenant noise (one practice's events leaking to another) | Mandatory `applicationId` filter at every consumer; integration test asserts cross-tenant isolation. |
| Inbox draft costs (LLM per event) | Per-app `inbox.maxDraftsPerHour` cap; bypass cap by approving the queue before it overflows. |
| Discharge summary parsing for med-recon | LLM extraction is approximate; ConfirmActionCard pattern keeps human in the loop. |

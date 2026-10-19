# Phase 5 — Quality Reporting + Patient-Facing

> **Master plan:** `docs/plans/cds-roadmap-2026-05.md` Part C Phase 5.
> **Working agreement:** plan-mode approval ≠ start coding. Each sub-phase (5A–5D) needs its own go-ahead.

## Context

Phase 4 turned the platform proactive (events + smart inbox + med-recon). Phase 5 closes two loops:

1. **Quality / value-based contracts** — hospitals are measured by HEDIS, eCQM, and CMS quality programs. Phase 5A+5B turns the FHIR data we already access into a measure-reporting engine. This is a system-launch use case (admin / quality team), not provider-interactive.

2. **Patient surface** — after-visit summaries and a patient-inbox auto-replier. These ride the existing EndUser model from Phase C of the SSO work. Different audience, lower-stakes interactions, but a strong product moat (patients become daily users, not just providers).

After Phase 5, the platform spans the full clinical-encounter loop: admin (config), system (automation), provider (decision support), nurse (handoff / inpatient flow), patient (engagement).

## Goals

1. **HEDIS-2026 measure library** — 15+ canonical measures shipped as a measure-evaluation engine over FHIR.
2. **eCQM / QRDA Cat I export** — generate the XML payload CMS / payers consume for value-based reporting.
3. **After-Visit Summary** — plain-language, multilingual encounter recap delivered to patient (portal + PDF).
4. **Patient inbox auto-replier** — FAQ-style, with mandatory HITL escalation for anything off-pattern.

## Architecture (this phase)

```
Quality reporting (system-launch):
   admin team        ──▶ POST /quality/scan   (system token)
                              │
                              ▼
                     QualityService
                              │
                              ▼
                     measure modules (15+)
                              │
                              ▼
                     Kafka events from Phase 4 ──▶ live gap-status updates
                              │
                              ▼
                     QRDA Cat I exporter ──▶ CMS / payer

Patient surface:
   Encounter.finished event ──▶ AVS generator ──▶ Communication + DocumentReference
                                                               │
                                                               ▼
                                                     patient portal (admin-ui /account/...)
                                                     OR PDF email via @hs/mailer

   patient message ──▶ patient-inbox listener
                            │
                            ▼
                     auto-replier agent
                            │
                            ├──▶ confident match (FAQ) → reply (still HITL approve)
                            └──▶ unsure → escalate to provider inbox (Phase 4C)
```

**Cross-cutting decisions:**
- **HEDIS measures are functions, not config.** Each measure is a TS module exporting `(fhirCtx) → MeasureResult`. Easier to test, code-review, version-control than a DSL.
- **QRDA generation is a pure formatter.** The MeasureResult shape feeds it; no FHIR re-fetch.
- **AVS uses the `@hs/mailer`** package (already shipped for OTP) for email delivery; portal uses the EndUser session.
- **Patient auto-replier is HITL by default in v1.** No customer should hear "AI replied to my patient" without explicit opt-in.

---

## Sub-Phase 5A — HEDIS-2026 Measure Library

**Scope:** 15 canonical HEDIS measures implemented as TS modules + a `QualityService` that orchestrates them. Reads FHIR via MCP (Phase 1) and consumes Kafka events from Phase 4 for live gap-status.

### Critical files

**cds-app BE:**
- `apps/cds-app/src/modules/quality/quality.module.ts` — already created in Phase 2C (Care-Gap v0); extend.
- `apps/cds-app/src/modules/quality/measure-runner.service.ts` — NEW: takes a measure id + patient id (or population) → returns `MeasureResult`.
- `apps/cds-app/src/modules/quality/measure-registry.ts` — NEW: registry of available measures keyed by id (`HEDIS-CDC-A1C`, `HEDIS-CBP`, etc.).
- `apps/cds-app/src/modules/quality/measures/hedis-2026/*.ts` — NEW: one file per measure (15 files).
- `apps/cds-app/src/modules/quality/types.ts` — NEW: `MeasureResult`, `MeasureCriteria`, `Population`.

**Initial 15 measures (HEDIS-2026):**

| Code | Name |
|---|---|
| HEDIS-CDC-A1C | Comprehensive Diabetes Care: HbA1c Testing |
| HEDIS-CDC-A1C-Control | Comprehensive Diabetes Care: HbA1c Control < 8 |
| HEDIS-CBP | Controlling High Blood Pressure |
| HEDIS-COL | Colorectal Cancer Screening |
| HEDIS-BCS | Breast Cancer Screening |
| HEDIS-CCS | Cervical Cancer Screening |
| HEDIS-CIS | Childhood Immunization Status |
| HEDIS-IMA | Immunizations for Adolescents |
| HEDIS-FUH | Follow-Up After Hospitalization for Mental Illness |
| HEDIS-AMM | Antidepressant Medication Management |
| HEDIS-OMW | Osteoporosis Management in Women |
| HEDIS-MMA | Medication Management for People with Asthma |
| HEDIS-PCR | Plan All-Cause Readmissions |
| HEDIS-AAB | Avoidance of Antibiotic Treatment for Acute Bronchitis |
| HEDIS-LSC | Lead Screening in Children |

**Measure module shape:**
```typescript
// e.g. apps/cds-app/src/modules/quality/measures/hedis-2026/hedis-cdc-a1c.ts
export const measure: HedisMeasure = {
  id: 'HEDIS-CDC-A1C',
  name: 'Comprehensive Diabetes Care: HbA1c Testing',
  populationCriteria: { ageMin: 18, ageMax: 75, conditionCodes: ['E11.*', 'E10.*'] },
  numeratorCriteria: { observationCodes: ['4548-4'], lookbackDays: 365 },
  evaluate(ctx: MeasureContext): MeasureResult { /* fetches via MCP, applies rules */ },
};
```

**Live gap status (Phase 4 integration):**
- `apps/cds-app/src/modules/quality/live-status-listener.service.ts` — NEW: subscribes to `clinical.observation.created`; for each, checks if it closes any open measure gap for the patient. Updates `MeasureGap` row status.
- `packages/infra/prisma/schema.prisma` — `MeasureGap` model: id, applicationId, organizationId, patientId, measureId, status (open / closed / not-applicable), openedAt, closedAt.

**Admin UI:**
- `apps/admin-ui/src/app/dashboard/quality/page.tsx` (extend from Phase 2C) — show all 15 measures with population counts.
- `apps/admin-ui/src/app/dashboard/quality/[measureId]/page.tsx` — NEW: measure detail with gap list per patient.
- `apps/admin-ui/src/app/dashboard/quality/_components/MeasureCard.tsx` — NEW.

### Acceptance

- All 15 measures pass unit tests against canned FHIR fixtures.
- System-token endpoint `POST /quality/scan` runs all measures across an organization in < 30s for 1000 patients.
- Live gap closure: a new HbA1c lab event closes the corresponding gap within 5s.
- Admin UI shows aggregate gap counts + drill-down per measure.

### Effort

1 week.

### Risks

- **Measure interpretation drift between vendors.** HEDIS specs are stable; vendor coding varies. Mitigation: measure modules use canonical code-sets via terminology service.
- **Population query performance.** Patient cohorts can be 10k+. Mitigation: paginate at the FHIR layer; stream results to the admin UI.

---

## Sub-Phase 5B — eCQM / QRDA Cat I Export

**Scope:** generate QRDA Category I XML for individual patients (one file per patient per measure period). Required for CMS quality submissions and value-based contracts.

### Critical files

**cds-app BE:**
- `apps/cds-app/src/modules/quality/exports/qrda-cat1.exporter.ts` — NEW: pure function `(MeasureResult, patientFhir, measurePeriod) → string (XML)`.
- `apps/cds-app/src/modules/quality/exports/qrda-cat1.templates/*.xml` — NEW: XML skeleton templates per measure.
- `apps/cds-app/src/modules/quality/quality.controller.ts` — extend with `POST /quality/qrda/:measureId/:patientId` returning `application/xml`.
- `apps/cds-app/src/modules/quality/exports/qrda-validator.service.ts` — NEW: validates XML against the QRDA Cat I schema before serving.

**Admin UI:**
- `apps/admin-ui/src/app/dashboard/quality/[measureId]/page.tsx` — extend with "Export QRDA" button per gap row + bulk-export action.

### Acceptance

- For HEDIS-CDC-A1C with sample patient → emits valid QRDA Cat I XML that passes the schema validator.
- Bulk export packages multiple patients into a ZIP (one file each).
- All 15 measures have at least one passing QRDA fixture in tests.

### Effort

0.5 week.

### Risks

- **CMS submission rules change yearly.** Mitigation: keep template + validator behind a `qrda-2026` namespace; bump for 2027 cycle.

---

## Sub-Phase 5C — After-Visit Summary

**Scope:** at encounter close, generate a plain-language summary with what happened, what to do, when to follow up. Multi-lingual (start with EN + ES). Delivered via portal + email.

### Critical files

**cds-app BE:**
- `apps/cds-app/src/modules/avs/avs.module.ts` — NEW
- `apps/cds-app/src/modules/avs/avs.controller.ts` — NEW: `POST /avs/generate/:encounterId`, `GET /avs/:avsId` (idempotent regenerate is allowed).
- `apps/cds-app/src/modules/avs/avs.service.ts` — NEW.
- `apps/cds-app/src/modules/avs/avs-listener.service.ts` — NEW: subscribes to `clinical.encounter.finished`; auto-generates AVS for the patient in their preferred language(s).
- `apps/cds-app/src/engine/agents/avs.agent.ts` — NEW.
- `apps/cds-app/src/engine/prompts/avs.system.ts` — NEW: plain-language persona, sixth-grade reading level enforced; multilingual.
- `packages/infra/prisma/schema.prisma` — `AfterVisitSummary` model: id, applicationId, encounterId, patientId, languageCode, htmlContent, plainText, pdfStorageRef, createdAt, deliveredAt.
- `packages/mailer/src/templates/avs-email.ts` — NEW: email template with link to portal + PDF attachment.

**Patient-facing UI (admin-ui under `(oauth)` route group from SSO Phase C):**
- `apps/admin-ui/src/app/(oauth)/account/visits/page.tsx` — NEW: list of recent visits with their AVS.
- `apps/admin-ui/src/app/(oauth)/account/visits/[avsId]/page.tsx` — NEW: AVS detail with language selector, print-to-PDF.

**FHIR mapping:**
- `apps/cds-app/src/modules/avs/avs-fhir-mapper.service.ts` — NEW: writes the generated summary to FHIR as a `DocumentReference` linked to the encounter (so it's persistent in the chart).

### Acceptance

- Encounter finishes → AVS generated in default language within 30s.
- AVS written to FHIR as `DocumentReference` linked to encounter.
- Email sent to patient with portal link + PDF.
- Patient can view AVS in admin-ui under `/account/visits`.
- Language switcher (EN/ES) regenerates server-side; cached per (encounter, language).
- Reading level verified ≤ Grade 6 by automatic checker.

### Effort

0.5 week.

### Risks

- **Reading level slippage in different languages.** Mitigation: prompt enforces target level; checker runs per language.
- **PHI in email body.** Mitigation: email contains link only, not content; PDF attachment is signed-URL-protected.

---

## Sub-Phase 5D — Patient Inbox Auto-Replier (HITL)

**Scope:** patient-initiated message lands → AI suggests a reply OR escalates to the provider inbox (Phase 4C). HITL approval is mandatory in v1; no auto-send.

### Critical files

**cds-app BE:**
- `apps/cds-app/src/modules/patient-inbox/patient-inbox.module.ts` — NEW
- `apps/cds-app/src/modules/patient-inbox/patient-inbox.controller.ts` — NEW: `POST /patient-inbox/message` (patient sends), `GET /patient-inbox/thread/:threadId`, `POST /patient-inbox/:itemId/approve` (provider).
- `apps/cds-app/src/modules/patient-inbox/auto-replier.service.ts` — NEW: classifies message → FAQ-match | clinical | unsure. FAQ = LLM drafts reply citing FAQ source. Clinical = escalates to provider inbox (Phase 4C). Unsure = escalates with note.
- `apps/cds-app/src/modules/patient-inbox/faq-store.service.ts` — NEW: per-app FAQ database. Admin can author FAQs in admin-ui.
- `apps/cds-app/src/engine/agents/patient-inbox.agent.ts` — NEW.
- `apps/cds-app/src/engine/prompts/patient-inbox.system.ts` — NEW: empathetic, plain-language, on-pattern only.
- `packages/infra/prisma/schema.prisma` — `PatientInboxThread`, `PatientInboxMessage`, `PracticeFaq` models.

**Admin UI:**
- `apps/admin-ui/src/app/dashboard/patient-inbox/faqs/page.tsx` — NEW: FAQ authoring (per-app).
- `apps/admin-ui/src/app/dashboard/patient-inbox/page.tsx` — NEW: provider's view of patient threads needing approval.

**Patient UI:**
- `apps/admin-ui/src/app/(oauth)/account/messages/page.tsx` — NEW: patient's thread list + new-message form.

### Acceptance

- Patient sends "Can I take ibuprofen with my BP medication?" → escalates to provider inbox (clinical).
- Patient sends "When does the office close on Friday?" → FAQ matches, AI drafts reply, queued for provider approval.
- Provider approves → reply sent to patient.
- Provider rejects + edits → manual reply sent.
- All threads / messages persisted with audit (who/when/what).
- Admin can author FAQs in admin-ui; auto-replier picks them up immediately.

### Effort

1 week.

### Risks

- **Liability of any AI reply to a patient.** Mitigation: HITL mandatory in v1; opt-in auto-send is post-v1 with BAA + practice-level signoff.
- **PHI handling in patient messages.** Already covered by HIPAA compliance posture; inbox messages stored in DB (encrypted at rest), never in logs.
- **Drift in FAQ phrasing.** Practices author FAQs; periodic review reminder via admin UI.

---

## Verification — Phase-Level

| Item | Pass criterion |
|---|---|
| 5A | All 15 HEDIS measures pass unit fixtures + scan completes in < 30s for 1000 patients |
| 5A live status | New A1C lab via Phase 4 events closes the matching gap within 5s |
| 5B | QRDA XML for HEDIS-CDC-A1C validates against the schema |
| 5C | Encounter finish → AVS in FHIR + email + portal within 30s |
| 5C i18n | Spanish AVS reads naturally at Grade-6 level |
| 5D | Clinical question escalates correctly; FAQ question gets a draft pending approval |
| Cross-cutting | Patient surface gated by EndUser session; no cross-tenant leakage |

## What This Phase Concludes

After Phase 5 the platform covers the full clinical surface:

| Audience | Capability |
|---|---|
| Admin / IT | App config, EndUser management, OAuth IdP, LLM config, CDS hooks registration |
| Quality team | HEDIS scoring, gap dashboards, eCQM exports, live status updates |
| RCM / billing | Coding assistant, prior-auth bot, denial prevention |
| Provider | Co-Pilot (voice + text, read + write), Pre-Visit Brief, smart inbox |
| Nurse | SBAR handoff, vitals trends, escalations |
| Inpatient flow | Med Reconciliation at admit / discharge |
| Patient | After-visit summary, patient inbox, message threads |

This is the "complete platform" — every persona has a daily-use surface, all riding the same MCP + agent + bridge infrastructure.

## Risks & Open Questions

| Risk | Mitigation |
|---|---|
| HEDIS spec changes (yearly cadence) | Version measure modules under `hedis-{year}/`; keep older versions for trailing reports |
| QRDA validator drift | Vendor schema files version-pinned in repo |
| Patient surface regulatory exposure (HIPAA, state laws) | Feature-flag patient surfaces per-practice; BAA gating; no auto-replies in v1 |
| Reading-level enforcement on AVS | Automated checker + sampling review; flag escalations to product team |
| Cost of running 15 measures × 10k patients | Cache MeasureResult per (patient, measure); recompute only on relevant events |

## Post-Phase 5 Possibilities (Out of Scope)

- Ambient scribing integration (partner with Abridge / DAX rather than build)
- Population health dashboards beyond HEDIS (e.g., CMS readmission, social determinants)
- Multi-language patient inbox auto-replier with broader language support
- Real-time provider analytics dashboard (volume, time-to-confirm, denial rates)
- Predictive readmission risk scoring (separate ML pipeline)

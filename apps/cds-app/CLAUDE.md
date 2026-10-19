# cds-app — Hot-Zone Notes for AI

## What this app is

CDS = third-party SMART app, receives JWE from bridge, calls bridge FHIR APIs with the platform token. Never talks to EHR directly. Three launch modes: `provider-ehr`, `provider-standalone`, `system`.

## Module map (only what matters for new work)

| Module | Purpose |
|---|---|
| `modules/launch/` | JWE decrypt, session creation, mode-specific launch handlers |
| `modules/clinical-data/` | Read aggregates (Patient, Conditions, Allergies, Meds, Vitals); `fhir-mappers.ts` is the single source of truth for FHIR → domain mapping |
| `modules/clinical-write/` | POST/PUT controllers for Condition/Allergy/Observation/Appointment/Encounter; capability-driven write rules |
| `modules/providers/` | Per-EHR provider classes (`cerner`, `athenanet`, `drchrono`, `elation`); each declares `getCapabilities(mode)` |
| `modules/providers/capabilities/` | Capability types — wire contract for FE gating |
| `modules/care-plan/` | AI-generated care plan: storage, versioning, FHIR-mapping (DocumentReference + Communication) |
| `modules/analysis/` | Runs the LangChain agent loop end-to-end |
| `modules/terminology/` | Terminology lookup proxy to bridge |
| `engine/` | LangChain agents, prompts, tools, model factory — NOT a separate package |
| `services/` | Bridge client, terminology client, session, platform token |

## Capability-driven design — DO NOT branch on EHR name

Every per-EHR difference lives in the provider class's `getCapabilities()`. Controllers, body builders, FE forms read the resulting envelope. **No `if (ehrName === ...)` outside the factory.** See `.claude/rules/16-cds-capability-driven.md` for the full rule.

Reference implementation: `modules/providers/cerner/cerner.provider.ts` — Condition write rules with `update.immutableFields`, `update.allowedStates`, `update.maxCategoryItems`, `forbiddenFields`, `notesAccepted`.

## Provider FHIR-id contract

`session.providerSession.providerFhirId` is the **full FHIR reference** (`Practitioner/12345`), normalized at the bridge launch boundary per the SMART id_token `fhirUser` contract. Do NOT prepend `Practitioner/` again — it produces `Practitioner/Practitioner/12345` which Cerner rejects. Use `toFhirReference(idOrRef, defaultResourceType)` from `utils/fhir-reference.ts` if defensive normalization is needed.

## Common gotchas (the Cerner note saga playbook)

1. **Cerner Condition.note is fully immutable on PUT** ("Does not allow updates" per Oracle Health docs). Existing notes are preserved verbatim, new entries are silently discarded. Notes are addable only at create time.
2. **Cerner PUT returns 200 even when it silently drops fields.** Don't trust `200` as confirmation that note/severity/etc. persisted. Refetch and verify.
3. **Cerner needs uniformly-shaped Annotation entries** when notes ARE editable elsewhere; minimal `{ text }` works on POST but PUT validators are stricter.
4. **`If-Match: W/"<versionId>"` required** for Cerner Condition PUT. Already wired through `WriteOptions.ifMatch` + `@IfMatch()` decorator.

## Engine entry points (LangChain agents)

- `engine/agents/clinical-analyst.agent.ts` — main ReAct loop, tools: `fhir_search`, `fhir_read`
- `engine/tools/` — `DynamicStructuredTool` instances; deep type issues require `as any` cast (documented)
- `engine/prompts/system.ts` — 5 personas (PCP, medication, preventive care, safety)
- `engine/models/model-factory.ts` — multi-provider (Anthropic / OpenAI / Gemini / Ollama / Bedrock / vLLM); per-app config from `Application.llmConfig`

## When adding a new clinical write resource

1. Add capability fields to `ProviderCapabilities` in `modules/providers/capabilities/capability.types.ts`
2. Add per-EHR rules in each provider's `getCapabilities()` — defaults come from `cds-resource-provider-base.ts`
3. Add a body builder in `modules/clinical-write/{resource}-body.builder.ts` (mirror `condition-body.builder.ts`)
4. Add controller endpoint + DTO
5. Add capability-aware FE form (mirror `ConditionForm.tsx` capability gating)
6. Cerner provider gets actual rules; Athena/DrChrono/Elation start as `notReady` until verified

## Caching rules (cds-app)

- Terminology lookups: 15 min default
- Bridge-side FHIR cache is opt-in via `Cache-Control` headers — cds-app rarely sets them on writes
- Conversation persistence (Co-Pilot, Phase 2) goes in `CdsConversation` table, not Redis

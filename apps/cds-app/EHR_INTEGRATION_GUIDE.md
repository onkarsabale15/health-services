# CDS EHR Integration Guide

> How to add a new EHR vendor (or a new clinical resource for an existing
> vendor) to the CDS app. Read alongside
> [`.claude/rules/16-cds-capability-driven.md`](../../.claude/rules/16-cds-capability-driven.md).

## Mental Model

The CDS app talks to many EHRs through Bridge. Bridge handles auth + transport
(SMART session, X-Site-Id, OAuth refresh, FHIR HTTP). CDS handles **clinical
semantics** — what's a valid Condition state for this EHR, what fields are
immutable on PUT, which categories the UI should show.

EHR variation lives in **one** place: a `CdsResourceProvider` subclass. The
controller, body builder, response envelope, and front-end form all pull rules
out of `provider.getCapabilities(mode)`. **No `if (ehrName === '…')` branches
anywhere except the factory.**

```
                ┌──────────────────────────────────────────────┐
                │ CernerProvider extends StandardFhirR4Provider│
                │   getCapabilities(mode) ──► ProviderCaps     │
                │   listConditions / createResource / readFhir │
                └──────────────────┬───────────────────────────┘
                                   │
   ┌───────────────────────────────┼───────────────────────────────┐
   │                               │                               │
   ▼                               ▼                               ▼
Controller                    Body Builder                  EnvelopeBuilder
(validate request             (consume forbidden /          (project caps onto
 against rules)                immutable / notes-           ResourceCapabilities
                               accepted fields)              for FE)
                                                                     │
                                                                     ▼
                                                       FE form reads rules,
                                                       renders accordingly
```

## Anchor Files

| Concern | File |
|---------|------|
| Provider interface | `src/modules/providers/cds-resource-provider.interface.ts` |
| Default ("everything off") base | `src/modules/providers/base/cds-resource-provider-base.ts` |
| Standard FHIR R4 base (Cerner/Epic/Athena reuse) | `src/modules/providers/base/standard-fhir-r4.provider.ts` |
| Provider factory + DI registry | `src/modules/providers/cds-resource-provider.factory.ts` |
| Provider module wiring | `src/modules/providers/providers.module.ts` |
| Capability shapes | `src/modules/providers/capabilities/capability.types.ts` |
| Per-resource cap projection | `src/modules/providers/capabilities/ehr-capabilities.ts` |
| Envelope builder | `src/modules/providers/envelope-builder.service.ts` |
| Bridge HTTP wrapper | `src/services/bridge-client.service.ts` |
| Coding enrichment | `src/services/fhir-coding-enricher.ts` |
| Reference implementation (Cerner) | `src/modules/providers/cerner/cerner.provider.ts` |
| Cerner spec | `src/modules/providers/cerner/cerner.provider.spec.ts` |

## Step 1 — Verify Bridge Supports the EHR

CDS NEVER talks to an EHR directly — it goes through Bridge. Before touching
CDS:

1. Confirm Bridge has the EHR's auth flow (`apps/bridge-api`).
2. Confirm Bridge's FHIR endpoints (`searchFhir`, `readFhir`, `createFhir`,
   `updateFhir`) work end-to-end against the vendor's sandbox.
3. Confirm `@hs/bridge-client` returns sane shapes for that vendor.

If any of those is missing, the work belongs in Bridge, not CDS.

## Step 2 — Decide What the Provider Extends

| EHR's API surface | Extend |
|-------------------|--------|
| Standard FHIR R4 with vendor quirks (Cerner, Epic, Athena, NextGen) | `StandardFhirR4Provider` |
| Custom non-FHIR API or a heavy proprietary surface | `CdsResourceProviderBase` directly |

`StandardFhirR4Provider` already implements list/read/create/update via the
Bridge SDK — most vendors only override a handful of methods (e.g. Cerner
overrides `listMedications` to skip MedicationStatement).

## Step 3 — Scaffold the Provider

```typescript
// src/modules/providers/{vendor}/{vendor}.provider.ts
import { Injectable } from '@nestjs/common';
import { BridgeClientService } from '../../../services/bridge-client.service';
import { FhirCodingEnricher } from '../../../services/fhir-coding-enricher';
import { StandardFhirR4Provider } from '../base/standard-fhir-r4.provider';
import type {
  ClinicalOperation,
  LaunchMode,
  OperationSupport,
  ProviderCapabilities,
} from '../capabilities/capability.types';

@Injectable()
export class EpicProvider extends StandardFhirR4Provider {
  override readonly ehrName = 'epic';

  constructor(bridge: BridgeClientService, codingEnricher: FhirCodingEnricher) {
    super(bridge, codingEnricher);
  }

  override getCapabilities(mode: LaunchMode): ProviderCapabilities {
    // Declare ONLY what the vendor + your CDS-side implementation actually
    // support. Everything else stays unsupported (defaults from base).
    // ...
  }
}
```

## Step 4 — Declare Capabilities

`getCapabilities(mode)` is the source of truth. Populate every relevant field:

```typescript
return {
  ehrName: this.ehrName,
  encounterModel: 'native',           // 'native' | 'appointment-derived' | 'none'
  operations: { /* per-ClinicalOperation OperationSupport */ },
  conditionCategories: mode === 'system'
    ? ['encounter-diagnosis']
    : ['encounter-diagnosis', 'problem-list-item'],
  observationCategories: ['vital-signs', 'laboratory'],
  appointment: { allowCreate: false, allowDeriveEncounter: false },
  allergy: { requiresVerificationStatus: true },
  encounter: { allowClose: true },

  // Per-EHR write rules — read by controller, body builder, and FE form.
  condition: {
    create: {
      allowedStates: [/* allowed wire-contract states */],
      perCategory: {
        // Tighter rules per category. e.g. encounter-diagnosis must be
        // active-only on Cerner; abatementDate is rejected.
      },
      notesAccepted: true,
    },
    update: {
      immutableFields: [/* fields PUT cannot change */],
      requiresIfMatch: true,             // most vendors require it; Cerner does
      perCategory: { /* category-specific PUT forbids */ },
    },
  },
};
```

### Capability Field Reference

| Field | Drives |
|-------|--------|
| `operations[op].supported` | `CapabilityGatedButton` rendering, controller 400-on-unsupported |
| `operations[op].reason` | Tooltip when an action is disabled |
| `operations['condition.write'].encounterBound` | FE auto-binds Condition to active encounter |
| `encounterModel: 'none'` | Hides EncounterPicker on the patient page |
| `conditionCategories` | `CategorySelector` options (single → auto-selects) |
| `condition.create.allowedStates` | Controller validation; FE state picker filter |
| `condition.create.perCategory[c].forbiddenFields` | Body builder skips emitting; FE hides field |
| `condition.create.notesAccepted` | Body builder + FE textarea visibility on POST |
| `condition.update.immutableFields` | Body builder preserves from existing; FE renders read-only |
| `condition.update.requiresIfMatch` | Provider's `updateResource` MUST send `If-Match` |
| `appointment.allowDeriveEncounter` | Patient page can derive encounter from picked appointment |
| `allergy.requiresVerificationStatus` | Allergy form validation |

## Step 5 — Register the Provider

```typescript
// src/modules/providers/providers.module.ts
@Module({
  providers: [EpicProvider, /* … */],
  exports:   [EpicProvider, /* … */],
})
export class ProvidersModule { ... }

// src/modules/providers/cds-resource-provider.factory.ts
// (DiscoveryService auto-registers anything with `ehrName` set,
//  or update the manual registry if your factory uses one.)
```

## Step 6 — Override Methods That Differ from the Base

Pick the smallest surface area that captures the vendor's quirks. Examples:

```typescript
// MedicationStatement is a guaranteed 4xx on Cerner — skip it.
override async listMedications(ctx, options) { ... }

// Vendor returns a custom shape for Practitioner — override the mapper.
override async getPractitioner(ctx) { ... }
```

Do NOT override what works on the base. `StandardFhirR4Provider`'s default
`listConditions` / `listAllergies` / `createResource` / `readResource` /
`updateResource` already handle the standard FHIR cases.

## Step 7 — Test the Provider

`src/modules/providers/{vendor}/{vendor}.provider.spec.ts` MUST cover:

1. `ehrName` matches the registry key.
2. `getCapabilities(mode)` shape per launch mode.
3. Each overridden method calls Bridge with correct args (use jest mocks for
   `BridgeClientService`).
4. Capability rules render correctly: e.g. `condition.create.perCategory['encounter-diagnosis'].forbiddenFields`
   includes `'abatementDate'`.

Run: `cd apps/cds-app && npx jest {vendor}.provider.spec`

## Step 8 — Wire Through the Controller / Builder (Only If Needed)

If you're adding a new resource (not just a new EHR for an existing one):

1. Define a `{Resource}WriteRules` shape in `capability.types.ts`.
2. Attach it to `ProviderCapabilities` (`{resource}?: {Resource}WriteRules`).
3. Project it onto the FE envelope in `getResourceCapabilities`
   (`writeRules: caps.{resource}` for that resource).
4. The controller looks up rules via `writeService.getCapabilities(session)`
   and passes them to a `{Resource}BodyBuilder`.
5. The body builder consumes `forbiddenFields` / `immutableFields` /
   `notesAccepted` — never branches on `ehrName`.

## Step 9 — Mirror Types on the FE

`apps/cds-ui/src/lib/capabilities.types.ts` mirrors the BE shape. The FE form
consumes `props.capabilities.writeRules` to gate every UI decision. Look at
`apps/cds-ui/src/components/ConditionForm.tsx` for the canonical pattern:

- `forbiddenFields` / `immutableFields` / `allowedStates` derived from rules
- `categoryReadOnly` / `codeReadOnly` / `showAbatementField` / `showNoteEditor`
  derived from those sets
- `StatePicker` filters its options by `allowedStates`
- An effect resets coupled state when category change makes the current
  selection invalid

## Step 10 — Verification Checklist

- [ ] `npx turbo build --filter=@hs/cds-app --filter=@hs/cds-ui` is green
- [ ] `npx jest` in `apps/cds-app` passes (provider spec + any controller
      spec for the resource)
- [ ] `curl /clinical-data/conditions` returns an envelope with
      `capabilities.writeRules` populated for the new EHR
- [ ] FE Add/Edit form renders only the fields the rules permit; controller
      rejects state values outside `allowedStates` with a clear 400
- [ ] Smoke test against the vendor's sandbox: create + update round-trip
- [ ] No new `if (ehrName === ...)` or `if (request.category === ...)` checks
      anywhere except the provider class
- [ ] CernerProvider (or peer) tests still pass

## Common Pitfalls

| Pitfall | Fix |
|---------|-----|
| Forgetting `If-Match: W/"<versionId>"` on PUT for vendors that require it | Set `update.requiresIfMatch: true` and let the base provider's `updateResource` send the header (it reads `existing.meta.versionId`) |
| Hardcoding `userSelected: true` on a single coding — gets dropped by Cerner if multiple `userSelected: true` codings present | Always mark mappings (cross-walk derived) as `userSelected: false`; only the user-picked concept is `true` |
| Using UTC date (`new Date().toISOString().slice(0,10)`) for `today` in PST evening | Build YYYY-MM-DD from local components — already provided as `todayIsoDate()` helper in builders |
| Caching FHIR resources on the CDS side | Don't — Bridge owns the FHIR HTTP cache. CDS uses `Cache-Control: max-age=N` headers on read calls |
| Adding `if (request.category === 'encounter-diagnosis')` to the body builder | Use `forbiddenFields.has('abatementDate')` from rules — that's why the rules exist |
| FE form branches on EHR name (`if (ehrName === 'cerner')`) | All FE branching reads `capabilities.writeRules` (or `capabilities.extras` for non-rule data) |

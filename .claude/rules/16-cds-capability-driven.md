# CDS Capability-Driven Rules

> Applies to anything in `apps/cds-app` that varies by EHR (write payloads,
> validation, UI gating). The provider class is the **only** place EHR-specific
> rules are declared; everything else consumes them as data.

## The Core Principle

The CDS app supports many EHRs (Cerner, Epic, Athena, …) that disagree on what
they accept on POST/PUT — allowed states, immutable fields, vendor quirks. The
codebase MUST keep that knowledge in **one** place per EHR: the provider class.
Controllers, body builders, response envelopes, and the FE form all derive
their behavior from that single declaration.

> "If a controller, builder, or form has an `if (ehrName === '...')` or a
> hardcoded `if (category === 'encounter-diagnosis')` check, that's a bug."

## Where Rules Live

| Concern | File |
|---------|------|
| Type contract for the rules | `apps/cds-app/src/modules/providers/capabilities/capability.types.ts` |
| Per-EHR rule declaration | `apps/cds-app/src/modules/providers/{vendor}/{vendor}.provider.ts` (override `getCapabilities(mode)`) |
| Default rules ("everything off") | `apps/cds-app/src/modules/providers/base/cds-resource-provider-base.ts` |
| Envelope projection | `apps/cds-app/src/modules/providers/capabilities/ehr-capabilities.ts` (`getResourceCapabilities`) |

Front-end mirrors:

| Concern | File |
|---------|------|
| Type contract mirror | `apps/cds-ui/src/lib/capabilities.types.ts` |
| Form consuming rules | `apps/cds-ui/src/components/{Resource}Form.tsx` |

## The Provider Is the Source of Truth

Every `CdsResourceProvider` subclass overrides `getCapabilities(mode)` and
returns a `ProviderCapabilities` object. That object MUST declare:

- Per-operation `OperationSupport` (what reads/writes the EHR + UI both implement)
- Allowed write categories (Condition / Observation)
- Per-resource write rules (`condition: ConditionWriteRules`, future:
  `observation`, `allergy`)
- Encounter model + write semantics (binding, closing)

Adding behavior that varies by EHR = extend the rule type + populate it in each
provider. Do NOT branch on `ehrName` anywhere downstream.

## How Rules Flow

```
CernerProvider.getCapabilities(mode)
        │
        ▼
ProviderCapabilities  ─────────────────────────────────┐
        │                                              │
        ├─► Controller (validate request against rules)│
        │                                              │
        ├─► Body Builder (consume forbiddenFields,    ─┤
        │   immutableFields, notesAccepted, …)         │
        │                                              │
        └─► EnvelopeBuilderService.wrap()              │
                │                                      │
                ▼                                      │
         ResourceCapabilities.writeRules ──────────────┘
                │
                ▼
         FE consumes capabilities.writeRules
         (no hardcoded branches in the form)
```

## Rules — Required Properties

Every per-resource rule type MUST express:

1. **`create.allowedStates` / `create.perCategory`** — what states (or
   variants) the EHR accepts on POST. The controller validates request inputs
   against this list; the FE filters the picker by it.
2. **`create.notesAccepted`** — boolean. Controls whether the body builder
   emits `note[]` on POST and whether the FE renders the new-note textarea.
3. **`update.immutableFields`** — fields the EHR rejects changes to on PUT
   (e.g. Cerner: `note`, `code`, `category`). Body builder preserves them
   from `existing`; the FE renders them read-only.
4. **`update.requiresIfMatch`** — when true, the provider's `updateResource`
   MUST send `If-Match: W/"<versionId>"`.
5. **Per-category overrides** (`perCategory`) — vendor-specific tightening
   (Cerner: encounter-diagnosis must be active and forbids abatement).

## Anti-Patterns

| Anti-pattern | Correct Approach |
|-------------|-----------------|
| `if (request.category === 'encounter-diagnosis') { ... }` in controller/builder | `forbiddenFields.has('abatementDate')` from rules |
| `if (ehrName === 'cerner') { ... }` anywhere | Add a flag/field to `ProviderCapabilities`; consume the flag |
| `if (request.state === 'refuted') throw ...` (hardcoded reject) | `if (!rules.create.allowedStates.includes(request.state)) throw` |
| `disabled={isUpdate}` on a code field | `disabled={immutableFields.has('code')}` |
| `{!isUpdate && <textarea>}` for note editor | `{showNoteEditor && <textarea>}` where `showNoteEditor` derives from rules |
| FE branches on `meta.ehrName` | Read flags off `capabilities.writeRules` / `capabilities.extras` |
| Adding a new EHR = changes in controller/builder/form | Adding a new EHR = ONE new provider class + entry in factory + module |
| Duplicate rule constants in BE and FE without a shared type | Declare wire-contract types in `capability.types.ts`; FE mirror imports/duplicates the literal union with a "must match" comment |

## When Adding a New Rule

1. Extend the rule type in `capability.types.ts` (BE + FE mirror).
2. Add it to every provider's `getCapabilities()` (defaults in
   `CdsResourceProviderBase`, override per vendor as needed).
3. Project it through `getResourceCapabilities()` if the FE needs it.
4. Consume it in the controller/builder/form. Never branch on `ehrName`.
5. Update tests: cerner provider spec must assert the rule shape; controller
   spec must assert request rejection on rule violation.

## Test Coverage Expectations

- Provider `getCapabilities(mode)` shape per launch mode (`provider-ehr`,
  `provider-standalone`, `system`).
- Controller rejects requests that violate `create.allowedStates` /
  `perCategory.allowedStates` with a clear 400.
- Body builder respects `forbiddenFields` and `immutableFields` (e.g. doesn't
  emit `abatementDateTime` on encounter-diagnosis; preserves `existing.note`
  when `note` is in `immutableFields`).
- FE form filters state/category options off `capabilities.writeRules`
  (no hardcoded category-string checks in form code).

## Reference Implementation

Condition writes for Cerner (commit history under
`apps/cds-app/src/modules/clinical-write/condition-body.builder.ts` +
`cerner.provider.ts` + `clinical-write.controller.ts` +
`apps/cds-ui/src/components/ConditionForm.tsx`). Observation, Allergy, and
Encounter writes will follow the same pattern when their forms ship.

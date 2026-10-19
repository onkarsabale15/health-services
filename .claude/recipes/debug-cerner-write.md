# Recipe — Debug a Cerner FHIR Write Failure

The Cerner Condition note saga (May 2026) taught us a tight diagnostic playbook. Use this for ANY failing Cerner write.

## Step 1 — Don't trust the HTTP status

**Cerner returns 200 on PUTs that silently discard fields.** You cannot tell from the status alone whether the change persisted. ALWAYS verify by refetching the resource and inspecting the field you tried to change.

## Step 2 — Add a diagnostic log

Counts-only telemetry around the write — no PHI:

```typescript
logger.info('Xxx update body assembled', {
  resourceId: id,
  existingFieldCount: ...,           // shape from EHR read
  requestProvided: ...,              // what user sent
  mergedFieldCount: ...,              // what we're about to PUT
  rule: getRule(forbidden, immutable),  // editable / immutable / forbidden
  hasPractitionerRef: practitionerRef != null,
});
```

Restart cds-app + bridge-api. Reproduce the failure. Read the log.

## Step 3 — Diagnostic decision tree

| Log shows | Diagnosis |
|---|---|
| `existingFieldCount: 0` | Read path is dropping the field — bug upstream of the builder (bridge mapper or Cerner SDK strip) |
| `requestProvided: false` | FE isn't sending the field — DTO or form bug |
| `rule: 'immutable'` but you expected editable | Cerner provider declares the field immutable (correctly per docs); FE form should hide editor on update |
| `mergedFieldCount: N` correct, but refetch shows N-1 | Cerner silently dropped an entry — usually missing `authorReference`, `time`, or wrong structural shape |

## Step 4 — Common Cerner-specific gotchas

| Gotcha | Symptom | Fix |
|---|---|---|
| `note[]` is fully immutable on PUT | Notes don't update; 200 returned | Per Oracle docs "Does not allow updates" — declare `'note'` in `update.immutableFields`, hide editor on update |
| `If-Match: W/"<versionId>"` missing | 412 Precondition Failed | Plumb `WriteOptions.ifMatch` through; use `@IfMatch()` decorator on controller |
| `category[]` length > 1 | 422 — even when both entries are canonical | `update.maxCategoryItems: 1` rule; sanitize after the universal canonical filter |
| `clinicalStatus` + `entered-in-error` | 400 con-5 invariant violation | Make `mapping.clinical: string \| null`; null on entered-in-error |
| Annotation entry shape mismatch | Entry silently dropped | Mirror existing entries' shape — `authorReference: { reference: 'Practitioner/<fhirId>' }` + `time: <ISO>` |
| `Practitioner/Practitioner/12345` reference | 400 — invalid resource type | Use `toFhirReference(idOrRef, 'Practitioner')`; `providerFhirId` is already prefixed |
| Recurrence silently coerced to active on problem-list-item update | Recurrence doesn't persist | Drop from `update.allowedStates` |

## Step 5 — Verify the doc

Before declaring a Cerner behavior, check the Oracle Health Millennium R4 docs at `docs.oracle.com/.../mfrap/`. The note saga taught us the docs are right; our assumptions were wrong.

## Step 6 — Document the rule

Once you've root-caused, update the Cerner provider's `getCapabilities()` comment block citing the doc and the exact rule. Future-you (or future-AI) will thank you.

## Step 7 — Rollback the band-aid

If you added defensive logic that turned out to mask the real issue (e.g. re-trying with different shapes), remove it once the root cause is fixed. Keep the diagnostic log at `debug` level for permanent observability.

## Acceptance

- Root cause identified via log + refetch chain
- Fix lands at the right layer (provider rule, builder, controller, or session)
- Cerner spec passes
- No band-aid logic left in code

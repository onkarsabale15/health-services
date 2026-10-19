# Recipe — Add a FHIR Resource Write Controller (e.g. Observation, Allergy)

Capability-driven, all per-EHR rules in the provider class.

## Step 1 — Capability fields

`apps/cds-app/src/modules/providers/capabilities/capability.types.ts`:

```typescript
export interface XxxWriteRules {
  create: { allowedStates?: ...; forbiddenFields?: ConditionWriteField[]; ... };
  update: { immutableFields: XxxWriteField[]; requiresIfMatch: boolean; ... };
}

// extend ProviderCapabilities:
xxx?: XxxWriteRules;
```

Mirror `ConditionWriteRules` shape — `create.allowedStates`, `update.immutableFields`, `update.allowedStates`, `forbiddenFields` per category, `maxCategoryItems`, `requiresIfMatch`.

## Step 2 — DTO

`apps/cds-app/src/modules/clinical-write/clinical-write.dto.ts`:

```typescript
export class XxxRequestDto {
  @ApiProperty()
  @ValidateNested()
  @Type(() => XxxConceptInputDto)
  concept!: XxxConceptInputDto;

  // Lean domain fields. NOT FHIR field names.
  // Builder will assemble the FHIR body.
}
```

## Step 3 — Body builder

`apps/cds-app/src/modules/clinical-write/{xxx}-body.builder.ts`:

```typescript
@Injectable()
export class XxxBodyBuilder {
  buildCreate(req: XxxRequestDto, rules: XxxWriteRules): Record<string, unknown> { ... }

  buildUpdate(
    id: string,
    req: XxxRequestDto,
    existing: Record<string, unknown>,
    rules: XxxWriteRules,
    practitionerRef?: string,  // for authorReference on note-like fields
  ): Record<string, unknown> { ... }
}
```

Mirror `condition-body.builder.ts`:
- `merged = { ...existing }` for update (preserves vendor-set fields)
- Apply field-by-field with `forbidden.has(...)` / `immutable.has(...)` checks
- Use `getXxxRule()` helper for control flow + telemetry consistency

## Step 4 — Controller

`apps/cds-app/src/modules/clinical-write/clinical-write.controller.ts`:

```typescript
@Post('xxx')
async createXxx(@CurrentSession() session: CdsSession, @Body() request: XxxRequestDto) {
  const rules = this.requireXxxRules(session);
  // Validate request against rules.create.allowedStates / forbiddenFields
  const body = this.xxxBuilder.buildCreate(request, rules);
  return this.writeService.createResource(session, 'Xxx', this.bindToSessionPatient(session, body));
}

@Put('xxx/:id')
async updateXxx(...) {
  // Fetch existing → buildUpdate(id, request, existing, rules, practitionerRef) → updateResource
  // Use If-Match if rules.update.requiresIfMatch
}
```

## Step 5 — Provider declaration

Each EHR provider's `getCapabilities()` declares the rules:

```typescript
xxx: {
  create: { allowedStates: [...], notesAccepted: true },
  update: { immutableFields: [...], requiresIfMatch: true },
}
```

Defaults: empty / unsupported in `cds-resource-provider-base.ts`.

## Step 6 — FE form

`apps/cds-ui/src/components/XxxForm.tsx` — capability-aware, mirrors `ConditionForm.tsx`:

- `rules = props.capabilities.writeRules` (or per-resource shape)
- `forbiddenFields` derived from rules + category
- `immutableFields = new Set(rules?.update.immutableFields ?? [])`
- `isFieldEditable(f)` = `!forbidden.has(f) && !immutable.has(f)`
- Each form field renders read-only when `isUpdate && immutable.has(...)`

## Step 7 — Tests

- Provider spec: `getCapabilities()` shape per launch mode
- Controller spec: rejects requests violating `allowedStates` / forbiddenFields with clear 400
- Body builder spec: respects forbidden + immutable on real fixtures
- FE form: filter state/category options off `capabilities.writeRules` (no hardcoded EHR string checks)

## Acceptance

- Each provider declares the write rules
- Request validation rejects vendor-disallowed inputs with clear messages
- Form gates input fields per capability
- Cerner-specific quirks (If-Match, immutable note, etc.) work end-to-end

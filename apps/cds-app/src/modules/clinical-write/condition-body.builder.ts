import { Injectable } from '@nestjs/common';
import { logger } from '@hs/observability';
import {
  buildCategoryCoding,
  buildSeverityCoding,
  CONDITION_CATEGORY_CODES,
  STATUS_SYSTEMS,
} from './constants/fhir-codings';
import { getConditionStateMapping, type ConditionStateFhirMapping } from './constants/condition-state.model';
import type { ConditionConceptInputDto, ConditionRequestDto } from './clinical-write.dto';
import type {
  ConditionCategory,
  ConditionWriteField,
  ConditionWriteRules,
} from '../providers/capabilities/capability.types';

// ─── Condition Body Builder ─────────────────────────────────────────────────
//
// Assembles a FHIR Condition resource body from the lean `ConditionRequestDto`
// the frontend sends. The ONLY place in the CDS backend where Condition
// FHIR field names and HL7 code values are written.
//
// Per-EHR rules (forbidden fields by category, note immutability on update,
// notes-accepted on create) are NOT hardcoded here — they flow in via
// `ConditionWriteRules` resolved from the active `CernerProvider`/equivalent.
// Adding a new EHR is a provider-side declaration; this file does not change.

@Injectable()
export class ConditionBodyBuilder {
  /** Build the FHIR body for a POST /Condition request. */
  buildCreate(request: ConditionRequestDto, rules: ConditionWriteRules): Record<string, unknown> {
    const mapping = getConditionStateMapping(request.state);
    const forbidden = forbiddenFieldsForCreate(rules, request.category);

    // `code.text` intentionally omitted — `coding[]` carries the system+code
    // (the only fields that matter clinically), and the EHR derives display
    // text from its own terminology server. Sending our display can produce
    // mismatches when the EHR validates against its master concept list.
    const body: Record<string, unknown> = {
      resourceType: 'Condition',
      verificationStatus: buildStatusCoding(STATUS_SYSTEMS.CONDITION_VERIFICATION, mapping.verification),
      category: [buildCategoryCoding(request.category)],
      code: { coding: buildCodeCodings(request.concept) },
    };
    applyClinicalStatus(body, mapping);

    if (!forbidden.has('severity')) {
      const severity = buildSeverityCoding(request.severity);
      if (severity) body.severity = severity;
    }
    // `onsetDateTime` is intentionally never set from CDS — every supported
    // EHR auto-generates it on POST. Sending one risks vendor-side coercion
    // and adds zero clinical value over what the EHR records itself.
    if (!forbidden.has('abatementDate')) {
      if (request.abatementDate) {
        body.abatementDateTime = toFullIsoDateTime(request.abatementDate);
      } else if (mapping.isAbatement) {
        body.abatementDateTime = toFullIsoDateTime(todayIsoDate());
      }
    }
    if (rules.create.notesAccepted && !forbidden.has('note')) {
      const trimmed = request.note?.trim();
      if (trimmed) body.note = [{ text: trimmed }];
    }

    return body;
  }

  /**
   * Build the FHIR body for a PUT /Condition/:id by merging the request's
   * new clinical fields onto the existing resource (passed in by the
   * controller after fetching it). PUT is full-replacement at the EHR —
   * anything not in this body would be wiped — so the spread of `existing`
   * preserves audit fields (recorder, asserter, recordedDate), structural
   * fields (bodySite, evidence, stage), extensions, meta, and notes.
   *
   * `rules.update.immutableFields` declares fields the EHR rejects on PUT
   * (Cerner: code, category, note). The builder preserves those from
   * `existing` and silently ignores any new value the request carries.
   * `rules.update.perCategory[category].forbiddenFields` strips fields
   * disallowed for the resource's existing category (e.g. abatement on
   * encounter-diagnosis).
   */
  buildUpdate(
    id: string,
    request: ConditionRequestDto,
    existing: Record<string, unknown>,
    rules: ConditionWriteRules,
    /**
     * Practitioner FHIR reference for the launching user (e.g. `Practitioner/12345`).
     * Used to stamp `authorReference` on newly-appended notes when the EHR's
     * PUT validator requires uniformly-shaped Annotation entries (Cerner does;
     * POST is more lenient, which is why create-with-note works without it).
     */
    practitionerRef?: string,
  ): Record<string, unknown> {
    const mapping = getConditionStateMapping(request.state);
    const merged: Record<string, unknown> = { ...existing };

    merged.id = id;
    merged.resourceType = 'Condition';
    merged.verificationStatus = buildStatusCoding(STATUS_SYSTEMS.CONDITION_VERIFICATION, mapping.verification);
    applyClinicalStatus(merged, mapping);

    const categoryCode = readExistingCategory(existing);
    const forbidden = forbiddenFieldsForUpdate(rules, categoryCode);
    const immutable = new Set(rules.update.immutableFields);

    if (!immutable.has('severity')) applySeverity(merged, request.severity);
    // `onsetDateTime` is preserved from `existing` via the spread above —
    // CDS never modifies it (every supported EHR owns it).
    applyAbatement(merged, request.abatementDate, mapping, forbidden, immutable);
    applyNote(merged, existing, request.note, forbidden, immutable, practitionerRef);
    sanitizeCategory(merged, rules.update.maxCategoryItems);

    // Counts-only diagnostic — no PHI (text is never logged, only sizes).
    logger.debug('Condition update body assembled', {
      conditionId: id,
      existingNoteCount: Array.isArray(existing.note) ? existing.note.length : 0,
      requestNoteProvided: typeof request.note === 'string' && request.note.trim().length > 0,
      mergedNoteCount: Array.isArray(merged.note) ? (merged.note as unknown[]).length : 0,
      noteRule: getNoteRule(forbidden, immutable),
      hasPractitionerRef: practitionerRef != null,
      categoryCode,
    });

    return merged;
  }
}

/**
 * Single source of truth for note-handling branch selection on PUT — used
 * by `applyNote` (control flow) and the diagnostic log (telemetry). Order
 * matches `applyNote`: forbidden wins over immutable when both are set,
 * since forbidden strips the field entirely while immutable just freezes it.
 */
function getNoteRule(
  forbidden: Set<ConditionWriteField>,
  immutable: Set<ConditionWriteField>,
): 'forbidden' | 'immutable' | 'editable' {
  if (forbidden.has('note')) return 'forbidden';
  if (immutable.has('note')) return 'immutable';
  return 'editable';
}

/**
 * Two-step category cleanup on PUT:
 *
 * 1. Universal: drop entries that aren't canonical FHIR `condition-category`
 *    (problem-list-item / encounter-diagnosis). EHRs stack vendor-specific
 *    qualifier codings into `category[]` on GET (Cerner adds a SNOMED
 *    qualifier "Medical (qualifier value)"); those have no clinical-write
 *    meaning to CDS and some EHRs reject them on PUT.
 * 2. Per-EHR cap: when `maxCategoryItems` is set, slice the surviving
 *    array. Cerner rejects > 1 even when both are canonical.
 */
const CANONICAL_CATEGORY_CODES: ReadonlySet<string> = new Set(Object.keys(CONDITION_CATEGORY_CODES));

function sanitizeCategory(merged: Record<string, unknown>, maxItems: number | undefined): void {
  if (!Array.isArray(merged.category)) return;
  type CategoryEntry = { coding?: Array<{ system?: string; code?: string }> };
  let filtered = (merged.category as CategoryEntry[]).filter((entry) =>
    entry.coding?.some(
      (c) => c.system === STATUS_SYSTEMS.CONDITION_CATEGORY && c.code && CANONICAL_CATEGORY_CODES.has(c.code),
    ),
  );
  if (maxItems != null && filtered.length > maxItems) {
    filtered = filtered.slice(0, maxItems);
  }
  merged.category = filtered;
}

/**
 * FHIR R4 con-5: clinicalStatus SHALL NOT be present when verificationStatus is
 * entered-in-error. Both create and update funnel through here so the rule lives
 * in one place. On update we delete from the spread of `existing` because the
 * EHR's GET will have included clinicalStatus on a previously-active resource.
 */
function applyClinicalStatus(body: Record<string, unknown>, mapping: ConditionStateFhirMapping): void {
  if (mapping.clinical === null) {
    delete body.clinicalStatus;
    return;
  }
  body.clinicalStatus = buildStatusCoding(STATUS_SYSTEMS.CONDITION_CLINICAL, mapping.clinical);
}

/**
 * Read the canonical FHIR `condition-category` code from an existing Condition,
 * narrowed to our enum. Non-canonical codings (Cerner's SNOMED qualifier etc.)
 * return `undefined` — sanitizeCategory strips those before write anyway.
 * Shared with the controller's pre-write state validation.
 */
export function readExistingCategory(resource: Record<string, unknown>): ConditionCategory | undefined {
  const cat = resource.category as Array<{ coding?: Array<{ code?: string }> }> | undefined;
  const code = cat?.[0]?.coding?.[0]?.code;
  if (code === 'problem-list-item' || code === 'encounter-diagnosis' || code === 'health-concern') {
    return code;
  }
  return undefined;
}

function forbiddenFieldsForCreate(
  rules: ConditionWriteRules,
  category: ConditionCategory | undefined,
): Set<ConditionWriteField> {
  const merged = new Set<ConditionWriteField>(rules.create.forbiddenFields ?? []);
  if (category) {
    for (const f of rules.create.perCategory?.[category]?.forbiddenFields ?? []) merged.add(f);
  }
  return merged;
}

function forbiddenFieldsForUpdate(
  rules: ConditionWriteRules,
  category: ConditionCategory | undefined,
): Set<ConditionWriteField> {
  const merged = new Set<ConditionWriteField>(rules.update.forbiddenFields ?? []);
  if (category) {
    for (const f of rules.update.perCategory?.[category]?.forbiddenFields ?? []) merged.add(f);
  }
  return merged;
}

// ─── Field-level merge helpers ─────────────────────────────────────────────

function applySeverity(merged: Record<string, unknown>, severity: ConditionRequestDto['severity']): void {
  if (!severity) return;
  const coding = buildSeverityCoding(severity);
  if (coding) merged.severity = coding;
}

function applyAbatement(
  merged: Record<string, unknown>,
  abatementDate: string | undefined,
  mapping: ConditionStateFhirMapping,
  forbidden: Set<ConditionWriteField>,
  immutable: Set<ConditionWriteField>,
): void {
  if (forbidden.has('abatementDate')) {
    clearAllAbatement(merged);
    return;
  }
  if (immutable.has('abatementDate')) return;
  if (abatementDate) {
    merged.abatementDateTime = toFullIsoDateTime(abatementDate);
    clearAbatementSiblings(merged);
    return;
  }
  if (mapping.isAbatement) {
    const hasExisting =
      merged.abatementDateTime !== undefined ||
      merged.abatementPeriod !== undefined ||
      merged.abatementAge !== undefined ||
      merged.abatementRange !== undefined ||
      merged.abatementString !== undefined;
    if (!hasExisting) {
      merged.abatementDateTime = toFullIsoDateTime(todayIsoDate());
    }
    return;
  }
  clearAllAbatement(merged);
}

/** Drop every Condition.abatement[x] variant except `abatementDateTime`. */
function clearAbatementSiblings(merged: Record<string, unknown>): void {
  delete merged.abatementPeriod;
  delete merged.abatementAge;
  delete merged.abatementRange;
  delete merged.abatementString;
}

/** Drop every Condition.abatement[x] variant. */
function clearAllAbatement(merged: Record<string, unknown>): void {
  delete merged.abatementDateTime;
  clearAbatementSiblings(merged);
}

/**
 * Apply Condition.note on PUT. FHIR R4 models `note` as an Annotation
 * timeline; whether the EHR accepts modifications on update is per-vendor.
 * Three rule cases (resolved by `getNoteRule`):
 *   - forbidden: the EHR/category disallows note entirely → strip from PUT.
 *   - immutable (Cerner today, per Oracle Health docs — "note Does not
 *     allow updates"): keep existing entries verbatim, drop the user's
 *     input. The form already hides the editor in this case, so the
 *     request shouldn't carry a note — defensive.
 *   - editable: append the new note onto the existing array. Stamps
 *     `authorReference` (when the session carries the launching user's
 *     FHIR ref) and `time`, matching the shape of the existing entries
 *     so vendors with strict Annotation validation accept the new entry.
 *     Not reachable on Cerner today; ready for any future provider that
 *     declares note editable on update (e.g. Epic, Athena once their
 *     write rules are declared).
 */
function applyNote(
  merged: Record<string, unknown>,
  existing: Record<string, unknown>,
  noteText: string | undefined,
  forbidden: Set<ConditionWriteField>,
  immutable: Set<ConditionWriteField>,
  practitionerRef?: string,
): void {
  const existingNotes = Array.isArray(existing.note) ? (existing.note as Array<Record<string, unknown>>) : [];
  const rule = getNoteRule(forbidden, immutable);

  if (rule === 'forbidden') {
    delete merged.note;
    return;
  }
  if (rule === 'immutable') {
    if (existingNotes.length > 0) merged.note = existingNotes;
    else delete merged.note;
    return;
  }

  const trimmed = noteText?.trim();
  if (trimmed) {
    // Build a uniformly-shaped Annotation entry. Cerner's PUT validator silently
    // drops entries that don't match the existing array's shape — `authorReference`
    // and `time` are required when the existing entries carry them. We stamp both
    // ourselves rather than letting the EHR fill them in (Cerner returns 200 but
    // discards the entry when these are absent, despite POST accepting a bare
    // `{ text }`).
    const newNote: Record<string, unknown> = { text: trimmed };
    if (practitionerRef) newNote.authorReference = { reference: practitionerRef };
    newNote.time = new Date().toISOString();
    merged.note = [...existingNotes, newNote];
    return;
  }
  if (existingNotes.length > 0) merged.note = existingNotes;
  else delete merged.note;
}

// ─── Pure helpers (file-local) ──────────────────────────────────────────────

function buildStatusCoding(system: string, code: string) {
  return { coding: [{ system, code }] };
}

/**
 * Cerner persists at most one `userSelected: true` and one `userSelected: false`
 * coding (extras are dropped). Mark the primary concept (the one the user
 * actually picked in the terminology field) as userSelected; mappings (auto-
 * derived from the cross-walk) are not user-selected.
 */
function buildCodeCodings(
  concept: ConditionConceptInputDto,
): Array<{ system: string; code: string; display?: string; userSelected: boolean }> {
  return [
    { system: concept.systemUri, code: concept.code, display: concept.display ?? undefined, userSelected: true },
    ...(concept.mappings ?? []).map((m) => ({
      system: m.systemUri,
      code: m.code,
      display: m.display ?? undefined,
      userSelected: false,
    })),
  ];
}

/** Coerce date-only (YYYY-MM-DD) to ISO-8601 at UTC midnight; leave full ISO untouched. */
function toFullIsoDateTime(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00.000Z` : value;
}

/**
 * Local-date today (YYYY-MM-DD). `new Date().toISOString().slice(0,10)`
 * returns UTC, which produces an off-by-one in evening-PST traffic where
 * UTC has already rolled into tomorrow.
 */
function todayIsoDate(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

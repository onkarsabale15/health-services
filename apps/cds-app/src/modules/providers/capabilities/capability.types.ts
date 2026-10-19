/**
 * Capability types — CDS-internal.
 *
 * These types describe what a given EHR + launch mode supports, so the CDS UI
 * can render only the actions a user can actually perform. They are NOT an
 * enforcement boundary — bridge still rejects unsupported operations at the
 * EHR layer. They exist purely for UX (no broken buttons, no failing forms).
 */

export type ClinicalOperation =
  | 'condition.read'
  | 'condition.write'
  | 'allergy.read'
  | 'allergy.write'
  | 'observation.read'
  | 'observation.write'
  | 'appointment.read'
  | 'appointment.write'
  | 'encounter.read'
  | 'encounter.close'
  | 'medication.read'
  | 'patient.read'
  | 'patient.search'
  | 'careplan.generate';

export type LaunchMode = 'system' | 'provider-ehr' | 'provider-standalone';

export type ResourceType =
  | 'Condition'
  | 'AllergyIntolerance'
  | 'MedicationStatement'
  | 'Observation'
  | 'Appointment'
  | 'Encounter'
  | 'Patient';

export type ConditionCategory = 'problem-list-item' | 'encounter-diagnosis' | 'health-concern';

/**
 * Plain-English condition states the FE sends on every create/update. The
 * BE owns the FHIR mapping (`clinicalStatus` × `verificationStatus`); this
 * union is the wire contract — the SOLE place it's declared. Both
 * `condition-state.model.ts` (BE mapping) and the FE's `condition-states.ts`
 * import this union so all three layers stay in sync from one literal.
 */
export type ConditionStateValue =
  | 'active-confirmed'
  | 'active-provisional'
  | 'recurrence'
  | 'remission'
  | 'resolved'
  | 'inactive'
  | 'refuted'
  | 'entered-in-error';

/**
 * Logical fields the Condition body builder writes. Used by `ConditionWriteRules`
 * to declare per-EHR forbids and immutables — names match the lean
 * `ConditionRequestDto` shape (NOT FHIR field names) so providers reason about
 * domain inputs, not vendor wire shapes.
 *
 * `onsetDate` is intentionally NOT part of this union — every supported EHR
 * auto-generates `onsetDateTime` and CDS never sends it. Adding back support
 * for explicit onset would require restoring the DTO field, the form input,
 * and the builder's `applyOnset` helper.
 */
export type ConditionWriteField = 'code' | 'category' | 'note' | 'severity' | 'abatementDate';

export interface ConditionWriteRules {
  create: {
    /** Wire-contract states allowed on POST. Excludes states that are reachable only via update. */
    allowedStates: ConditionStateValue[];
    /** Fields the EHR forbids on POST regardless of category (e.g. Cerner auto-generates `onsetDateTime`). */
    forbiddenFields?: ConditionWriteField[];
    /** Tighter rules on a per-category basis. Falls back to `create.allowedStates` when absent. */
    perCategory?: Partial<
      Record<ConditionCategory, { allowedStates?: ConditionStateValue[]; forbiddenFields?: ConditionWriteField[] }>
    >;
    /** True when the EHR accepts `note[]` on POST. False = strip from create body. */
    notesAccepted: boolean;
  };
  update: {
    /** Fields that can NEVER be modified on PUT — preserved verbatim from the existing resource. */
    immutableFields: ConditionWriteField[];
    /** True when the EHR requires `If-Match: W/"<versionId>"` for optimistic concurrency. */
    requiresIfMatch: boolean;
    /** Fields the EHR forbids on PUT regardless of category. */
    forbiddenFields?: ConditionWriteField[];
    /**
     * States the EHR accepts on PUT. EHRs with looser create-time constraints
     * may tighten on update (e.g. Cerner silently coerces `recurrence` → active,
     * so we declare it unsupported instead of letting the user save a value the
     * EHR won't actually persist). Falls back to `create.allowedStates` when
     * absent. The form filters its picker by this; the controller rejects with
     * a clear 400 when a request violates it.
     */
    allowedStates?: ConditionStateValue[];
    /**
     * Per-category overrides that apply specifically to update — both field
     * forbids (e.g. abatement on encounter-diagnosis) and stricter state lists
     * (Cerner only allows active states on encounter-diagnosis update).
     */
    perCategory?: Partial<
      Record<ConditionCategory, { forbiddenFields?: ConditionWriteField[]; allowedStates?: ConditionStateValue[] }>
    >;
    /**
     * Cap on `category[]` length on PUT. Applied AFTER the universal sanitization
     * step that strips non-canonical entries. Use only when the EHR's PUT validator
     * is stricter than its GET emitter — Cerner accepts only 1 even when canonical.
     * Undefined = no cap (keep whatever survives sanitization).
     */
    maxCategoryItems?: number;
  };
}

export type ObservationCategory =
  | 'vital-signs'
  | 'laboratory'
  | 'social-history'
  | 'survey'
  | 'exam'
  | 'therapy'
  | 'activity';

/**
 * EHR's encounter model.
 * - `native`     — has a first-class FHIR Encounter resource (Cerner, Epic, Athena, NextGen, eCW, Meditech, Greenways)
 * - `appointment-derived` — synthesizes encounters from appointments (no separate Encounter resource)
 * - `none`       — no encounter concept at all (DrChrono, Elation)
 *
 * UI: when `none`, hide the encounter selector entirely; jump appointment → patient view.
 */
export type EncounterModel = 'native' | 'appointment-derived' | 'none';

export interface OperationSupport {
  supported: boolean;
  /** Tooltip text when unsupported. */
  reason?: string;
  /** Condition write model: 'problem-list', 'encounter-diagnosis', 'both'. */
  model?: string;
  /** True when the write auto-binds to the active encounter. */
  encounterBound?: boolean;
}

export type ModeMatrix = Partial<Record<LaunchMode, OperationSupport>>;
export type CapabilityMatrix = Record<ClinicalOperation, ModeMatrix>;

export interface ResourceProfile {
  condition: {
    /** Allowed write categories for this EHR. Empty array = no condition writes supported. */
    categories: ConditionCategory[];
  };
  appointment: {
    allowCreate: boolean;
    /** True if picking an appointment in standalone mode can derive an encounter context. */
    allowDeriveEncounter: boolean;
    defaultDurationMinutes?: number;
  };
  allergy: {
    requiresVerificationStatus: boolean;
  };
  observation: {
    supportedCategories: ObservationCategory[];
  };
  encounter: {
    allowClose: boolean;
  };
}

/**
 * Full capability profile for an EHR. Single source of truth for CDS UI gating.
 */
export interface EhrProfile {
  ehrName: string;
  encounterModel: EncounterModel;
  operations: CapabilityMatrix;
  resources: ResourceProfile;
}

/**
 * Capability declaration that each `CdsResourceProvider` returns from
 * `getCapabilities(mode)`. The provider IS the source of truth — no static
 * matrix to drift against. `BaseFhirProvider` returns "everything
 * unsupported" by default; subclasses (e.g., `CernerProvider`) override to
 * declare what they actually implement.
 */
export interface ProviderCapabilities {
  ehrName: string;
  encounterModel: EncounterModel;
  /** Per-operation support for the requested mode. Operations not implemented stay `{ supported: false, reason }`. */
  operations: Record<ClinicalOperation, OperationSupport>;
  /** Allowed write categories for Condition. Empty = condition writes not supported in this mode. */
  conditionCategories: ConditionCategory[];
  /** Observation categories the EHR exposes (vital-signs, laboratory, …). Empty = none. */
  observationCategories: ObservationCategory[];
  appointment: {
    allowCreate: boolean;
    allowDeriveEncounter: boolean;
    defaultDurationMinutes?: number;
  };
  allergy: {
    requiresVerificationStatus: boolean;
  };
  encounter: {
    allowClose: boolean;
  };
  /** Per-EHR Condition write rules. Absent = the EHR doesn't define rules (defaults applied). */
  condition?: ConditionWriteRules;
}

/**
 * The shape returned in API response envelopes. Drives UI rendering decisions.
 */
export interface ResourceCapabilities {
  allowAdd: boolean;
  allowEdit: boolean;
  allowDelete: boolean;
  reasons?: { add?: string; edit?: string; delete?: string };
  /** Write category options. Single-element → form skips picker. Null → N/A. */
  categories?: ConditionCategory[] | null;
  isEncounterSupported: boolean;
  /** Write must auto-bind to active encounter. */
  encounterBound?: boolean;
  /** Resource-specific write rules. For Condition this is `ConditionWriteRules`. */
  writeRules?: ConditionWriteRules;
  extras?: Record<string, unknown>;
}

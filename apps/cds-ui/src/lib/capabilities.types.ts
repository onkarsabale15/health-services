/**
 * FE mirror of the cds-app capability shapes. Per-resource flags arrive on
 * each list/detail response envelope (`{ data, capabilities, meta }`) and
 * are read via `useResource()`. Cross-resource operations (today only
 * `careplan.generate`) live on the session bootstrap.
 *
 * Keep this file in sync with `apps/cds-app/src/modules/providers/capabilities/capability.types.ts`.
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
export type EncounterModel = 'native' | 'appointment-derived' | 'none';

/** Wire-contract for condition state — must match BE union exactly. */
export type ConditionStateValue =
  | 'active-confirmed'
  | 'active-provisional'
  | 'recurrence'
  | 'remission'
  | 'resolved'
  | 'inactive'
  | 'refuted'
  | 'entered-in-error';

export type ConditionWriteField = 'code' | 'category' | 'note' | 'severity' | 'abatementDate';

export interface ConditionWriteRules {
  create: {
    allowedStates: ConditionStateValue[];
    forbiddenFields?: ConditionWriteField[];
    perCategory?: Partial<
      Record<ConditionCategory, { allowedStates?: ConditionStateValue[]; forbiddenFields?: ConditionWriteField[] }>
    >;
    notesAccepted: boolean;
  };
  update: {
    immutableFields: ConditionWriteField[];
    requiresIfMatch: boolean;
    forbiddenFields?: ConditionWriteField[];
    /** Stricter state list for update; falls back to `create.allowedStates` when absent. */
    allowedStates?: ConditionStateValue[];
    perCategory?: Partial<
      Record<ConditionCategory, { forbiddenFields?: ConditionWriteField[]; allowedStates?: ConditionStateValue[] }>
    >;
  };
}

export interface OperationSupport {
  supported: boolean;
  reason?: string;
  model?: string;
  encounterBound?: boolean;
}

export interface ResourceCapabilities {
  allowAdd: boolean;
  allowEdit: boolean;
  allowDelete: boolean;
  reasons?: { add?: string; edit?: string; delete?: string };
  categories?: ConditionCategory[] | null;
  isEncounterSupported: boolean;
  encounterBound?: boolean;
  /** Resource-specific write rules. For Condition this is `ConditionWriteRules`. */
  writeRules?: ConditionWriteRules;
  extras?: Record<string, unknown>;
}

/**
 * Standard envelope shape returned by every cds-app list/detail endpoint.
 * Components consume `data`; gates consume `capabilities`. `meta.ehrName`
 * is for diagnostics only — the UI must NEVER branch on it.
 */
export interface ResponseEnvelope<T> {
  data: T;
  capabilities: ResourceCapabilities;
  meta: {
    ehrName: string;
    launchMode: LaunchMode;
    patientId?: string;
    encounterId?: string;
    resource: ResourceType;
  };
}

/**
 * The patient endpoint is the orchestrator: its meta carries the linkage
 * IDs the patient page uses to fan out to the encounter / appointment
 * detail endpoints, plus the encounter-model flags that drive the
 * EncounterPicker.
 */
export interface PatientResponseEnvelope<T> {
  data: T;
  capabilities: ResourceCapabilities;
  meta: {
    ehrName: string;
    launchMode: LaunchMode;
    patientId?: string;
    encounterId?: string;
    appointmentId?: string;
    encounterModel: EncounterModel;
    isEncounterSupported: boolean;
    resource: ResourceType;
  };
}

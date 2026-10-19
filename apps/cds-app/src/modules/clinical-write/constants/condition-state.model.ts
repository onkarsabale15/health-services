// ─── Condition State Model (backend) ────────────────────────────────────────
//
// FHIR mapping for the wire-contract `ConditionStateValue` enum (declared in
// `providers/capabilities/capability.types.ts` so the type is shared with the
// rule definitions). This file owns ONLY the (clinical, verification) pair
// mapping — generation belongs on the backend.

import type { ConditionStateValue } from '../../providers/capabilities/capability.types';
export type { ConditionStateValue };

/** Allowed wire-contract values — used by class-validator. */
export const CONDITION_STATE_VALUES: readonly ConditionStateValue[] = [
  'active-confirmed',
  'active-provisional',
  'recurrence',
  'remission',
  'resolved',
  'inactive',
  'refuted',
  'entered-in-error',
] as const;

/**
 * State → FHIR (clinicalStatus, verificationStatus) pair. The ONLY place
 * in the codebase that knows how a plain-English state maps to HL7 code
 * values. Destructive states are flagged so the builder can apply extra
 * guardrails (e.g. require a note, force abatement handling).
 */
export interface ConditionStateFhirMapping {
  /**
   * `null` when FHIR R4 invariant `con-5` requires clinicalStatus to be
   * absent — currently only when verification is `entered-in-error`.
   * Builders MUST omit Condition.clinicalStatus from the body in that case.
   */
  clinical: string | null;
  verification: string;
  /**
   * True → state implies the condition is no longer active. Builders
   * use this to auto-set `abatementDateTime` and gate the corresponding
   * field on the update form.
   */
  isAbatement: boolean;
  /**
   * True → state needs an audit-friendly note. The builder won't refuse
   * to serialize without one, but the controller could enforce it.
   */
  destructive?: boolean;
}

export const CONDITION_STATE_FHIR: Record<ConditionStateValue, ConditionStateFhirMapping> = {
  'active-confirmed': {
    clinical: 'active',
    verification: 'confirmed',
    isAbatement: false,
  },
  'active-provisional': {
    clinical: 'active',
    verification: 'provisional',
    isAbatement: false,
  },
  recurrence: {
    clinical: 'recurrence',
    verification: 'confirmed',
    isAbatement: false,
  },
  remission: {
    clinical: 'remission',
    verification: 'confirmed',
    // FHIR's `abatementDateTime` means "the condition is no longer present" —
    // a stronger claim than remission ("symptom-free but condition persists").
    // Cerner enforces this strictly: abatement-set + clinical='remission' → 422
    // ("if abated, clinicalStatus must be 'resolved'"). Don't auto-set abatement.
    isAbatement: false,
  },
  resolved: {
    clinical: 'resolved',
    verification: 'confirmed',
    isAbatement: true,
  },
  inactive: {
    clinical: 'inactive',
    verification: 'confirmed',
    isAbatement: false,
  },
  refuted: {
    // Clinically distinct from entered-in-error: refuted means "considered
    // and ruled out" (the rule-out itself is a clinical decision).
    // entered-in-error means "shouldn't have been recorded at all".
    clinical: 'inactive',
    verification: 'refuted',
    isAbatement: false,
  },
  'entered-in-error': {
    // FHIR R4 con-5: clinicalStatus SHALL NOT be present when verificationStatus
    // is entered-in-error. Body builders MUST omit clinicalStatus from the body
    // (and strip it from the existing resource on PUT) when this is null.
    clinical: null,
    verification: 'entered-in-error',
    isAbatement: false,
    destructive: true,
  },
};

/** Convenience lookup with a clear error when the enum is out of sync. */
export function getConditionStateMapping(value: ConditionStateValue): ConditionStateFhirMapping {
  const mapping = CONDITION_STATE_FHIR[value];
  if (!mapping) {
    throw new Error(`Unknown condition state: ${value}`);
  }
  return mapping;
}

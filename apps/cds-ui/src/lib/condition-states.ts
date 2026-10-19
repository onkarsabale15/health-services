import { Ban, Check, CircleDot, RotateCcw, XOctagon, type LucideIcon } from 'lucide-react';
import type { ConditionSummary } from '@/types';
import type { ConditionStateValue } from '@/lib/capabilities.types';

// ─── Condition State (UI model) ──────────────────────────────────────────────
//
// Plain-English condition states shown in the ConditionForm state picker.
// `ConditionStateValue` is the wire contract — declared in
// `capabilities.types.ts` so BE/FE share one literal union. The FE owns the
// presentation (label, color, icon) plus the small HL7 codes used to derive
// the picker's selected option from a stored `ConditionSummary`.

export type { ConditionStateValue };

export interface ConditionStateOption {
  value: ConditionStateValue;
  label: string;
  description: string;
  /** Tailwind class triple for active-selection styling */
  color: string;
  icon: LucideIcon;
  /** True → needs a confirmation step before save */
  destructive?: boolean;
  /** Used ONLY by `deriveStateFromSummary` — never sent to backend */
  clinical: string;
  verification: string;
}

export const CONDITION_STATE_OPTIONS: readonly ConditionStateOption[] = [
  {
    value: 'active-confirmed',
    label: 'Active — Confirmed',
    description: 'Ongoing condition, diagnosis confirmed.',
    clinical: 'active',
    verification: 'confirmed',
    color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    icon: CircleDot,
  },
  {
    value: 'active-provisional',
    label: 'Active — Provisional',
    description: 'Working diagnosis, awaiting confirmation.',
    clinical: 'active',
    verification: 'provisional',
    color: 'text-amber-700 bg-amber-50 border-amber-200',
    icon: CircleDot,
  },
  {
    value: 'recurrence',
    label: 'Recurrence',
    description: 'Condition has returned after a resolved period.',
    clinical: 'recurrence',
    verification: 'confirmed',
    color: 'text-amber-700 bg-amber-50 border-amber-200',
    icon: RotateCcw,
  },
  {
    value: 'remission',
    label: 'Remission',
    description: 'Patient is symptom-free but not yet considered resolved.',
    clinical: 'remission',
    verification: 'confirmed',
    color: 'text-blue-700 bg-blue-50 border-blue-200',
    icon: Check,
  },
  {
    value: 'resolved',
    label: 'Resolved',
    description: 'Condition has fully resolved. Abatement date recorded.',
    clinical: 'resolved',
    verification: 'confirmed',
    color: 'text-gray-700 bg-gray-50 border-gray-200',
    icon: Check,
  },
  {
    value: 'inactive',
    label: 'Inactive',
    description: 'No longer active but not formally resolved.',
    clinical: 'inactive',
    verification: 'confirmed',
    color: 'text-gray-700 bg-gray-50 border-gray-200',
    icon: CircleDot,
  },
  {
    value: 'refuted',
    // Clinically distinct from "entered in error": the diagnosis was
    // considered and actively ruled out, not "shouldn't have been
    // recorded". Different audit semantics.
    label: 'Refuted — Ruled Out',
    description: 'Diagnosis was considered and ruled out.',
    clinical: 'inactive',
    verification: 'refuted',
    color: 'text-orange-700 bg-orange-50 border-orange-200',
    icon: Ban,
  },
  {
    value: 'entered-in-error',
    label: 'Flag as Error',
    description: 'This condition was recorded by mistake. Preserves audit trail; does not delete.',
    clinical: 'inactive',
    verification: 'entered-in-error',
    color: 'text-red-700 bg-red-50 border-red-200',
    icon: XOctagon,
    destructive: true,
  },
] as const;

const BY_VALUE = new Map<ConditionStateValue, ConditionStateOption>(CONDITION_STATE_OPTIONS.map((o) => [o.value, o]));

export function getConditionStateOption(value: ConditionStateValue): ConditionStateOption {
  const option = BY_VALUE.get(value);
  if (!option) throw new Error(`Unknown condition state: ${value}`);
  return option;
}

/**
 * Map a stored `ConditionSummary` to a UI state value so the update form
 * can pre-populate its state picker. Pure string matching — no FHIR
 * construction. `entered-in-error` wins regardless of clinical status.
 */
export function deriveStateFromSummary(summary: ConditionSummary): ConditionStateValue {
  if (summary.verificationStatus === 'entered-in-error') {
    return 'entered-in-error';
  }
  const match = CONDITION_STATE_OPTIONS.find(
    (o) => o.clinical === summary.clinicalStatus && o.verification === summary.verificationStatus,
  );
  return match?.value ?? 'active-confirmed';
}

/**
 * True for state values that imply the condition is no longer present —
 * used by the form to conditionally reveal the abatement date field.
 * Only `resolved` qualifies: FHIR's abatementDateTime means "condition is no
 * longer present", which remission ("symptom-free, condition persists")
 * doesn't satisfy. Cerner enforces this strictly (422 on abated remission).
 */
export function isAbatementState(value: ConditionStateValue): boolean {
  const opt = getConditionStateOption(value);
  return opt.clinical === 'resolved';
}

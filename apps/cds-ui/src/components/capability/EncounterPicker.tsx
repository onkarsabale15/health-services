'use client';

import { useEncounters } from '@/hooks/useResource';
import type { EncounterSummary } from '@/types';

interface Props {
  /**
   * Whether encounters are supported for this EHR. Source: the patient
   * envelope's `meta.isEncounterSupported` flag (`usePatient().meta`),
   * which the patient endpoint sets from the resolved provider's
   * `encounterModel`. EHRs without a native encounter model (DrChrono,
   * Elation) report `false` — the picker then renders nothing.
   */
  isEncounterSupported: boolean;
  value?: string;
  onChange: (encounterId: string | undefined, encounter?: EncounterSummary) => void;
  /** Optional appointment filter — used in standalone-mode context picker. */
  appointmentId?: string;
  label?: string;
  required?: boolean;
}

/**
 * Renders an encounter selector when the EHR has an encounter model. For
 * EHRs without one (DrChrono, Elation), returns null — the parent flow
 * should jump straight to the patient view.
 */
export function EncounterPicker({
  isEncounterSupported,
  value,
  onChange,
  appointmentId,
  label = 'Encounter',
  required,
}: Props) {
  const { data: encounters, loading } = useEncounters(appointmentId ? { appointmentId } : undefined);

  if (!isEncounterSupported) return null;

  return (
    <label className="block text-sm">
      <span className="text-secondary mb-1 block">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      <select
        className="w-full border border-surface-container-high rounded-md px-3 py-2 bg-white"
        value={value ?? ''}
        onChange={(e) => {
          const id = e.target.value || undefined;
          const enc = encounters?.find((x) => x.id === id);
          onChange(id, enc);
        }}
        disabled={loading || !encounters || encounters.length === 0}
        required={required}
      >
        <option value="">{loading ? 'Loading…' : encounters?.length ? 'Select encounter…' : 'No encounters'}</option>
        {(encounters ?? []).map((enc) => (
          <option key={enc.id} value={enc.id}>
            {[enc.startDate?.slice(0, 10), enc.type, enc.reasonForVisit].filter(Boolean).join(' · ') || enc.id}
          </option>
        ))}
      </select>
    </label>
  );
}

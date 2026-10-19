'use client';

import { useAllergies, useConditions, useEncounter, useMedications, usePatient, useVitals } from './useResource';
import type { ClinicalData } from '@/types';

/**
 * Assembled patient view-data for any tab that wants to render the
 * `<PatientBanner>` plus reuse the underlying hook results. The banner
 * component prop ships ready-to-pass; callers that ALSO need raw hook
 * state (loading flags, capabilities, reload, individual data) read from
 * the named fields and avoid re-mounting the same hooks themselves.
 *
 * Keeping the same hook composition in one place stops three tabs from
 * each calling six hooks — and from accidentally diverging on which
 * hook flags they assemble into the banner prop.
 */
export function usePatientBannerData() {
  const patient = usePatient();
  const encounter = useEncounter(patient.meta?.encounterId);
  const conditions = useConditions();
  const allergies = useAllergies();
  const medications = useMedications();
  const vitals = useVitals();

  const bannerData: ClinicalData | null = patient.data
    ? {
        patient: patient.data,
        encounter: encounter.data ?? null,
        conditions: conditions.data ?? [],
        allergies: allergies.data ?? [],
        medications: medications.data ?? [],
        vitals: vitals.data ?? [],
      }
    : null;

  return {
    patient,
    encounter,
    conditions,
    allergies,
    medications,
    vitals,
    bannerData,
  };
}

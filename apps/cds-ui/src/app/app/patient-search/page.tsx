'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { cdsApi } from '@/lib/api';
import { useSession } from '@/hooks/useSession';
import type { EncounterSummary, PatientSummary } from '@/types';
import WorkflowSidebar from '@/components/launch/WorkflowSidebar';
import PatientSearchStep from '@/components/launch/PatientSearchStep';
import EncounterSelectStep from '@/components/launch/EncounterSelectStep';

/**
 * System / standalone launch flow: find a patient → pick an encounter → open
 * the clinical view. A two-step single screen with the workflow sidebar.
 */
export default function PatientSearchPage() {
  const router = useRouter();
  const { session } = useSession();
  const [patient, setPatient] = useState<PatientSummary | null>(null);

  // Step 1 → set the session's patient context, then advance to encounter pick.
  const handlePatientSelect = async (p: PatientSummary) => {
    await cdsApi.selectPatient(p.id);
    setPatient(p);
  };

  // Step 2 → open the encounter view (encounter passed via query param; the
  // backend encounter-context write is a pre-existing TODO in the launch flow).
  const handleEncounter = (enc: EncounterSummary | null) => {
    if (!patient) return;
    router.push(`/app/patient/${patient.id}${enc ? `?encounter=${enc.id}` : ''}`);
  };

  return (
    <div className="flex h-screen bg-surface">
      <WorkflowSidebar active={patient ? 'encounter' : 'patient'} mode={session?.launchMode} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-white border-b border-surface-container px-7 py-4 shrink-0">
          <div className="text-[17px] font-bold text-surface-on">
            {patient ? `Encounters — ${patient.fullName}` : 'Patient Search'}
          </div>
          <div className="text-xs text-secondary mt-0.5">
            {patient
              ? 'Select an appointment or encounter to open the clinical view'
              : 'Search by patient name, date of birth, or MRN'}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-7 py-6">
          {patient ? (
            <EncounterSelectStep patient={patient} onBack={() => setPatient(null)} onSelect={handleEncounter} />
          ) : (
            <PatientSearchStep onSelect={handlePatientSelect} />
          )}
        </div>
      </div>
    </div>
  );
}

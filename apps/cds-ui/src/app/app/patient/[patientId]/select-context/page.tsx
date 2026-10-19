'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { cdsApi } from '@/lib/api';
import { useSession } from '@/hooks/useSession';
import type { EncounterSummary, PatientSummary } from '@/types';
import WorkflowSidebar from '@/components/launch/WorkflowSidebar';
import EncounterSelectStep from '@/components/launch/EncounterSelectStep';
import LoadingSpinner from '@/components/LoadingSpinner';

/**
 * Encounter picker for a standalone launch — the patient is already in context
 * (set by the SMART launch), so this skips search and goes straight to encounter
 * selection. EHR launch skips this entirely (encounter set from SMART context).
 */
export default function SelectContextPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const router = useRouter();
  const { session } = useSession();
  const [patient, setPatient] = useState<PatientSummary | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    cdsApi
      .getPatientResponse()
      .then(({ data }) => {
        if (data) setPatient(data);
        else setError('Patient context not found.');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load patient'));
  }, []);

  const handleEncounter = (enc: EncounterSummary | null) => {
    router.push(`/app/patient/${patientId}${enc ? `?encounter=${enc.id}` : ''}`);
  };

  return (
    <div className="flex h-screen bg-surface">
      <WorkflowSidebar active="encounter" mode={session?.launchMode} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-white border-b border-surface-container px-7 py-4 shrink-0">
          <div className="text-[17px] font-bold text-surface-on">
            Select Encounter{patient ? ` — ${patient.fullName}` : ''}
          </div>
          <div className="text-xs text-secondary mt-0.5">
            Select an appointment or encounter to open the clinical view
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-7 py-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 max-w-3xl">
              {error}
            </div>
          )}
          {patient ? (
            <EncounterSelectStep patient={patient} onSelect={handleEncounter} />
          ) : (
            !error && <LoadingSpinner />
          )}
        </div>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { cdsApi } from '@/lib/api';
import type { CarePlan, PatientSummary } from '@/types';
import PatientBanner from '@/components/PatientBanner';
import CarePlansTable from '@/components/CarePlansTable';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function PatientHistoryPage() {
  const [patient, setPatient] = useState<PatientSummary | null>(null);
  const [carePlans, setCarePlans] = useState<CarePlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      cdsApi
        .getPatientResponse()
        .then(({ data }) => setPatient(data))
        .catch(() => {}),
      cdsApi
        .getCarePlans('current')
        .then(setCarePlans)
        .catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      {patient && (
        <PatientBanner
          data={{
            patient,
            encounter: null,
            conditions: [],
            allergies: [],
            medications: [],
            vitals: [],
          }}
        />
      )}

      <div className="cds-card p-4 flex items-center gap-2">
        <span className="material-symbols-outlined text-primary" style={{ fontSize: 20 }}>
          history
        </span>
        <h3 className="text-sm font-semibold text-secondary uppercase tracking-wider">
          Care Plans ({carePlans.length})
        </h3>
      </div>

      <CarePlansTable
        carePlans={carePlans}
        emptyMessage="No care plans for this patient yet."
        emptySubtext="Generate an AI Care Plan from the Analysis tab."
      />
    </div>
  );
}

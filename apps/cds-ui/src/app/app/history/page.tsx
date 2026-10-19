'use client';

import { useEffect, useState } from 'react';
import { cdsApi } from '@/lib/api';
import type { CarePlan } from '@/types';
import CarePlansTable from '@/components/CarePlansTable';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function AllHistoryPage() {
  const [carePlans, setCarePlans] = useState<CarePlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cdsApi
      .getCarePlans()
      .then(setCarePlans)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="material-symbols-outlined text-primary" style={{ fontSize: 24 }}>
          folder_open
        </span>
        <div>
          <h2 className="text-lg font-bold text-surface-on">All Care Plans</h2>
          <p className="text-xs text-secondary">Across all patients and encounters</p>
        </div>
      </div>

      <CarePlansTable carePlans={carePlans} showPatient emptyMessage="No care plans have been created yet." />
    </div>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import { cdsApi } from '@/lib/api';
import { useAnalysisStatus } from '@/hooks/useAnalysisStatus';
import type { CarePlan } from '@/types';
import CarePlansTable from '@/components/CarePlansTable';
import ErrorBanner from '@/components/ErrorBanner';

const ACTIVE_STATUSES = ['DRAFT', 'ACTIVE'];

/**
 * Care Plans tab — the care-plan documents for this encounter. Active (draft +
 * approved) vs past (completed + revoked), with a floating "Generate Care Plan"
 * action that kicks off AI analysis. The list refreshes when an analysis lands.
 */
export default function CarePlansTab() {
  const { status, isAnalyzing, markStarted } = useAnalysisStatus();
  const [view, setView] = useState<'active' | 'past'>('active');
  const [plans, setPlans] = useState<CarePlan[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    cdsApi
      .getCarePlans('current')
      .then(setPlans)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load care plans'));
  }, []);

  useEffect(() => load(), [load]);

  // Refresh when a fresh analysis completes (a new draft plan appears).
  useEffect(() => {
    if (status === 'complete') load();
  }, [status, load]);

  const generate = async () => {
    setError('');
    try {
      markStarted();
      await cdsApi.startAnalysis();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to start analysis');
    }
  };

  const active = (plans ?? []).filter((p) => ACTIVE_STATUSES.includes(p.status));
  const past = (plans ?? []).filter((p) => !ACTIVE_STATUSES.includes(p.status));
  const shown = view === 'active' ? active : past;

  return (
    <div className="relative pb-20">
      <div className="flex gap-1 bg-surface-container-low rounded-lg p-1 mb-5 w-fit">
        {(
          [
            { id: 'active', label: `Active Plans${active.length ? ` (${active.length})` : ''}` },
            { id: 'past', label: `Past / Submitted${past.length ? ` (${past.length})` : ''}` },
          ] as const
        ).map((v) => (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            className={`px-3.5 py-1.5 rounded-md text-xs transition-all ${
              view === v.id ? 'bg-white text-surface-on font-semibold shadow-sm' : 'text-secondary font-medium'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      <ErrorBanner message={error} onDismiss={() => setError('')} />

      {plans === null ? (
        <div className="h-40 rounded-xl bg-surface-container-low animate-pulse" />
      ) : (
        <CarePlansTable
          carePlans={shown}
          emptyMessage={view === 'active' ? 'No active care plans' : 'No past care plans'}
          emptySubtext={view === 'active' ? 'Generate one with AI analysis below.' : undefined}
        />
      )}

      {/* Floating generate */}
      <button
        onClick={generate}
        disabled={isAnalyzing}
        className="fixed bottom-7 right-9 z-40 flex items-center gap-2 px-5 py-3 rounded-full btn-primary shadow-floating disabled:opacity-70"
      >
        {isAnalyzing ? (
          <>
            <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Generating…
          </>
        ) : (
          <>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              neurology
            </span>
            Generate Care Plan
          </>
        )}
      </button>
    </div>
  );
}

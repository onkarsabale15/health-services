'use client';

import { useCallback, useEffect, useState } from 'react';
import { cdsApi } from '@/lib/api';
import { useAnalysisStatus } from '@/hooks/useAnalysisStatus';
import { useSession } from '@/hooks/useSession';
import { useExportPdf } from '@/hooks/useExportPdf';
import { useUpdateStatus } from '@/hooks/useUpdateStatus';
import type { CarePlan, CdsCard } from '@/types';
import CdsCardList from '@/components/CdsCardList';
import AnalysisLoader from '@/components/AnalysisLoader';
import ErrorBanner from '@/components/ErrorBanner';

/**
 * Recommendations tab — the AI clinical-analysis surface. Generates an
 * encounter-scoped care plan, shows the resulting recommendation cards, and
 * lets an authorized provider approve / export / re-generate. Mirrors the
 * standalone analysis route, scoped to the cookie session's (patient,
 * encounter).
 */
export default function RecommendationsTab({ onPlanChange }: { onPlanChange?: (plan: CarePlan | null) => void }) {
  const { status, error: liveError, isAnalyzing, markStarted } = useAnalysisStatus();
  const { session } = useSession();
  const canApprove = session?.provider.capabilities.canApproveCarePlan ?? false;

  const [bootstrapped, setBootstrapped] = useState(false);
  const [plan, setPlan] = useState<CarePlan | null>(null);
  const [cards, setCards] = useState<CdsCard[]>([]);
  const [error, setError] = useState('');

  const { exporting, handleExportPdf, exportError } = useExportPdf();
  const { updatingStatus, statusError, updateStatus } = useUpdateStatus((updated) => {
    setPlan(updated);
    onPlanChange?.(updated);
  });

  const applyPlan = useCallback(
    (p: CarePlan | null) => {
      setPlan(p);
      setCards((p?.cards as CdsCard[]) ?? []);
      onPlanChange?.(p);
    },
    [onPlanChange],
  );

  useEffect(() => {
    let active = true;
    cdsApi
      .getCurrentCarePlan()
      .then((p) => active && applyPlan(p))
      .catch(() => {})
      .finally(() => active && setBootstrapped(true));
    return () => {
      active = false;
    };
  }, [applyPlan]);

  // SSE-driven: refetch the saved plan when a fresh analysis lands.
  useEffect(() => {
    let active = true;
    if (status === 'complete') {
      cdsApi
        .getCurrentCarePlan()
        .then((p) => active && p && applyPlan(p))
        .catch(() => {});
    }
    if (status === 'error') setError(liveError || 'Analysis failed');
    return () => {
      active = false;
    };
  }, [status, liveError, applyPlan]);

  const generate = useCallback(
    async (opts?: { previousCarePlanId?: string }) => {
      setError('');
      try {
        markStarted();
        await cdsApi.startAnalysis(opts);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to start analysis');
      }
    },
    [markStarted],
  );

  if (!bootstrapped) {
    return <div className="h-40 rounded-xl bg-surface-container-low animate-pulse" />;
  }
  if (isAnalyzing) return <AnalysisLoader status="analyzing" />;

  const combinedError = error || exportError || statusError;

  // Empty state — generate.
  if (!plan || cards.length === 0) {
    return (
      <div className="cds-card p-8 text-center space-y-3 max-w-xl mx-auto">
        <span className="material-symbols-outlined text-primary" style={{ fontSize: 44 }}>
          neurology
        </span>
        <h3 className="text-lg font-semibold text-surface-on">AI-Powered Clinical Analysis</h3>
        <p className="text-sm text-secondary">
          Generate evidence-based recommendations from this patient&apos;s conditions, medications, allergies, and
          vitals.
        </p>
        <ErrorBanner message={combinedError} onDismiss={() => setError('')} />
        <button
          onClick={() => generate()}
          className="btn-primary text-sm px-6 py-2.5 rounded-xl inline-flex items-center gap-2"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            neurology
          </span>
          Generate Recommendations
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Plan header */}
      <div className="cds-card p-4 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className={`badge badge-${plan.status.toLowerCase()}`}>{plan.status}</span>
          <span className="text-sm font-semibold text-surface-on">{plan.title}</span>
          {plan.version > 1 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
              v{plan.version}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canApprove && plan.status === 'DRAFT' && (
            <button
              onClick={() => updateStatus(plan.id, 'ACTIVE')}
              disabled={updatingStatus}
              className="text-xs px-3 py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 border border-green-200/60 transition-colors disabled:opacity-50 flex items-center gap-1"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                check_circle
              </span>
              Approve
            </button>
          )}
          <button
            onClick={() => handleExportPdf(plan.id)}
            disabled={exporting}
            className="btn-secondary text-xs flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
              {exporting ? 'hourglass_empty' : 'picture_as_pdf'}
            </span>
            {exporting ? 'Generating…' : 'PDF'}
          </button>
          <button
            onClick={() => generate({ previousCarePlanId: plan.id })}
            className="btn-secondary text-xs flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
              refresh
            </span>
            Re-generate
          </button>
        </div>
      </div>

      <ErrorBanner message={combinedError} onDismiss={() => setError('')} />
      <CdsCardList cards={cards} />
    </div>
  );
}

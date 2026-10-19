'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { cdsApi } from '@/lib/api';
import { useExportPdf } from '@/hooks/useExportPdf';
import { useCarePlanEditing } from '@/hooks/useCarePlanEditing';
import { useUpdateStatus } from '@/hooks/useUpdateStatus';
import { useAnalysisStatus } from '@/hooks/useAnalysisStatus';
import { useSession } from '@/hooks/useSession';
import { usePatientBannerData } from '@/hooks/usePatientBannerData';
import type { CdsCard, CarePlan } from '@/types';
import CdsCardList from '@/components/CdsCardList';
import AnalysisLoader from '@/components/AnalysisLoader';
import ErrorState from '@/components/ErrorState';
import ErrorBanner from '@/components/ErrorBanner';
import LoadingSpinner from '@/components/LoadingSpinner';
import PatientBanner from '@/components/PatientBanner';
import { PartialDataBanner, type MissingSection } from '@/components/PartialDataBanner';

type AnalysisState = 'loading' | 'existing' | 'idle' | 'analyzing' | 'complete' | 'error';

export default function AnalysisPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const { status: liveStatus, error: liveError, isAnalyzing, markStarted } = useAnalysisStatus();
  const { session } = useSession();
  // Server-enforced capability — `CarePlanApprovalGuard` rejects an
  // unauthorized POST regardless of what the FE renders. Hiding the button
  // here is purely for affordance: a nurse or MA shouldn't be invited to
  // click an action that will 403.
  const canApprove = session?.provider.capabilities.canApproveCarePlan ?? false;

  const { bannerData, conditions, allergies, medications, vitals } = usePatientBannerData();

  // Resources whose hook reports an error AFTER initial load — these are
  // sections the AI care-plan generation will silently miss unless we
  // surface it.
  const missingSections: MissingSection[] = [];
  if (!conditions.loading && conditions.error) missingSections.push({ label: 'conditions', reason: conditions.error });
  if (!allergies.loading && allergies.error) missingSections.push({ label: 'allergies', reason: allergies.error });
  if (!medications.loading && medications.error)
    missingSections.push({ label: 'medications', reason: medications.error });
  if (!vitals.loading && vitals.error) missingSections.push({ label: 'vitals', reason: vitals.error });

  const [bootstrapped, setBootstrapped] = useState(false);
  const [cards, setCards] = useState<CdsCard[]>([]);
  const [existingPlan, setExistingPlan] = useState<CarePlan | null>(null);
  const [error, setError] = useState('');
  const [justCompleted, setJustCompleted] = useState(false);

  // Instructions + re-analyze modal
  const [showReanalyzeModal, setShowReanalyzeModal] = useState(false);
  const [instructions, setInstructions] = useState('');
  // Don't use a useRef-based mounted flag here: under React 18 strict mode
  // the cleanup runs between the double-mount, leaving the ref `false`
  // when the second mount's effect re-runs. That permanently blocks
  // `setBootstrapped(true)` and the spinner never resolves. Each effect
  // gets its own local `active` closure instead.

  // Shared hooks
  const { exporting, handleExportPdf, exportError } = useExportPdf();
  const { updatingStatus, statusError, updateStatus } = useUpdateStatus((updated) => {
    setExistingPlan(updated);
  });
  const { editing, editCards, saving, editError, setEditCards, startEditing, cancelEditing, saveEdits } =
    useCarePlanEditing((updated) => {
      setExistingPlan(updated);
      setCards(updated.cards as CdsCard[]);
    });

  // Bootstrap: pick up the latest care plan for the session's (patient,
  // encounter). Scoped server-side via the cookie session — same site,
  // different provider sees the team's existing draft instead of a blank
  // "Generate" page.
  useEffect(() => {
    let active = true;
    cdsApi
      .getCurrentCarePlan()
      .then((plan) => {
        if (!active) return;
        if (plan) {
          setExistingPlan(plan);
          setCards(plan.cards as CdsCard[]);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setBootstrapped(true);
      });
    return () => {
      active = false;
    };
  }, []);

  // React to live status changes via SSE — no local polling needed.
  useEffect(() => {
    let active = true;
    if (liveStatus === 'complete') {
      // Fresh analysis just landed — refetch the saved care plan to show it.
      cdsApi
        .getCurrentCarePlan()
        .then((plan) => {
          if (!active || !plan) return;
          setExistingPlan(plan);
          setCards(plan.cards as CdsCard[]);
          setJustCompleted(true);
          setError('');
        })
        .catch(() => {});
    }
    if (liveStatus === 'error') {
      setError(liveError || 'Analysis failed');
    }
    if (liveStatus === 'analyzing' || liveStatus === 'pending') {
      // A new run started — clear any previous "just completed" celebration.
      setJustCompleted(false);
    }
    return () => {
      active = false;
    };
  }, [liveStatus, liveError]);

  const handleGenerateAnalysis = useCallback(
    async (opts?: { previousCarePlanId?: string; instructions?: string }) => {
      setError('');
      setShowReanalyzeModal(false);
      try {
        // Optimistic: paint the in-progress UI before the server round-trip
        // finishes. The SSE stream takes over from there.
        markStarted();
        await cdsApi.startAnalysis(opts);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to start analysis');
      }
    },
    [markStarted],
  );

  const handleReanalyze = useCallback(() => {
    if (!existingPlan) return;
    handleGenerateAnalysis({
      previousCarePlanId: existingPlan.id,
      instructions: instructions.trim() || undefined,
    });
    setInstructions('');
  }, [existingPlan, instructions, handleGenerateAnalysis]);

  // Derive page state from the SSE-driven status + bootstrap progress.
  const state: AnalysisState = !bootstrapped
    ? 'loading'
    : isAnalyzing
      ? 'analyzing'
      : liveStatus === 'error' || error
        ? 'error'
        : existingPlan
          ? justCompleted
            ? 'complete'
            : 'existing'
          : 'idle';

  const combinedError = error || exportError || statusError || editError;

  // Banner renders independently of the care-plan bootstrap so the page
  // doesn't show a blank spinner while a plan loads.
  const banner = bannerData ? <PatientBanner data={bannerData} /> : null;
  const partialDataBanner = <PartialDataBanner missing={missingSections} />;

  if (state === 'loading') {
    return (
      <div className="space-y-4">
        {banner}
        {partialDataBanner}
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {banner}
      {partialDataBanner}
      {/* ── Existing analysis ────────────────────────────── */}
      {state === 'existing' && existingPlan && (
        <>
          {/* Plan header */}
          <div className="cds-card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-blue-500" style={{ fontSize: 22 }}>
                  description
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-surface-on">{existingPlan.title}</p>
                    {existingPlan.version > 1 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                        v{existingPlan.version}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-secondary">
                    {existingPlan.encounterType && `${existingPlan.encounterType} · `}
                    Generated {new Date(existingPlan.createdAt).toLocaleString()}
                    {existingPlan.providerName && ` by ${existingPlan.providerName}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`badge badge-${existingPlan.status.toLowerCase()}`}>{existingPlan.status}</span>
                {!editing && (
                  <>
                    <button
                      onClick={() => startEditing(cards)}
                      className="btn-secondary flex items-center gap-1.5 text-sm"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                        edit
                      </span>
                      Edit
                    </button>
                    <button
                      onClick={() => handleExportPdf(existingPlan.id)}
                      disabled={exporting}
                      className="btn-secondary flex items-center gap-1.5 text-sm"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                        {exporting ? 'hourglass_empty' : 'picture_as_pdf'}
                      </span>
                      {exporting ? 'Generating...' : 'PDF'}
                    </button>
                    <button
                      onClick={() => setShowReanalyzeModal(true)}
                      className="btn-secondary flex items-center gap-1.5 text-sm"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                        refresh
                      </span>
                      Re-analyze
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Status actions */}
            {!editing && existingPlan.status === 'DRAFT' && (
              <div className="mt-3 pt-3 border-t border-surface-container-high/30 flex items-center gap-2">
                <span className="text-xs text-secondary mr-1">Actions:</span>
                {canApprove && (
                  <button
                    onClick={() => updateStatus(existingPlan.id, 'ACTIVE')}
                    disabled={updatingStatus}
                    className="text-xs px-3 py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 border border-green-200/60 transition-colors disabled:opacity-50"
                  >
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                        check_circle
                      </span>
                      Approve
                    </span>
                  </button>
                )}
                <button
                  onClick={() => updateStatus(existingPlan.id, 'REVOKED')}
                  disabled={updatingStatus}
                  className="text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 border border-red-200/60 transition-colors disabled:opacity-50"
                >
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                      cancel
                    </span>
                    Dismiss
                  </span>
                </button>
              </div>
            )}

            {!editing && existingPlan.status === 'ACTIVE' && (
              <div className="mt-3 pt-3 border-t border-surface-container-high/30 flex items-center gap-2">
                <span className="text-xs text-secondary mr-1">Actions:</span>
                <button
                  onClick={() => updateStatus(existingPlan.id, 'COMPLETED')}
                  disabled={updatingStatus}
                  className="text-xs px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200/60 transition-colors disabled:opacity-50"
                >
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                      task_alt
                    </span>
                    Mark Complete
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* Edit toolbar */}
          {editing && (
            <EditToolbar
              saving={saving}
              onCancel={cancelEditing}
              onSave={() => existingPlan && saveEdits(existingPlan.id)}
            />
          )}

          {editing ? (
            <CdsCardList cards={editCards} editable onCardsChange={setEditCards} />
          ) : (
            <CdsCardList cards={cards} />
          )}

          <ErrorBanner message={combinedError} onDismiss={() => setError('')} />

          {!editing && (
            <div className="flex justify-end">
              <Link
                href={`/app/patient/${patientId}/history`}
                className="btn-secondary flex items-center gap-2 text-sm"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                  history
                </span>
                View All History
              </Link>
            </div>
          )}
        </>
      )}

      {/* ── Analysis in progress ─────────────────────────── */}
      {state === 'analyzing' && <AnalysisLoader status="analyzing" />}

      {/* ── Error ────────────────────────────────────────── */}
      {state === 'error' && <ErrorState message={error} onRetry={() => handleGenerateAnalysis()} />}

      {/* ── Fresh analysis completed ─────────────────────── */}
      {state === 'complete' && cards.length > 0 && (
        <>
          {existingPlan && (
            <div className="cds-card p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-green-700 flex items-center gap-1.5">
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                    check_circle
                  </span>
                  {existingPlan.version > 1
                    ? `Re-analysis complete (v${existingPlan.version}) — saved as draft`
                    : 'Analysis complete — saved as draft'}
                </p>
                <div className="flex items-center gap-2">
                  {!editing && (
                    <>
                      <button
                        onClick={() => startEditing(cards)}
                        className="btn-secondary flex items-center gap-1.5 text-xs"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                          edit
                        </span>
                        Edit
                      </button>
                      <button
                        onClick={() => handleExportPdf(existingPlan.id)}
                        disabled={exporting}
                        className="btn-secondary flex items-center gap-1.5 text-xs"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                          {exporting ? 'hourglass_empty' : 'picture_as_pdf'}
                        </span>
                        {exporting ? 'Generating...' : 'PDF'}
                      </button>
                      {canApprove && (
                        <button
                          onClick={() => updateStatus(existingPlan.id, 'ACTIVE')}
                          disabled={updatingStatus}
                          className="text-xs px-3 py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 border border-green-200/60 transition-colors disabled:opacity-50"
                        >
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                              check_circle
                            </span>
                            Approve
                          </span>
                        </button>
                      )}
                      <button
                        onClick={() => setShowReanalyzeModal(true)}
                        className="btn-secondary flex items-center gap-1.5 text-xs"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                          refresh
                        </span>
                        Re-analyze
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {editing && existingPlan && (
            <EditToolbar saving={saving} onCancel={cancelEditing} onSave={() => saveEdits(existingPlan.id)} />
          )}

          {editing ? (
            <CdsCardList cards={editCards} editable onCardsChange={setEditCards} />
          ) : (
            <CdsCardList cards={cards} />
          )}

          <ErrorBanner message={combinedError} onDismiss={() => setError('')} />

          {!editing && (
            <div className="flex items-center justify-between">
              {!existingPlan && (
                <p className="text-sm text-secondary flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-green-600" style={{ fontSize: 18 }}>
                    check_circle
                  </span>
                  Auto-saved as draft care plan
                </p>
              )}
              <Link
                href={`/app/patient/${patientId}/history`}
                className="btn-secondary flex items-center gap-2 ml-auto"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                  history
                </span>
                View in History
              </Link>
            </div>
          )}
        </>
      )}

      {state === 'complete' && cards.length === 0 && (
        <div className="cds-card p-8 text-center space-y-3">
          <span className="material-symbols-outlined text-secondary" style={{ fontSize: 40 }}>
            info
          </span>
          <p className="text-secondary">No recommendations generated. Try again or check the patient data.</p>
          <button onClick={() => handleGenerateAnalysis()} className="btn-secondary">
            Retry Analysis
          </button>
        </div>
      )}

      {/* ── No existing analysis — generate ──────────────── */}
      {state === 'idle' && (
        <div className="space-y-4">
          <div className="cds-card p-8 text-center space-y-3">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 48 }}>
              magic_button
            </span>
            <h3 className="text-lg font-semibold text-surface-on">AI-Powered Clinical Analysis</h3>
            <p className="text-sm text-secondary max-w-md mx-auto">
              Generate clinical recommendations based on conditions, medications, allergies, and vitals.
            </p>
          </div>

          {/* Instructions for initial analysis */}
          <div className="cds-card p-4">
            <label className="block text-sm font-medium text-surface-on mb-1.5">
              Instructions for AI <span className="text-secondary font-normal">(optional)</span>
            </label>
            <p className="text-xs text-secondary mb-2">
              Guide the analysis — specify focus areas, clinical context, or areas to prioritize.
            </p>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="e.g., Focus on cardiovascular risk factors. Patient has a family history of heart disease. Check if current medications are optimal."
              rows={3}
              maxLength={1000}
              className="w-full border border-surface-container-high rounded-xl px-3.5 py-2.5 text-sm text-surface-on placeholder:text-secondary/50 focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
            />
            <div className="flex items-center justify-between mt-2">
              <div className="flex flex-wrap gap-1.5">
                {['Focus on medication interactions', 'Assess fall risk', 'Review cardiovascular risk'].map((chip) => (
                  <button
                    key={chip}
                    onClick={() => setInstructions(instructions ? `${instructions}. ${chip}` : chip)}
                    className="text-[11px] px-2.5 py-1 rounded-full bg-surface-container-low hover:bg-primary/10 text-secondary hover:text-primary border border-surface-container-high/50 transition-colors"
                  >
                    {chip}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-secondary/60">{instructions.length}/1000</p>
            </div>
          </div>

          <div className="flex justify-center">
            <button
              onClick={() => handleGenerateAnalysis({ instructions: instructions.trim() || undefined })}
              className="btn-primary text-base px-8 py-3.5 flex items-center gap-2.5 rounded-xl"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 22 }}>
                magic_button
              </span>
              Generate AI Care Plan
            </button>
          </div>
        </div>
      )}

      {/* ── Re-analyze Modal ─────────────────────────────── */}
      {showReanalyzeModal && existingPlan && (
        <InstructionsModal
          carePlan={existingPlan}
          instructions={instructions}
          onInstructionsChange={setInstructions}
          onSubmit={handleReanalyze}
          onClose={() => {
            setShowReanalyzeModal(false);
            setInstructions('');
          }}
        />
      )}
    </div>
  );
}

// ── Edit Toolbar (shared markup) ─────────────────────────────

function EditToolbar({ saving, onCancel, onSave }: { saving: boolean; onCancel: () => void; onSave: () => void }) {
  return (
    <div className="cds-card p-3 flex items-center justify-between bg-primary/5 border border-primary/20">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-primary" style={{ fontSize: 18 }}>
          edit_note
        </span>
        <p className="text-sm font-medium text-primary">Editing mode — modify, remove, or add recommendations</p>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={onCancel} disabled={saving} className="btn-secondary text-xs">
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={saving}
          className="text-xs px-4 py-1.5 rounded-lg bg-primary text-white hover:bg-primary-dim transition-colors disabled:opacity-50 flex items-center gap-1.5"
        >
          {saving ? (
            <>
              <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                save
              </span>
              Save Changes
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ── Instructions Modal (re-analysis) ─────────────────────────

function InstructionsModal({
  carePlan,
  instructions,
  onInstructionsChange,
  onSubmit,
  onClose,
}: {
  carePlan: CarePlan;
  instructions: string;
  onInstructionsChange: (v: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  const criticalCount = carePlan.cards.filter((c) => c.severity === 'critical').length;
  const warningCount = carePlan.cards.filter((c) => c.severity === 'warning').length;
  const infoCount = carePlan.cards.filter((c) => c.severity === 'info').length;

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        style={{ boxShadow: '0 25px 50px -12px rgba(0, 52, 94, 0.2)' }}
      >
        <div className="p-5 border-b border-surface-container-high/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary" style={{ fontSize: 20 }}>
                  refresh
                </span>
              </div>
              <div>
                <h3 className="text-base font-semibold text-surface-on">Re-analyze Care Plan</h3>
                <p className="text-xs text-secondary">
                  v{carePlan.version} → v{carePlan.version + 1}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="text-secondary hover:text-surface-on p-1">
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                close
              </span>
            </button>
          </div>
        </div>

        <div className="px-5 py-4 bg-surface-container-low/30 border-b border-surface-container-high/30">
          <p className="text-xs font-medium text-secondary uppercase tracking-wider mb-2">Current Analysis Summary</p>
          <div className="flex items-center gap-3 mb-3">
            {criticalCount > 0 && <span className="badge badge-critical">{criticalCount} Critical</span>}
            {warningCount > 0 && <span className="badge badge-warning">{warningCount} Warning</span>}
            {infoCount > 0 && <span className="badge badge-info">{infoCount} Info</span>}
          </div>
          <div className="space-y-1.5 max-h-32 overflow-y-auto">
            {carePlan.cards.map((card, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span
                  className={`shrink-0 mt-0.5 w-1.5 h-1.5 rounded-full ${
                    card.severity === 'critical'
                      ? 'bg-red-500'
                      : card.severity === 'warning'
                        ? 'bg-amber-500'
                        : 'bg-blue-500'
                  }`}
                />
                <span className="text-surface-on">{card.summary}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-5 space-y-3">
          <div>
            <label className="block text-sm font-medium text-surface-on mb-1.5">
              Instructions for AI <span className="text-secondary font-normal">(optional)</span>
            </label>
            <p className="text-xs text-secondary mb-2">
              Guide the re-analysis — specify what to correct, areas to focus on, or clinical context the AI should
              consider.
            </p>
            <textarea
              value={instructions}
              onChange={(e) => onInstructionsChange(e.target.value)}
              placeholder="e.g., The metformin interaction is not relevant — patient tolerates it. Focus on fall risk instead. Also check if statin dose is optimal."
              rows={4}
              maxLength={1000}
              className="w-full border border-surface-container-high rounded-xl px-3.5 py-2.5 text-sm text-surface-on placeholder:text-secondary/50 focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
            />
            <p className="text-[10px] text-secondary/60 text-right mt-1">{instructions.length}/1000</p>
          </div>
          <div>
            <p className="text-xs text-secondary mb-1.5">Quick instructions:</p>
            <div className="flex flex-wrap gap-1.5">
              {[
                'Focus on medication interactions',
                'Assess fall risk',
                'Check preventive screenings',
                'Review cardiovascular risk',
                'Ignore resolved conditions',
              ].map((chip) => (
                <button
                  key={chip}
                  onClick={() => onInstructionsChange(instructions ? `${instructions}. ${chip}` : chip)}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-surface-container-low hover:bg-primary/10 text-secondary hover:text-primary border border-surface-container-high/50 transition-colors"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-surface-container-high/30 flex items-center justify-between">
          <button onClick={onClose} className="btn-secondary text-sm">
            Cancel
          </button>
          <button onClick={onSubmit} className="btn-primary text-sm px-5 py-2.5 flex items-center gap-2 rounded-xl">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              magic_button
            </span>
            {instructions.trim() ? 'Re-analyze with Instructions' : 'Re-analyze'}
          </button>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { cdsApi } from '@/lib/api';
import { STATUS_BADGE, STATUS_OPTIONS } from '@/lib/cds-constants';
import { useExportPdf } from '@/hooks/useExportPdf';
import { useCarePlanEditing } from '@/hooks/useCarePlanEditing';
import { useUpdateStatus } from '@/hooks/useUpdateStatus';
import type { CarePlan } from '@/types';
import CdsCardList from '@/components/CdsCardList';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorBanner from '@/components/ErrorBanner';

export default function CarePlanDetailPage() {
  const { carePlanId } = useParams<{ carePlanId: string }>();
  const router = useRouter();
  const [plan, setPlan] = useState<CarePlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Shared hooks
  const { exporting, handleExportPdf, exportError } = useExportPdf();
  const { updatingStatus, statusError, updateStatus } = useUpdateStatus(setPlan);
  const { editing, editCards, saving, editError, setEditCards, startEditing, cancelEditing, saveEdits } =
    useCarePlanEditing(setPlan);

  useEffect(() => {
    cdsApi
      .getCarePlan(carePlanId)
      .then(setPlan)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load care plan'))
      .finally(() => setLoading(false));
  }, [carePlanId]);

  const handleDelete = useCallback(async () => {
    if (!plan) return;
    const confirmed = window.confirm(
      `Delete this care plan permanently? This cannot be undone.\n\n"${plan.title}" (v${plan.version})`,
    );
    if (!confirmed) return;
    setDeleting(true);
    try {
      await cdsApi.deleteCarePlan(plan.id);
      router.push('/app/history');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete care plan');
      setDeleting(false);
    }
  }, [plan, router]);

  if (loading) return <LoadingSpinner />;

  if ((error || statusError) && !plan) {
    return (
      <div className="cds-card p-8 text-center space-y-3">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto">
          <span className="text-red-600 text-xl font-bold">!</span>
        </div>
        <h3 className="text-lg font-semibold text-surface-on">Error</h3>
        <p className="text-sm text-secondary">{error || statusError}</p>
        <button onClick={() => router.push('/app/history')} className="btn-secondary text-sm">
          Back to History
        </button>
      </div>
    );
  }

  if (!plan) return null;

  const combinedError = error || exportError || statusError || editError;

  return (
    <div className="space-y-4">
      <ErrorBanner message={combinedError} onDismiss={() => setError('')} />

      {/* Header */}
      <div className="cds-card p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-surface-on">{plan.title}</h2>
              {plan.version > 1 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                  v{plan.version}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-sm text-secondary">
              <span className={`badge ${STATUS_BADGE[plan.status] ?? ''}`}>{plan.status}</span>
              <span>Created {new Date(plan.createdAt).toLocaleString()}</span>
              {plan.updatedAt !== plan.createdAt && <span>Updated {new Date(plan.updatedAt).toLocaleString()}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!editing && (
              <>
                <button
                  onClick={() => startEditing(plan.cards)}
                  className="btn-secondary flex items-center gap-1.5 text-sm"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                    edit
                  </span>
                  Edit
                </button>
                <button
                  onClick={() => handleExportPdf(plan.id)}
                  disabled={exporting}
                  className="btn-secondary flex items-center gap-1.5 text-sm"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                    {exporting ? 'hourglass_empty' : 'picture_as_pdf'}
                  </span>
                  {exporting ? 'Generating...' : 'Export PDF'}
                </button>
              </>
            )}
            <button
              onClick={() => router.push('/app/history')}
              className="text-sm text-secondary hover:text-surface-on flex items-center gap-1"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                arrow_back
              </span>
              Back
            </button>
          </div>
        </div>
      </div>

      {/* Context */}
      {!editing && (
        <div className="cds-card p-5">
          <div className="cds-section-header mb-3">
            <span className="material-symbols-outlined icon">info</span>
            <h3>Context</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-secondary">Patient</p>
              <p className="text-surface-on font-medium">{plan.patientName ?? plan.patientFhirId}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-secondary">EHR</p>
              <p className="text-surface-on font-medium capitalize">{plan.ehrName}</p>
            </div>
            {plan.encounterType && (
              <div>
                <p className="text-[10px] uppercase tracking-wider font-bold text-secondary">Encounter</p>
                <p className="text-surface-on font-medium">{plan.encounterType}</p>
              </div>
            )}
            {plan.encounterDate && (
              <div>
                <p className="text-[10px] uppercase tracking-wider font-bold text-secondary">Encounter Date</p>
                <p className="text-surface-on font-medium">{new Date(plan.encounterDate).toLocaleDateString()}</p>
              </div>
            )}
            {plan.providerName && (
              <div>
                <p className="text-[10px] uppercase tracking-wider font-bold text-secondary">Provider</p>
                <p className="text-surface-on font-medium">{plan.providerName}</p>
              </div>
            )}
            {plan.version > 1 && (
              <div>
                <p className="text-[10px] uppercase tracking-wider font-bold text-secondary">Version</p>
                <p className="text-surface-on font-medium">
                  v{plan.version}
                  {plan.parentId ? ' (re-analysis)' : ''}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit toolbar */}
      {editing && (
        <div className="cds-card p-3 flex items-center justify-between bg-primary/5 border border-primary/20">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 18 }}>
              edit_note
            </span>
            <p className="text-sm font-medium text-primary">Editing mode — modify, remove, or add recommendations</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={cancelEditing} disabled={saving} className="btn-secondary text-xs">
              Cancel
            </button>
            <button
              onClick={() => saveEdits(plan.id)}
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
      )}

      {/* Cards */}
      {editing ? (
        <CdsCardList cards={editCards} editable onCardsChange={setEditCards} />
      ) : (
        <CdsCardList cards={plan.cards} />
      )}

      {/* Actions */}
      {!editing && (
        <div className="cds-card p-5">
          <div className="cds-section-header mb-3">
            <span className="material-symbols-outlined icon">settings</span>
            <h3>Actions</h3>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-sm text-secondary">Status:</label>
              <select
                value={plan.status}
                onChange={(e) => updateStatus(plan.id, e.target.value as 'ACTIVE' | 'COMPLETED' | 'REVOKED' | 'DRAFT')}
                disabled={updatingStatus}
                className="text-sm border rounded-md px-3 py-1.5 bg-surface-container-lowest text-surface-on focus:ring-2 focus:ring-primary focus:border-primary"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              {updatingStatus && (
                <div className="w-4 h-4 border-2 border-primary-container border-t-primary rounded-full animate-spin" />
              )}
            </div>
            <div className="flex-1" />
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-sm text-red-600 hover:text-red-800 flex items-center gap-1"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                delete
              </span>
              {deleting ? 'Deleting...' : 'Delete Care Plan'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

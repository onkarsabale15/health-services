'use client';

import { useEffect, useState } from 'react';
import { cdsApi } from '@/lib/api';
import type { EncounterSummary, PatientSummary } from '@/types';
import Avatar from '@/components/Avatar';

/** FHIR encounter status → badge class + left-accent color. */
function statusStyle(status: string): { badge: string; label: string; accent: string } {
  const s = status?.toLowerCase();
  if (s === 'in-progress' || s === 'arrived')
    return { badge: 'badge-warning', label: 'In Progress', accent: '#ca8a04' };
  if (s === 'finished' || s === 'completed') return { badge: 'badge-completed', label: 'Completed', accent: '#2563eb' };
  return { badge: 'badge-draft', label: status || 'Scheduled', accent: '#cbd5e1' };
}

/**
 * Step 2 of the system/standalone launch flow: pick the encounter to open the
 * clinical view for. Loads the selected patient's encounters from the session
 * context. Choosing one opens the encounter view; "continue without" opens the
 * patient-level view with no encounter scope.
 */
export default function EncounterSelectStep({
  patient,
  onSelect,
  onBack,
}: {
  patient: PatientSummary;
  onSelect: (encounter: EncounterSummary | null) => void;
  onBack?: () => void;
}) {
  const [encounters, setEncounters] = useState<EncounterSummary[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    cdsApi
      .getEncountersResponse()
      .then(({ data }) => setEncounters(data))
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load encounters');
        setEncounters([]);
      });
  }, []);

  return (
    <div className="max-w-3xl">
      {onBack && (
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-xs text-secondary hover:text-primary mb-5 transition-colors"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
            arrow_back
          </span>
          Back to patient search
        </button>
      )}

      {/* Patient summary strip */}
      <div className="bg-white border border-surface-container rounded-xl px-5 py-4 mb-5 flex items-center gap-4">
        <Avatar name={patient.fullName} size={46} />
        <div className="flex-1">
          <div className="text-base font-bold text-surface-on mb-1">{patient.fullName}</div>
          <div className="flex flex-wrap gap-4">
            {[
              ['MRN', patient.mrn || patient.id],
              ['Age', patient.age != null ? `${patient.age}y ${patient.gender}` : patient.gender],
              ['DOB', patient.birthDate || '—'],
            ].map(([k, v]) => (
              <div key={k}>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{k}</div>
                <div className="text-[13px] font-medium text-surface-on mt-0.5">{v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-bold uppercase tracking-wider text-secondary">Appointments &amp; Encounters</div>
        <button onClick={() => onSelect(null)} className="text-xs text-secondary hover:text-primary transition-colors">
          Continue without encounter →
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 mb-3">{error}</div>
      )}

      {encounters === null ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[78px] rounded-xl bg-surface-container-low animate-pulse" />
          ))}
        </div>
      ) : encounters.length === 0 ? (
        <div className="text-center py-12 text-sm text-secondary">
          No encounters found for this patient.
          <div className="mt-3">
            <button onClick={() => onSelect(null)} className="btn-primary text-sm px-5 py-2 rounded-lg">
              Open clinical view
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {encounters.map((enc) => {
            const st = statusStyle(enc.status);
            const inProgress = st.label === 'In Progress';
            return (
              <button
                key={enc.id}
                onClick={() => onSelect(enc)}
                className="flex items-center gap-3.5 px-5 py-4 bg-white border-[1.5px] border-surface-container rounded-xl text-left transition-all hover:border-primary hover:shadow-[0_4px_16px_rgba(43,91,181,0.09)] w-full"
                style={{ borderLeft: `4px solid ${st.accent}` }}
              >
                <div
                  className={`w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0 ${
                    inProgress ? 'bg-amber-50' : 'bg-surface-container-low'
                  }`}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 18, color: inProgress ? '#ca8a04' : '#2b5bb5' }}
                  >
                    event
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-surface-on">{enc.type || 'Encounter'}</span>
                    <span className={`badge ${st.badge}`}>{st.label}</span>
                  </div>
                  {enc.reasonForVisit && <div className="text-xs text-secondary mb-0.5">{enc.reasonForVisit}</div>}
                  <div className="flex flex-wrap gap-3 text-[11px] text-slate-400">
                    {enc.startDate && <span>{new Date(enc.startDate).toLocaleDateString()}</span>}
                    {(enc.provider || enc.department) && (
                      <span>{[enc.provider, enc.department].filter(Boolean).join(' · ')}</span>
                    )}
                    {enc.appointmentId && <span>ID: {enc.appointmentId}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {inProgress && <span className="text-[11px] font-semibold text-amber-600">Open Now</span>}
                  <span className="material-symbols-outlined text-slate-400" style={{ fontSize: 18 }}>
                    chevron_right
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

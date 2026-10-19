'use client';

import { useCallback, useEffect, useState } from 'react';
import { cdsApi } from '@/lib/api';
import type { PatientSummary } from '@/types';
import Avatar from '@/components/Avatar';

const RECENT_KEY = 'cds:recent-patients';
const MAX_RECENT = 6;

function getRecentPatients(): PatientSummary[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
  } catch {
    return [];
  }
}

function addRecentPatient(patient: PatientSummary) {
  const recent = getRecentPatients().filter((p) => p.id !== patient.id);
  recent.unshift(patient);
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
}

/**
 * Step 1 of the system/standalone launch flow: find a patient by name / DOB /
 * MRN. On select, persists to the recent list and hands the patient up — the
 * parent calls `selectPatient` to set the session's patient context.
 */
export default function PatientSearchStep({ onSelect }: { onSelect: (p: PatientSummary) => Promise<void> }) {
  const [name, setName] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [results, setResults] = useState<PatientSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [recent, setRecent] = useState<PatientSummary[]>([]);

  useEffect(() => setRecent(getRecentPatients()), []);

  const search = useCallback(async () => {
    if (!name && !birthdate && !identifier) return;
    setSearching(true);
    setError('');
    try {
      const patients = await cdsApi.searchPatients({ name, birthdate, identifier });
      setResults(patients);
      setSearched(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  }, [name, birthdate, identifier]);

  const select = async (p: PatientSummary) => {
    setSelecting(p.id);
    setError('');
    try {
      addRecentPatient(p);
      await onSelect(p);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to select patient');
      setSelecting(null);
    }
  };

  const list = searched ? results : recent;
  const inputClass =
    'w-full border-[1.5px] border-surface-container rounded-lg px-3 py-2.5 text-sm text-surface-on bg-white focus:border-primary transition-colors';

  return (
    <div>
      {/* Search bar */}
      <div className="flex flex-wrap items-end gap-3 max-w-3xl mb-5">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[11px] font-semibold text-secondary uppercase tracking-wider mb-1">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && search()}
            placeholder="Last, First or full name"
            autoFocus
            className={inputClass}
          />
        </div>
        <div className="w-36">
          <label className="block text-[11px] font-semibold text-secondary uppercase tracking-wider mb-1">DOB</label>
          <input type="date" value={birthdate} onChange={(e) => setBirthdate(e.target.value)} className={inputClass} />
        </div>
        <div className="w-40">
          <label className="block text-[11px] font-semibold text-secondary uppercase tracking-wider mb-1">MRN</label>
          <input
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && search()}
            placeholder="Identifier"
            className={inputClass}
          />
        </div>
        <button
          onClick={search}
          disabled={searching || (!name && !birthdate && !identifier)}
          className="btn-primary text-sm px-5 py-2.5 rounded-lg flex items-center gap-2 disabled:opacity-50"
        >
          {searching ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              search
            </span>
          )}
          Search
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 mb-4 max-w-3xl">
          {error}
        </div>
      )}

      {searched && results.length === 0 && !searching ? (
        <div className="text-center py-16">
          <span className="material-symbols-outlined text-secondary/40" style={{ fontSize: 40 }}>
            search_off
          </span>
          <p className="text-secondary text-sm mt-2">No patients found. Try a different search.</p>
        </div>
      ) : (
        <>
          {!searched && recent.length > 0 && (
            <div className="text-[11px] font-bold uppercase tracking-wider text-secondary mb-2.5">Recent Patients</div>
          )}
          <div className="flex flex-col gap-2 max-w-3xl">
            {list.map((p) => (
              <button
                key={p.id}
                onClick={() => select(p)}
                disabled={!!selecting}
                className="flex items-center gap-3.5 p-4 bg-white border border-surface-container rounded-xl text-left transition-all hover:border-primary hover:shadow-[0_4px_16px_rgba(43,91,181,0.09)] disabled:opacity-60 w-full"
              >
                <Avatar name={p.fullName} size={42} />
                <div className="flex-1 min-w-0">
                  <div className="text-[15px] font-semibold text-surface-on">{p.fullName}</div>
                  <div className="text-xs text-secondary mt-1">
                    MRN {p.mrn || p.id} · {p.age != null ? `${p.age}y ` : ''}
                    {p.gender} {p.birthDate ? `· DOB ${p.birthDate}` : ''}
                  </div>
                </div>
                <span className="material-symbols-outlined text-slate-400" style={{ fontSize: 18 }}>
                  {selecting === p.id ? 'hourglass_empty' : 'chevron_right'}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

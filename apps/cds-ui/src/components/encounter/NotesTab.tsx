'use client';

import { useState } from 'react';
import type { EncounterSummary } from '@/types';

/**
 * Encounter notes — clinical documentation for the visit. The note editor is a
 * local draft today (no notes write-back endpoint exists yet); Sign/Save are
 * wired once the backend exposes encounter-note persistence.
 */
export default function NotesTab({
  encounter,
  patientName,
}: {
  encounter: EncounterSummary | null;
  patientName: string;
}) {
  const [note, setNote] = useState('');

  const meta: [string, string | undefined][] = [
    ['Encounter', encounter?.appointmentId || encounter?.id],
    ['Provider', encounter?.provider],
    ['Department', encounter?.department],
    ['Reason', encounter?.reasonForVisit],
  ];

  return (
    <div className="max-w-3xl">
      <div className="text-[11px] font-bold uppercase tracking-wider text-secondary mb-4">
        Encounter Notes{encounter?.type ? ` — ${encounter.type}` : ''}
      </div>

      <div className="cds-card p-5">
        <div className="flex flex-wrap gap-x-8 gap-y-3 mb-4 pb-4 border-b border-surface-container">
          {meta.map(([k, v]) => (
            <div key={k}>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">{k}</div>
              <div className="text-[13px] font-medium text-surface-on">{v || '—'}</div>
            </div>
          ))}
        </div>

        <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-secondary mb-2">Clinical Note</div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={`Document findings for ${patientName}${encounter?.type ? `'s ${encounter.type}` : ''}…`}
          rows={8}
          className="w-full px-3.5 py-3 border-[1.5px] border-surface-container rounded-lg text-[13px] text-surface-on bg-surface resize-y leading-relaxed focus:border-primary transition-colors"
        />
        <div className="flex gap-2 mt-3">
          <button
            disabled={!note.trim()}
            onClick={() => alert('Sign Note — encounter-note persistence is not yet available')}
            className="btn-primary text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 disabled:opacity-50"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
              check
            </span>
            Sign Note
          </button>
          <button
            disabled={!note.trim()}
            className="btn-secondary text-xs disabled:opacity-50"
            onClick={() => alert('Save Draft — encounter-note persistence is not yet available')}
          >
            Save Draft
          </button>
        </div>
      </div>
    </div>
  );
}

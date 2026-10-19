'use client';

import { useState } from 'react';
import { useConditions, useMedications, useVitals } from '@/hooks/useResource';

type Section = 'conditions' | 'medications' | 'observations';

const SECTIONS: { id: Section; label: string }[] = [
  { id: 'conditions', label: 'All Conditions' },
  { id: 'medications', label: 'All Medications' },
  { id: 'observations', label: 'All Observations' },
];

const isActive = (status?: string) => status?.toLowerCase() === 'active';

/**
 * Full History tab — active + inactive clinical data. Each section lazily
 * fetches with `includeInactive: true`; inactive/resolved/discontinued entries
 * render dimmed. Mounted only when the tab is open, so the heavier fetch fires
 * on demand.
 */
export default function FullHistoryTab() {
  const [section, setSection] = useState<Section>('conditions');
  const conditions = useConditions({ includeInactive: true });
  const medications = useMedications({ includeInactive: true });
  const vitals = useVitals();

  return (
    <div>
      <div className="flex gap-1 bg-surface-container-low rounded-lg p-1 mb-5 w-fit">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={`px-3.5 py-1.5 rounded-md text-xs transition-all ${
              section === s.id ? 'bg-white text-surface-on font-semibold shadow-sm' : 'text-secondary font-medium'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {section === 'conditions' && (
        <RowList loading={conditions.loading} empty="No conditions on record">
          {(conditions.data ?? []).map((c) => (
            <HistoryRow
              key={c.id}
              icon="clinical_notes"
              active={isActive(c.clinicalStatus)}
              title={c.name}
              statusLabel={isActive(c.clinicalStatus) ? 'Active' : 'Resolved'}
              meta={[
                c.icdCode ? `ICD-10: ${c.icdCode}` : '',
                c.onsetDate ? `Onset: ${c.onsetDate}` : '',
                c.category || '',
              ]}
            />
          ))}
        </RowList>
      )}

      {section === 'medications' && (
        <RowList loading={medications.loading} empty="No medications on record">
          {(medications.data ?? []).map((m) => (
            <HistoryRow
              key={m.id}
              icon="medication"
              active={isActive(m.status)}
              title={m.name}
              statusLabel={isActive(m.status) ? 'Active' : 'Discontinued'}
              meta={[[m.dosage, m.route, m.frequency].filter(Boolean).join(' · '), ...(m.notes ?? [])]}
            />
          ))}
        </RowList>
      )}

      {section === 'observations' && (
        <RowList loading={vitals.loading} empty="No observations on record">
          <div className="cds-card overflow-hidden">
            <div className="grid grid-cols-[1.5fr_1fr_1fr_70px_110px] bg-surface-container-low border-b border-surface-container">
              {['Test', 'Value', 'Reference', 'Flag', 'Date'].map((h) => (
                <div key={h} className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {h}
                </div>
              ))}
            </div>
            {(vitals.data ?? []).map((v) => (
              <div
                key={v.id}
                className="grid grid-cols-[1.5fr_1fr_1fr_70px_110px] border-b border-surface-container/60"
              >
                <div className="px-4 py-2.5 text-[13px] font-medium text-surface-on">{v.name}</div>
                <div
                  className={`px-4 py-2.5 text-[13px] font-bold ${v.isAbnormal ? 'text-red-600' : 'text-surface-on'}`}
                >
                  {v.value}
                  {v.unit ? ` ${v.unit}` : ''}
                </div>
                <div className="px-4 py-2.5 text-[12px] text-secondary">{v.interpretation || '—'}</div>
                <div className="px-4 py-2.5">{v.isAbnormal && <span className="badge badge-critical">!</span>}</div>
                <div className="px-4 py-2.5 text-[12px] text-slate-400">{v.date}</div>
              </div>
            ))}
          </div>
        </RowList>
      )}
    </div>
  );
}

function RowList({ loading, empty, children }: { loading: boolean; empty: string; children: React.ReactNode }) {
  const hasChildren = Array.isArray(children) ? children.flat().some(Boolean) : !!children;
  if (loading)
    return (
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 rounded-xl bg-surface-container-low animate-pulse" />
        ))}
      </div>
    );
  if (!hasChildren) return <div className="text-center py-12 text-sm text-secondary">{empty}</div>;
  return <div className="flex flex-col gap-2">{children}</div>;
}

function HistoryRow({
  icon,
  active,
  title,
  statusLabel,
  meta,
}: {
  icon: string;
  active: boolean;
  title: string;
  statusLabel: string;
  meta: string[];
}) {
  return (
    <div className={`flex items-center gap-3.5 px-4 py-3.5 cds-card ${active ? '' : 'opacity-65'}`}>
      <div
        className={`w-10 h-10 rounded-[9px] flex items-center justify-center shrink-0 ${
          active ? 'bg-primary-container' : 'bg-slate-100'
        }`}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 18, color: active ? '#2b5bb5' : '#94a3b8' }}>
          {icon}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-semibold text-surface-on">{title}</span>
          <span className={`badge ${active ? 'badge-active' : 'badge-completed'}`}>{statusLabel}</span>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-secondary">
          {meta.filter(Boolean).map((m, i) => (
            <span key={i}>{m}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

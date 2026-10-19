'use client';

import type { AllergySummary, ConditionSummary, MedicationSummary, VitalSummary } from '@/types';
import { capitalize, formatSystem, SEVERITY_CLASSES, SEVERITY_FALLBACK_CLASSES } from '@/lib/coding-display';
import { getConditionStateOption } from '@/lib/condition-states';
import ItemMeta from './ItemMeta';

// Compact, click-target-agnostic row components for the four clinical
// resources. Used by both the Clinical Summary 2x2 grid and the per-resource
// detail modal — keeping the markup in one place stops the two surfaces
// from drifting as one or the other gets visual tweaks.
//
// Each row deliberately omits its own click wrapper: callers wrap in a
// `<motion.button>` (grid card) or rely on `<ResourceDetailModal>`'s
// built-in `<button>` row container. Same content, different chrome.

// ─── Conditions ──────────────────────────────────────────────────────────

export function ConditionRow({ condition: c }: { condition: ConditionSummary }) {
  const stateOption = getConditionStateOption(c.stateValue);
  const severityClasses = c.severityLevel ? SEVERITY_CLASSES[c.severityLevel] : SEVERITY_FALLBACK_CLASSES;
  const displayCodings = c.codings?.length ? c.codings : c.icdCode ? [{ system: c.codeSystem, code: c.icdCode }] : [];
  return (
    <div className="flex items-start gap-2">
      <span className={`w-1 self-stretch min-h-[24px] rounded-full shrink-0 ${severityClasses.bar}`} />
      <div className="min-w-0 flex-1 text-left">
        <p className="text-sm font-medium text-surface-on leading-tight">{c.name}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {displayCodings.map((coding) => (
            <span
              key={`${coding.system}-${coding.code}`}
              className="text-[10px] font-mono text-secondary inline-flex items-center gap-1"
            >
              <span className="text-[9px] uppercase tracking-wider text-surface-on-variant">
                {formatSystem(coding.system)}
              </span>
              {coding.code}
            </span>
          ))}
          {c.category && (
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded ${
                c.category === 'encounter-diagnosis' ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-500'
              }`}
            >
              {c.category === 'encounter-diagnosis' ? 'Dx' : 'Problem'}
            </span>
          )}
          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${stateOption.color}`}>{stateOption.label}</span>
          {c.severityLevel && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${severityClasses.badge}`}>
              {capitalize(c.severityLevel)}
            </span>
          )}
        </div>
        <ItemMeta recordedDate={c.recordedDate} lastUpdated={c.lastUpdated} notes={c.notes} />
      </div>
    </div>
  );
}

// ─── Allergies ───────────────────────────────────────────────────────────

export function AllergyRow({ allergy: a }: { allergy: AllergySummary }) {
  return (
    <div className="text-left">
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-sm font-medium text-surface-on">{a.substance}</p>
        {a.criticality && (
          <span
            className={`badge ${
              a.criticality === 'high' ? 'badge-severe' : a.criticality === 'low' ? 'badge-mild' : 'badge-moderate'
            }`}
          >
            {a.criticality}
          </span>
        )}
        {a.clinicalStatus && a.clinicalStatus !== 'active' && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-container-low text-secondary">
            {a.clinicalStatus}
          </span>
        )}
      </div>
      {a.reactions?.length > 0 && (
        <p className="text-[11px] text-secondary mt-0.5">{a.reactions.map((r) => r.manifestation).join(', ')}</p>
      )}
      <ItemMeta recordedDate={a.recordedDate} lastUpdated={a.lastUpdated} notes={a.notes} />
    </div>
  );
}

// ─── Medications ─────────────────────────────────────────────────────────

export function MedicationRow({ medication: m }: { medication: MedicationSummary }) {
  return (
    <div className="flex items-start gap-2 text-left">
      <span className="material-symbols-outlined text-accent shrink-0 mt-0.5" style={{ fontSize: 16 }}>
        medication
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-surface-on leading-tight">{m.name}</p>
          {m.status && m.status !== 'active' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-container-low text-secondary">
              {m.status}
            </span>
          )}
        </div>
        <p className="text-[11px] text-secondary mt-0.5">
          {[m.dosage, m.route, m.frequency].filter(Boolean).join(' · ')}
        </p>
        <ItemMeta recordedDate={m.recordedDate} lastUpdated={m.lastUpdated} notes={m.notes} />
      </div>
    </div>
  );
}

// ─── Vitals (tile shape, not row) ────────────────────────────────────────
//
// Vitals render as compact tiles in the 2x2 grid — different visual
// language from the list rows. Tile-vs-row is a layout concern of the
// caller; this component just renders the tile content.

export function VitalTile({ vital: v }: { vital: VitalSummary }) {
  return (
    <>
      <div className="vital-label">{v.name}</div>
      <div className={`vital-value ${v.isAbnormal ? 'abnormal' : ''}`}>
        {v.value}
        <span className="vital-unit">{v.unit}</span>
      </div>
      {v.date && <div className="text-[10px] text-secondary mt-0.5">{new Date(v.date).toLocaleDateString()}</div>}
      <ItemMeta notes={v.notes} />
    </>
  );
}

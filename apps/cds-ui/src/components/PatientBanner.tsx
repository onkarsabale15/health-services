'use client';

import type { ClinicalData, VitalSummary } from '@/types';

export default function PatientBanner({ data }: { data: ClinicalData }) {
  const pt = data.patient;
  if (!pt) return null;
  const enc = data.encounter;
  const vitals = data.vitals ?? [];
  const allergies = data.allergies ?? [];

  // Pick the four common vitals shown in the topbar quick-strip. If a vital
  // isn't recorded, we just omit its tile — no placeholders.
  const bp = pickVital(vitals, ['blood pressure', '85354', '55284']);
  const hr = pickVital(vitals, ['heart rate', '8867']);
  const spo2 = pickVital(vitals, ['oxygen saturation', 'spo2', '2708', '59408']);
  const temp = pickVital(vitals, ['temperature', '8310']);
  const quickVitals = [
    bp && { label: 'BP', vital: bp },
    hr && { label: 'HR', vital: hr },
    spo2 && { label: 'SpO₂', vital: spo2 },
    temp && { label: 'Temp', vital: temp },
  ].filter(Boolean) as Array<{ label: string; vital: VitalSummary }>;

  // Inline allergy chip — substance names visible at-a-glance next to the
  // patient name. Truncated to the first 3 to keep the header tidy.
  const allergyChipText =
    allergies.length === 0
      ? null
      : allergies
          .slice(0, 3)
          .map((a) => a.substance)
          .join(', ') + (allergies.length > 3 ? ` +${allergies.length - 3}` : '');

  return (
    <div className="cds-card-elevated overflow-hidden">
      <div className="px-6 py-5 flex items-start justify-between gap-6">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0">
            <span className="text-primary font-bold text-lg">
              {pt.firstName?.[0]}
              {pt.lastName?.[0]}
            </span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-surface-on leading-tight">{pt.fullName}</h1>
              {allergyChipText && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                  <span className="material-symbols-outlined" style={{ fontSize: 12 }}>
                    warning
                  </span>
                  {allergyChipText}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-sm text-secondary flex-wrap">
              {pt.age > 0 && <span>{pt.age}yo</span>}
              {pt.gender && (
                <>
                  <span className="text-surface-container-high">·</span>
                  <span className="capitalize">{pt.gender}</span>
                </>
              )}
              {pt.birthDate && (
                <>
                  <span className="text-surface-container-high">·</span>
                  <span>DOB {pt.birthDate}</span>
                </>
              )}
              {pt.mrn && (
                <>
                  <span className="text-surface-container-high">·</span>
                  <span>MRN {pt.mrn}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {quickVitals.length > 0 && (
          <div className="hidden md:flex items-stretch gap-3 shrink-0">
            {quickVitals.map(({ label, vital }) => (
              <VitalChip key={label} label={label} vital={vital} />
            ))}
          </div>
        )}
      </div>

      {enc && (
        <div className="px-6 py-3 bg-surface-container-low/40 border-t border-surface-container-high/30 flex items-center gap-3 text-sm flex-wrap">
          <span className="material-symbols-outlined text-primary" style={{ fontSize: 18 }}>
            event
          </span>
          <span className="font-semibold text-surface-on">{enc.type}</span>
          <span className="badge badge-active">{enc.status}</span>
          {enc.reasonForVisit && <span className="text-secondary">{enc.reasonForVisit}</span>}
          {enc.department && <span className="text-secondary/60">· {enc.department}</span>}
          {enc.provider && <span className="text-secondary/60">· {enc.provider}</span>}
        </div>
      )}
    </div>
  );
}

function VitalChip({ label, vital }: { label: string; vital: VitalSummary }) {
  return (
    <div className="text-center px-3 py-1.5 rounded-lg bg-surface-container-low/60 min-w-[64px]">
      <div className="text-[9px] font-bold uppercase tracking-widest text-secondary">{label}</div>
      <div
        className={`text-sm font-bold leading-tight mt-0.5 ${vital.isAbnormal ? 'text-red-600' : 'text-surface-on'}`}
      >
        {vital.value}
        {vital.unit && <span className="text-[10px] font-normal text-secondary ml-0.5">{vital.unit}</span>}
      </div>
    </div>
  );
}

/** Find a vital by checking name (case-insensitive contains) or code (exact contains) against any of the matchers. */
function pickVital(vitals: VitalSummary[], matchers: string[]): VitalSummary | undefined {
  return vitals.find((v) => {
    const name = (v.name || '').toLowerCase();
    const code = (v.code || '').toLowerCase();
    return matchers.some((m) => name.includes(m) || code.includes(m));
  });
}

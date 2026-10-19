'use client';

import type { AllergySummary, EncounterSummary, PatientSummary, VitalSummary } from '@/types';
import Avatar from '@/components/Avatar';

const MODE_BADGE: Record<string, { label: string; cls: string }> = {
  ehr: { label: 'EHR LAUNCH', cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  standalone: { label: 'STANDALONE', cls: 'bg-violet-500/20 text-violet-300 border-violet-500/30' },
  system: { label: 'SYSTEM LAUNCH', cls: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' },
};

/** Pull a representative vital out of the observation list by name. */
function pickVital(vitals: VitalSummary[], patterns: string[]): VitalSummary | undefined {
  return vitals.find((v) => patterns.some((p) => v.name?.toLowerCase().includes(p)));
}

function VitalCell({ label, vital }: { label: string; vital?: VitalSummary }) {
  if (!vital) return null;
  return (
    <div className="text-center">
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`text-sm font-bold mt-0.5 ${vital.isAbnormal ? 'text-red-300' : 'text-slate-200'}`}>
        {vital.value}
        {vital.unit ? ` ${vital.unit}` : ''}
      </div>
    </div>
  );
}

/**
 * Dark encounter top bar — patient identity + encounter context + vitals +
 * launch-mode badge + pending-recommendation count + End Session. The chrome
 * for the encounter-centric clinical view.
 */
export default function EncounterTopBar({
  patient,
  encounter,
  allergies,
  vitals,
  mode,
  pendingRecs,
  onExit,
}: {
  patient: PatientSummary;
  encounter: EncounterSummary | null;
  allergies: AllergySummary[];
  vitals: VitalSummary[];
  mode: string;
  pendingRecs: number;
  onExit: () => void;
}) {
  const badge = MODE_BADGE[mode] || MODE_BADGE.system;
  const activeAllergies = allergies.filter((a) => a.clinicalStatus?.toLowerCase() === 'active');

  return (
    <div className="bg-slate-900 px-6 shrink-0">
      {/* Brand + exit row */}
      <div className="flex items-center gap-3 py-2.5 border-b border-white/[0.07]">
        <div className="flex items-center gap-2">
          <div className="w-[26px] h-[26px] rounded-md bg-gradient-to-br from-primary to-primary-dim flex items-center justify-center">
            <span className="text-white text-[9px] font-bold">IB</span>
          </div>
          <span className="text-white text-[13px] font-semibold">Health Services CDS</span>
          <span
            className={`text-[10px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded-full border ${badge.cls}`}
          >
            {badge.label}
          </span>
        </div>
        <div className="flex-1" />
        {pendingRecs > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-600/15 border border-red-600/30">
            <span className="material-symbols-outlined text-red-300" style={{ fontSize: 13 }}>
              warning
            </span>
            <span className="text-[11px] font-semibold text-red-300">
              {pendingRecs} pending recommendation{pendingRecs > 1 ? 's' : ''}
            </span>
          </div>
        )}
        <button
          onClick={onExit}
          className="flex items-center gap-1.5 text-xs text-slate-400 px-2.5 py-1.5 rounded-md border border-slate-800 hover:bg-slate-800 hover:text-slate-300 transition-colors"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
            close
          </span>
          End Session
        </button>
      </div>

      {/* Patient + encounter banner */}
      <div className="py-3 flex items-center gap-5 flex-wrap">
        <div className="flex items-center gap-3">
          <Avatar name={patient.fullName} size={44} />
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[17px] font-bold text-white">{patient.fullName}</span>
              {activeAllergies.length > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-600/20 text-red-300 border border-red-600/30">
                  ⚠ {activeAllergies.map((a) => a.substance).join(', ')}
                </span>
              )}
            </div>
            <div className="flex gap-3.5 flex-wrap">
              {[
                ['MRN', patient.mrn || patient.id],
                ['Age', patient.age != null ? `${patient.age}y ${patient.gender}` : patient.gender],
                ['DOB', patient.birthDate || '—'],
              ].map(([k, v]) => (
                <div key={k}>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k} </span>
                  <span className="text-xs font-medium text-slate-400">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {encounter && (
          <>
            <div className="w-px h-10 bg-white/[0.08]" />
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-blue-300" style={{ fontSize: 17 }}>
                  event
                </span>
              </div>
              <div>
                <div className="text-[13px] font-semibold text-white mb-0.5">{encounter.type || 'Encounter'}</div>
                <div className="text-[11px] text-slate-500">
                  {[
                    encounter.startDate ? new Date(encounter.startDate).toLocaleDateString() : null,
                    encounter.provider,
                    encounter.department,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </div>
            </div>
          </>
        )}

        <div className="flex-1" />

        {vitals.length > 0 && (
          <div className="flex gap-3">
            <VitalCell label="BP" vital={pickVital(vitals, ['blood pressure', 'systolic'])} />
            <VitalCell label="HR" vital={pickVital(vitals, ['heart rate', 'pulse'])} />
            <VitalCell label="SpO₂" vital={pickVital(vitals, ['oxygen', 'spo2', 'saturation'])} />
            <VitalCell label="Temp" vital={pickVital(vitals, ['temperature', 'temp'])} />
          </div>
        )}
      </div>
    </div>
  );
}

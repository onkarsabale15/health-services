/**
 * Dark workflow sidebar for the system / standalone launch selection flow
 * (Find Patient → Select Encounter → Clinical View). Shared by the patient
 * search and context-picker screens.
 */
const STEPS = [
  { id: 'patient', label: 'Find Patient' },
  { id: 'encounter', label: 'Select Encounter' },
  { id: 'clinical', label: 'Clinical View' },
] as const;

export type WorkflowStep = (typeof STEPS)[number]['id'];

export default function WorkflowSidebar({ active, mode }: { active: WorkflowStep; mode?: string }) {
  const activeIndex = STEPS.findIndex((s) => s.id === active);

  return (
    <div className="hidden md:flex w-[220px] shrink-0 bg-slate-900 flex-col px-4 py-5">
      {/* Brand */}
      <div className="flex items-center gap-2.5 mb-8">
        <div className="w-[30px] h-[30px] rounded-[7px] bg-gradient-to-br from-primary to-primary-dim flex items-center justify-center">
          <span className="text-white text-[11px] font-bold">IB</span>
        </div>
        <div>
          <div className="text-white font-semibold text-[13px]">Health Services</div>
          <div className="text-slate-500 text-[10px] tracking-[0.08em] uppercase">
            CDS · {mode === 'system' ? 'System' : 'Standalone'}
          </div>
        </div>
      </div>

      <div className="text-[10px] font-bold tracking-[0.1em] uppercase text-slate-500 mb-2">Workflow</div>
      {STEPS.map((s, i) => {
        const on = s.id === active;
        const done = activeIndex > i;
        return (
          <div
            key={s.id}
            className={`flex items-center gap-2 px-2.5 py-2 rounded-md mb-0.5 ${on ? 'bg-primary/20' : ''}`}
          >
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                on ? 'bg-primary' : done ? 'bg-primary/40' : 'bg-white/10'
              }`}
            >
              <span className="text-white text-[9px] font-bold">{i + 1}</span>
            </div>
            <span
              className={`text-xs ${on ? 'text-blue-300 font-semibold' : done ? 'text-slate-400' : 'text-slate-500'}`}
            >
              {s.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

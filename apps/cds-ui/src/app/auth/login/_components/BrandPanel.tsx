/**
 * Dark brand panel shown on the left of the CDS launch screen.
 * Static marketing/identity content — no state, no data.
 */
const FEATURES = [
  { icon: 'hub', label: 'SMART on FHIR Launch', sub: 'EHR injects patient + encounter context automatically' },
  { icon: 'psychology', label: 'AI Recommendations', sub: 'Evidence-based, encounter-specific clinical cards' },
  {
    icon: 'medical_services',
    label: 'Encounter-centric view',
    sub: 'Summary, conditions, labs — all scoped to this visit',
  },
];

export default function BrandPanel() {
  return (
    <div className="hidden md:flex w-[400px] shrink-0 bg-slate-900 flex-col p-11">
      {/* Logo */}
      <div className="flex items-center gap-2.5 mb-[52px]">
        <div className="w-9 h-9 rounded-[9px] bg-gradient-to-br from-primary to-primary-dim flex items-center justify-center">
          <span className="text-white text-[13px] font-bold">IB</span>
        </div>
        <div>
          <div className="text-white font-bold text-[15px]">Health Services CDS</div>
          <div className="text-slate-500 text-[10px] tracking-[0.1em] uppercase">Clinical Decision Support</div>
        </div>
      </div>

      {/* Pitch */}
      <div className="flex-1 flex flex-col justify-center">
        <div className="text-2xl font-bold text-white leading-tight mb-3.5">
          AI-powered decisions at the point of care.
        </div>
        <div className="text-slate-400 text-[13px] leading-relaxed mb-9">
          Real-time clinical recommendations triggered by your EHR encounter — no extra clicks, no context switching.
        </div>
        <div className="flex flex-col gap-3.5">
          {FEATURES.map((f) => (
            <div key={f.label} className="flex items-start gap-3">
              <div className="w-[30px] h-[30px] rounded-[7px] bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                <span className="material-symbols-outlined text-blue-300" style={{ fontSize: 15 }}>
                  {f.icon}
                </span>
              </div>
              <div>
                <div className="text-white text-[13px] font-medium">{f.label}</div>
                <div className="text-slate-500 text-[11px] mt-0.5 leading-snug">{f.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="text-slate-600 text-[10px] tracking-wide">HIPAA · FHIR R4 · CDS Hooks 1.0 · OAuth 2.0</div>
    </div>
  );
}

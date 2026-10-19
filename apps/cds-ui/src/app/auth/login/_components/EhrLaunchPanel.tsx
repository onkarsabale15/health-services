'use client';

import { motion } from 'framer-motion';
import { fadeIn } from '@/lib/motion';

/**
 * EHR (SMART on FHIR) launch tab.
 *
 * Standalone provider launch is TEMPORARILY DISABLED: it depends on cds-app
 * forwarding a tenant-specific `iss` to the bridge, which isn't resolved yet
 * for this app's Cerner config (the bridge returns "iss query parameter is
 * required"). Until that's wired (cds-app `standaloneEntry` ISS fallback, or a
 * `baseUrl` override on the integration), EHR launch is EHR-initiated only.
 *
 * To re-enable, uncomment the standalone picker block below. It redirects to
 * cds-app (NOT the cds-ui origin) since `/launch/*` is excluded from `/api`.
 */
export default function EhrLaunchPanel() {
  return (
    <motion.div variants={fadeIn} initial="hidden" animate="visible">
      <div className="px-3.5 py-2.5 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2">
        <span className="material-symbols-outlined text-emerald-600 shrink-0 mt-0.5" style={{ fontSize: 14 }}>
          verified
        </span>
        <div className="text-[11px] text-emerald-800 leading-relaxed">
          Launch Health Services CDS from within your EHR — patient and encounter context is injected automatically via
          SMART on FHIR. For manual access, use System Launch.
        </div>
      </div>

      {/* ── Standalone launch picker (disabled — pending cds-app `iss` resolution) ──
      const CDS_API_URL = process.env.NEXT_PUBLIC_CDS_API_URL || 'http://localhost:3003';
      const STANDALONE_EHRS: { ehrName: string; label: string }[] = [
        { ehrName: 'cerner', label: 'Cerner (Oracle Health)' },
      ];
      const [launching, setLaunching] = useState<string | null>(null);
      const launch = (ehrName: string) => {
        setLaunching(ehrName);
        window.location.href = `${CDS_API_URL}/launch/standalone/${ehrName}`;
      };

      <div className="text-xs text-secondary mb-2.5 font-medium">Select your EHR system</div>
      <div className="flex flex-col gap-2">
        {STANDALONE_EHRS.map((ehr) => (
          <button
            key={ehr.ehrName}
            onClick={() => launch(ehr.ehrName)}
            className="flex items-center gap-3 p-4 border-[1.5px] border-surface-container rounded-[10px] bg-white text-left transition-all hover:border-primary hover:shadow-glow"
          >
            <div className="w-9 h-9 rounded-lg bg-surface-container-low flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-primary" style={{ fontSize: 17 }}>monitor_heart</span>
            </div>
            <div className="flex-1">
              <div className="text-[13px] font-semibold text-surface-on">{ehr.label}</div>
              <div className="text-[11px] text-secondary mt-0.5">SMART on FHIR · Provider Launch</div>
            </div>
            <span className="material-symbols-outlined text-slate-400" style={{ fontSize: 16 }}>chevron_right</span>
          </button>
        ))}
      </div>
      ──────────────────────────────────────────────────────────────────────────── */}
    </motion.div>
  );
}

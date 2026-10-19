'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { fadeInUp } from '@/lib/motion';
import BrandPanel from './_components/BrandPanel';
import EhrLaunchPanel from './_components/EhrLaunchPanel';
import SystemLaunchPanel from './_components/SystemLaunchPanel';

type Mode = 'ehr' | 'system';

const TABS: { id: Mode; label: string; icon: string }[] = [
  { id: 'ehr', label: 'EHR Launch', icon: 'hub' },
  { id: 'system', label: 'System Launch', icon: 'monitor' },
];

/**
 * CDS launch screen — the unauthenticated entry point. Two modes:
 * - EHR Launch: SMART on FHIR / standalone launch (EHR injects context).
 * - System Launch: emailed one-time-code sign-in → patient search.
 */
export default function LaunchPage() {
  const [mode, setMode] = useState<Mode>('ehr');

  return (
    <div className="flex h-screen bg-surface">
      <BrandPanel />

      <div className="flex-1 flex items-center justify-center p-6 md:p-12">
        <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="w-full max-w-[400px]">
          <div className="mb-7">
            <h1 className="text-[22px] font-bold text-surface-on mb-1">Sign in to CDS</h1>
            <p className="text-sm text-secondary">Choose your launch mode</p>
          </div>

          {/* Mode toggle */}
          <div className="flex bg-surface-container-low rounded-lg p-1 mb-7 gap-1">
            {TABS.map((t) => {
              const on = mode === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setMode(t.id)}
                  className={`flex-1 py-2.5 rounded-md text-sm flex items-center justify-center gap-1.5 transition-all ${
                    on ? 'bg-white text-surface-on font-semibold shadow-sm' : 'text-secondary font-medium'
                  }`}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 16, color: on ? '#2b5bb5' : '#94a3b8' }}
                  >
                    {t.icon}
                  </span>
                  {t.label}
                </button>
              );
            })}
          </div>

          {mode === 'ehr' ? <EhrLaunchPanel /> : <SystemLaunchPanel />}
        </motion.div>
      </div>
    </div>
  );
}

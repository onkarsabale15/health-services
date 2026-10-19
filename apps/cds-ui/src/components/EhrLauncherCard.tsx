'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Monitor, Laptop, ExternalLink, ChevronRight, Check, X, Loader2 } from 'lucide-react';
import { fadeInUp } from '@/lib/motion';

interface EhrMode {
  appType: string;
  integrationId: string;
  sites: Array<{ id: string; name: string; isDefault: boolean }>;
}

interface Props {
  ehrName: string;
  label: string;
  modes: EhrMode[];
  capabilities: Record<string, Record<string, boolean>>;
  carePlan: Record<string, { feasible: boolean; missingRequired: string[]; missingOptional: string[] }>;
  onModeClick: (ehrName: string, appType: string) => void;
}

const MODE_META: Record<
  string,
  { icon: typeof Monitor; label: string; description: string; color: string; bg: string }
> = {
  system: {
    icon: Monitor,
    label: 'System Access',
    description: 'Browse patients across the practice',
    color: 'text-mode-system',
    bg: 'bg-cyan-50',
  },
  'provider-standalone': {
    icon: Laptop,
    label: 'Standalone Launch',
    description: 'Full clinical session with EHR auth',
    color: 'text-mode-standalone',
    bg: 'bg-violet-50',
  },
  'provider-ehr': {
    icon: ExternalLink,
    label: 'EHR Launch',
    description: 'Launched from within the EHR',
    color: 'text-mode-ehr',
    bg: 'bg-green-50',
  },
};

const EHR_GRADIENTS: Record<string, string> = {
  cerner: 'from-red-500 to-orange-500',
  epic: 'from-blue-600 to-indigo-600',
  athenanet: 'from-purple-500 to-pink-500',
  eclinicalworks: 'from-emerald-500 to-teal-500',
  nextgen: 'from-sky-500 to-blue-500',
  drchrono: 'from-amber-500 to-orange-500',
  elation: 'from-indigo-500 to-purple-500',
  meditech: 'from-slate-500 to-gray-600',
  greenways: 'from-green-500 to-emerald-600',
};

export function EhrLauncherCard({ ehrName, label, modes, capabilities, carePlan, onModeClick }: Props) {
  const [launchingMode, setLaunchingMode] = useState<string | null>(null);
  const gradient = EHR_GRADIENTS[ehrName] || 'from-primary to-primary-dim';

  const handleClick = (appType: string) => {
    if (appType === 'provider-ehr') return; // not clickable — deep-link only
    setLaunchingMode(appType);
    onModeClick(ehrName, appType);
  };

  // Merge all capabilities across modes for the summary row
  const mergedCaps = Object.values(capabilities).reduce(
    (acc, c) => ({
      conditions: acc.conditions || c.conditions,
      allergies: acc.allergies || c.allergies,
      vitals: acc.vitals || c.vitals,
      encounters: acc.encounters || c.encounters,
    }),
    { conditions: false, allergies: false, vitals: false, encounters: false },
  );

  return (
    <motion.div
      variants={fadeInUp}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="cds-card-elevated rounded-2xl overflow-hidden group"
    >
      {/* Top accent bar */}
      <div
        className={`h-1 bg-gradient-to-r ${gradient} scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-500`}
      />

      <div className="p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div
            className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-bold text-sm`}
          >
            {ehrName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="text-base font-bold text-surface-on leading-tight">{label}</h3>
            <p className="text-[11px] text-secondary">
              {modes.length} mode{modes.length !== 1 ? 's' : ''} configured
            </p>
          </div>
        </div>

        {/* Mode buttons */}
        <div className="space-y-2 mb-5">
          {modes.map((mode) => {
            const meta = MODE_META[mode.appType] || MODE_META.system;
            const Icon = meta.icon;
            const isEhrLaunch = mode.appType === 'provider-ehr';
            const isLaunching = launchingMode === mode.appType;

            return (
              <motion.button
                key={mode.appType}
                whileTap={isEhrLaunch ? {} : { scale: 0.98 }}
                onClick={() => handleClick(mode.appType)}
                disabled={isEhrLaunch || isLaunching}
                className={`
                  w-full flex items-center gap-3 p-3 rounded-xl border-2 border-transparent
                  transition-all duration-200
                  ${
                    isEhrLaunch
                      ? 'opacity-50 cursor-not-allowed bg-surface-container-low'
                      : `${meta.bg} hover:border-primary/30 cursor-pointer`
                  }
                `}
              >
                <div className={`w-9 h-9 rounded-lg ${meta.bg} flex items-center justify-center ${meta.color}`}>
                  <Icon size={18} />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-semibold text-surface-on">{meta.label}</p>
                  <p className="text-[11px] text-secondary leading-tight">{meta.description}</p>
                </div>
                <div className={`${meta.color} transition-transform group-hover/btn:translate-x-0.5`}>
                  {isLaunching ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : isEhrLaunch ? (
                    <span className="text-[10px] font-medium text-secondary">via EHR</span>
                  ) : (
                    <ChevronRight size={16} />
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Capability pills */}
        <div className="bg-surface-container-low/60 rounded-xl p-3 -mx-1">
          <p className="text-[10px] uppercase tracking-widest font-bold text-secondary mb-2">Capabilities</p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            <CapPill label="Conditions" supported={mergedCaps.conditions} />
            <CapPill label="Allergies" supported={mergedCaps.allergies} />
            <CapPill label="Observations" supported={mergedCaps.vitals} />
            <CapPill label="Encounters" supported={mergedCaps.encounters} />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function CapPill({ label, supported }: { label: string; supported: boolean }) {
  return (
    <div className={`flex items-center gap-1.5 text-xs ${supported ? 'text-success' : 'text-secondary/50'}`}>
      {supported ? <Check size={12} /> : <X size={12} />}
      <span className={supported ? '' : 'line-through'}>{label}</span>
    </div>
  );
}

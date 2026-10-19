'use client';

import { useSession } from '@/hooks/useSession';

const MODE_CONFIG = {
  ehr: { label: 'EHR Launch', dotClass: 'bg-mode-ehr', bgClass: 'bg-green-50 border-green-200 text-green-800' },
  standalone: {
    label: 'Standalone',
    dotClass: 'bg-mode-standalone',
    bgClass: 'bg-violet-50 border-violet-200 text-violet-800',
  },
  system: { label: 'System', dotClass: 'bg-mode-system', bgClass: 'bg-cyan-50 border-cyan-200 text-cyan-800' },
} as const;

export function ModeBadge() {
  const { session, loading } = useSession();

  if (loading || !session) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-semibold uppercase tracking-wider bg-surface-container-low border-surface-container-high text-secondary animate-pulse">
        Loading...
      </span>
    );
  }

  const config = MODE_CONFIG[session.launchMode] ?? MODE_CONFIG.system;
  const ehrLabel = session.ehrName.charAt(0).toUpperCase() + session.ehrName.slice(1);
  const providerName = session.provider?.name;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-semibold uppercase tracking-wider transition-colors ${config.bgClass}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full animate-pulse-subtle ${config.dotClass}`} />
      {config.label} · {ehrLabel}
      {providerName && ` · ${providerName}`}
    </span>
  );
}

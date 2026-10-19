'use client';

import { ArrowRightCircle } from 'lucide-react';
import { useSession } from '@/hooks/useSession';

// ─── SwitchToProviderButton ─────────────────────────────────────────────────
//
// In system mode, surfaces a one-click affordance to launch a provider-
// standalone SMART flow against the same EHR. Useful when a provider
// finds a patient via system-mode search and wants to escalate into
// authenticated provider context for clinical writes.
//
// Hidden outside system mode. Linking to `/launch/standalone/{ehrName}`
// matches the launcher page pattern; if the EHR doesn't support a
// standalone configuration, the cds-app endpoint will surface the
// failure — the FE deliberately does not duplicate that capability
// check (single source of truth lives on the BE).

export function SwitchToProviderButton() {
  const { session } = useSession();

  if (!session || session.launchMode !== 'system') return null;

  const href = `/launch/standalone/${session.ehrName}`;

  return (
    <a
      href={href}
      title={`Re-authenticate against ${session.ehrName} as a provider for clinical writes`}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-semibold uppercase tracking-wider bg-white border-primary/40 text-primary hover:bg-primary/[0.04] transition-colors"
    >
      <ArrowRightCircle size={12} />
      Switch to Provider Launch
    </a>
  );
}

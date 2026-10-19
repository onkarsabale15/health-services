'use client';

import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import type { ResourceCapabilities } from '@/lib/capabilities.types';

interface Props {
  /**
   * The action gate. Pass the relevant flag from the per-resource envelope
   * (`useConditions().capabilities?.allowAdd`, etc.). `undefined` means the
   * resource list hasn't loaded yet — render nothing rather than flash an
   * enabled button that turns out to be unsupported.
   */
  allow: boolean | undefined;
  /** Optional richer capability — read for context-specific extras like categories. */
  capabilities?: ResourceCapabilities | null;
  onClick: () => void;
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
}

/**
 * Renders a button only when the parent has loaded the per-resource
 * envelope AND the action is supported. Unsupported / loading → render
 * nothing. Capability flags come from the response envelope of the data
 * the button acts on (e.g., the conditions list response for an
 * "Add Condition" button) — never from a session-wide capability bundle.
 *
 * `capabilities` is accepted for parity with future call sites that want
 * to reach into `extras` or `categories`; today only `allow` is consumed.
 */
export function CapabilityGatedButton({ allow, onClick, children, icon, className = '' }: Props) {
  if (!allow) return null;

  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={`
        inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold
        transition-all duration-150
        bg-white text-surface-on border border-surface-container-high
        hover:border-primary hover:text-primary hover:shadow-sm active:scale-[0.98]
        ${className}
      `}
    >
      {icon && <span className="text-[18px] opacity-70">{icon}</span>}
      {children}
    </motion.button>
  );
}

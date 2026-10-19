'use client';

import { motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { fadeInDown } from '@/lib/motion';

// ─── PartialDataBanner ──────────────────────────────────────────────────────
//
// Surfaces a soft warning when the patient page has loaded SOME clinical
// resources but not others (e.g. EHR is read-only for one section, or a
// vendor endpoint returned 4xx for that resource). The AI care plan tab
// uses this to disclose that the analysis it's about to generate is
// based on partial data — not silently miss conditions/allergies/etc.
//
// Hidden when:
//   - everything loaded successfully (sections array is empty), or
//   - nothing loaded at all (caller should show its own full-error state).

/** Sections the banner knows how to label. Keep in sync with `usePatientBannerData()`'s exposed resource hooks. */
export type ClinicalSectionLabel = 'conditions' | 'allergies' | 'medications' | 'vitals';

export interface MissingSection {
  label: ClinicalSectionLabel;
  /** Optional reason from the failed hook (`useResource.error`). */
  reason?: string | null;
}

interface Props {
  /** Sections that failed to load. Empty array → banner not rendered. */
  missing: MissingSection[];
}

export function PartialDataBanner({ missing }: Props) {
  if (missing.length === 0) return null;

  const items = missing.map((s) => s.label).join(', ');
  // Surface the first reason as a hint; deeper context is in dev console / Sentry.
  const firstReason = missing.find((s) => s.reason)?.reason;

  return (
    <motion.div
      variants={fadeInDown}
      initial="hidden"
      animate="visible"
      className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 flex items-start gap-3"
      role="status"
      aria-live="polite"
    >
      <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
      <div className="space-y-0.5">
        <p className="text-sm font-semibold text-amber-900">Some clinical data couldn&apos;t be loaded</p>
        <p className="text-xs text-amber-800">
          The analysis below is based on partial data. Missing: <span className="font-medium">{items}</span>.
          {firstReason && <span className="text-amber-700/80"> ({firstReason})</span>}
        </p>
      </div>
    </motion.div>
  );
}

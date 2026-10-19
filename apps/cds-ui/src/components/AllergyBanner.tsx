'use client';

import type { AllergySummary } from '@/types';

/**
 * Clinical-safety banner shown above the 2×2 patient grid.
 *
 * - No allergies recorded → green NKDA pill (positive confirmation)
 * - Has allergies → red banner listing substances by criticality
 *
 * Loading state intentionally renders nothing — a skeleton would steal
 * attention from real safety data.
 */
export default function AllergyBanner({ allergies }: { allergies: AllergySummary[] | null }) {
  if (allergies === null) return null;

  if (allergies.length === 0) {
    return (
      <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
        <span className="material-symbols-outlined text-emerald-600" style={{ fontSize: 18 }}>
          verified
        </span>
        <span className="text-xs font-bold uppercase tracking-widest text-emerald-700">
          No Known Drug Allergies (NKDA)
        </span>
      </div>
    );
  }

  // Sort high-criticality first so the most dangerous appears first in the inline list.
  const sorted = [...allergies].sort((a, b) => criticalityWeight(b.criticality) - criticalityWeight(a.criticality));
  const labels = sorted.map((a) => a.substance);

  return (
    <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg bg-red-50 border border-red-200">
      <span className="material-symbols-outlined text-red-600" style={{ fontSize: 18 }}>
        warning
      </span>
      <span className="text-xs font-bold uppercase tracking-widest text-red-700 shrink-0">Allergies:</span>
      <span className="text-xs text-red-700 font-medium truncate">{labels.join(' · ')}</span>
    </div>
  );
}

function criticalityWeight(c: string | undefined): number {
  switch (c) {
    case 'high':
      return 3;
    case 'low':
      return 1;
    case 'unable-to-assess':
      return 2;
    default:
      return 0;
  }
}

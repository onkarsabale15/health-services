import type { CdsCard } from '@/types';

// ── Severity ────────────────────────────────────────────────

export const SEVERITY_ORDER: Record<CdsCard['severity'], number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

export const SEVERITY_STYLES: Record<CdsCard['severity'], { border: string; badge: string }> = {
  critical: { border: 'border-l-4 border-l-red-500', badge: 'badge-critical' },
  warning: { border: 'border-l-4 border-l-amber-500', badge: 'badge-warning' },
  info: { border: 'border-l-4 border-l-blue-500', badge: 'badge-info' },
};

// ── Category ────────────────────────────────────────────────

export const CATEGORY_LABELS: Record<CdsCard['category'], string> = {
  'pcp-suggestion': 'PCP Suggestion',
  'allergy-caution': 'Allergy Caution',
  'drug-interaction': 'Drug Interaction',
  'missing-screening': 'Missing Screening',
  'care-gap': 'Care Gap',
  'patient-safety': 'Patient Safety',
};

export const CATEGORY_OPTIONS: CdsCard['category'][] = [
  'pcp-suggestion',
  'allergy-caution',
  'drug-interaction',
  'missing-screening',
  'care-gap',
  'patient-safety',
];

export const SEVERITY_OPTIONS: CdsCard['severity'][] = ['critical', 'warning', 'info'];

// ── Care Plan Status ────────────────────────────────────────

export const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'badge-draft',
  ACTIVE: 'badge-active',
  COMPLETED: 'badge-completed',
  REVOKED: 'badge-critical',
};

export const STATUS_OPTIONS = ['DRAFT', 'ACTIVE', 'COMPLETED', 'REVOKED'] as const;

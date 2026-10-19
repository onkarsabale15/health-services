/**
 * Short human-readable label for a FHIR code system URI. Used to render
 * compact coding badges in lists/detail views (`ICD-10  E13.51`,
 * `SNOMED  74188005`).
 */
const SYSTEM_LABELS: Array<{ match: RegExp; label: string }> = [
  { match: /snomed/i, label: 'SNOMED' },
  { match: /icd-10-cm|icd10cm/i, label: 'ICD-10-CM' },
  { match: /icd-10|icd10/i, label: 'ICD-10' },
  { match: /loinc/i, label: 'LOINC' },
  { match: /rxnorm/i, label: 'RxNorm' },
  { match: /cpt/i, label: 'CPT' },
];

export function formatSystem(systemUri: string | undefined): string {
  if (!systemUri) return '';
  const hit = SYSTEM_LABELS.find((s) => s.match.test(systemUri));
  if (hit) return hit.label;
  // Fall back to the last path segment so unknown systems are at least readable.
  return systemUri.split('/').pop() || systemUri;
}

/**
 * Normalize a free-form severity display ("Moderate", "SEVERE", "mild ", etc.)
 * to the canonical lowercase enum the form + row use. Returns `null` for
 * unrecognized / empty input so callers can leave the field unset cleanly.
 *
 * Note: when the data comes from `ConditionSummary` the BE has already
 * normalized this into `severityLevel` — prefer that field. Use this helper
 * only when normalizing user-typed input or other ad-hoc strings.
 */
export function severityToLevel(display: string | null | undefined): 'mild' | 'moderate' | 'severe' | null {
  if (!display) return null;
  const normalized = display.trim().toLowerCase();
  if (normalized === 'mild' || normalized === 'moderate' || normalized === 'severe') return normalized;
  return null;
}

/** Capitalize the first letter — used by display labels for normalized enums. */
export function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Tailwind class triples for severity rendering. One source of truth so the
 * row's left bar and the badge in row + detail modal stay in sync.
 */
export const SEVERITY_CLASSES: Record<'mild' | 'moderate' | 'severe', { bar: string; badge: string }> = {
  severe: { bar: 'bg-red-400', badge: 'bg-red-50 text-red-700' },
  moderate: { bar: 'bg-amber-400', badge: 'bg-amber-50 text-amber-700' },
  mild: { bar: 'bg-gray-300', badge: 'bg-gray-50 text-gray-600' },
};
export const SEVERITY_FALLBACK_CLASSES = { bar: 'bg-gray-300', badge: 'bg-gray-50 text-gray-600' };

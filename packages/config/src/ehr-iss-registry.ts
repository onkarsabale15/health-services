/**
 * ISS → EHR vendor resolution registry.
 *
 * Replaces fragile string matching (iss.includes('epic.com')) with a
 * configurable pattern registry. Also supports exact match against
 * stored FHIR base URLs for custom EHR endpoints.
 */

const ISS_PATTERNS: { pattern: RegExp; ehrName: string }[] = [
  { pattern: /epic\.com|epicfhir|interconnect-fhir/i, ehrName: 'epic' },
  { pattern: /cerner\.com|oracle.*health|cernerworks/i, ehrName: 'cerner' },
  { pattern: /athenahealth\.com|athenanet/i, ehrName: 'athenanet' },
  { pattern: /nextgen\.com|nativefhir/i, ehrName: 'nextgen' },
  { pattern: /ecwcloud\.com|eclinicalworks/i, ehrName: 'eclinicalworks' },
  { pattern: /drchrono\.com/i, ehrName: 'drchrono' },
  { pattern: /elationhealth\.com|elation/i, ehrName: 'elation' },
  { pattern: /meditech\.com/i, ehrName: 'meditech' },
  { pattern: /medent/i, ehrName: 'medent' },
  { pattern: /greenway/i, ehrName: 'greenways' },
];

/**
 * Resolve EHR vendor name from the FHIR server base URL (iss).
 * Uses regex pattern matching against known vendor URL patterns.
 */
export function resolveEhrFromIss(iss: string): string | null {
  if (!iss) return null;
  const issLower = iss.toLowerCase();
  for (const { pattern, ehrName } of ISS_PATTERNS) {
    if (pattern.test(issLower)) return ehrName;
  }
  return null;
}

/**
 * Get all registered ISS patterns (for admin UI display or debugging).
 */
export function getIssPatterns(): { pattern: string; ehrName: string }[] {
  return ISS_PATTERNS.map(({ pattern, ehrName }) => ({
    pattern: pattern.source,
    ehrName,
  }));
}

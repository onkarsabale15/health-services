// ─── Clinical-Write FHIR Codings ─────────────────────────────────────────────
//
// All FHIR system URIs and domain-specific code values used by the
// clinical-write module live here. This file is the SINGLE SOURCE OF TRUTH
// for FHIR URIs on the CDS side — controllers, builders, and validators
// must never hardcode URI strings.
//
// Parallel file on the bridge side:
//   apps/bridge-api/src/modules/fhir/constants/code-systems.ts
// Both files reference the same HL7 standard URIs and must stay in sync.

// ── Clinical vocabularies ───────────────────────────────────────────────

export const CLINICAL_VOCABULARIES = {
  SNOMED: 'http://snomed.info/sct',
  ICD10: 'http://hl7.org/fhir/sid/icd-10',
  ICD10_CM: 'http://hl7.org/fhir/sid/icd-10-cm',
  ICD9: 'http://hl7.org/fhir/sid/icd-9',
  ICD9_CM: 'http://hl7.org/fhir/sid/icd-9-cm',
  LOINC: 'http://loinc.org',
  RXNORM: 'http://www.nlm.nih.gov/research/umls/rxnorm',
} as const;

// ── Condition status value sets ─────────────────────────────────────────

export const STATUS_SYSTEMS = {
  CONDITION_CLINICAL: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
  CONDITION_VERIFICATION: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
  CONDITION_CATEGORY: 'http://terminology.hl7.org/CodeSystem/condition-category',
} as const;

// ── Condition category value set ─────────────────────────────────────────

export const CONDITION_CATEGORY_CODES = {
  'problem-list-item': { code: 'problem-list-item', display: 'Problem List Item' },
  'encounter-diagnosis': { code: 'encounter-diagnosis', display: 'Encounter Diagnosis' },
  'health-concern': { code: 'health-concern', display: 'Health Concern' },
} as const;

export type ConditionCategory = keyof typeof CONDITION_CATEGORY_CODES;

/**
 * Build a FHIR `CodeableConcept` for a Condition category code.
 *
 * No default: callers must pass a category. Hardcoding `problem-list-item`
 * silently produced EHR-rejected bodies on Epic (which only allows
 * `encounter-diagnosis`); pushing the requirement up to the controller +
 * DTO surfaces the misconfiguration as a 400 instead of a vendor 422.
 */
export function buildCategoryCoding(category: ConditionCategory): {
  coding: Array<{ system: string; code: string; display: string }>;
} {
  const entry = CONDITION_CATEGORY_CODES[category];
  return {
    coding: [
      {
        system: STATUS_SYSTEMS.CONDITION_CATEGORY,
        code: entry.code,
        display: entry.display,
      },
    ],
  };
}

// ── Condition severity (SNOMED coded values per HL7 recommendation) ─────

export const SEVERITY_CODES = {
  mild: { code: '255604002', display: 'Mild' },
  moderate: { code: '6736007', display: 'Moderate' },
  severe: { code: '24484000', display: 'Severe' },
} as const;

export type SeverityLevel = keyof typeof SEVERITY_CODES;

/**
 * Build a FHIR `CodeableConcept` for a severity level. Returns `null` when
 * the level is empty so callers can omit the field entirely rather than
 * sending an empty coding. Includes top-level `text` for EHRs that prefer
 * the human-readable fallback over decoding SNOMED.
 */
export function buildSeverityCoding(
  level: SeverityLevel | '' | undefined,
): { coding: Array<{ system: string; code: string; display: string }>; text: string } | null {
  if (!level) return null;
  const entry = SEVERITY_CODES[level];
  return {
    coding: [
      {
        system: CLINICAL_VOCABULARIES.SNOMED,
        code: entry.code,
        display: entry.display,
      },
    ],
    text: entry.display,
  };
}

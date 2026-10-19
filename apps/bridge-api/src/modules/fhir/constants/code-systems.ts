// ─── FHIR Code System Constants ──────────────────────────────────────────────
//
// Canonical system URIs for the clinical vocabularies bridge accepts on
// write. Centralized here so validators, mappers, and the terminology
// module all reference the same strings.
//
// ICD-9 and ICD-10 come in two flavors each: international (WHO) and US
// clinical modifications (CM). Both are listed because EHRs disagree on
// which one they use:
//   - Cerner Millennium primarily uses ICD-10-CM but will accept either
//   - Epic honours whichever you send
//   - Older systems (pre-2015) sometimes still send ICD-9-CM

export const CODING_SYSTEMS = {
  // Clinical vocabularies
  SNOMED: 'http://snomed.info/sct',
  ICD10: 'http://hl7.org/fhir/sid/icd-10',
  ICD10_CM: 'http://hl7.org/fhir/sid/icd-10-cm',
  ICD9: 'http://hl7.org/fhir/sid/icd-9',
  ICD9_CM: 'http://hl7.org/fhir/sid/icd-9-cm',
  LOINC: 'http://loinc.org',
  RXNORM: 'http://www.nlm.nih.gov/research/umls/rxnorm',

  // Status value sets — referenced by FHIR resource status fields.
  // Exposed here for symmetry with the frontend's `fhir-codings.ts`;
  // future validators or mappers that touch Condition status will use
  // these constants instead of hardcoding URIs.
  CONDITION_CLINICAL_STATUS: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
  CONDITION_VERIFICATION_STATUS: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
  CONDITION_CATEGORY: 'http://terminology.hl7.org/CodeSystem/condition-category',
} as const;

/**
 * Systems accepted on a Condition write. Bridge rejects bodies that don't
 * include at least one coding in this list.
 */
export const ALLOWED_CONDITION_CODING_SYSTEMS: ReadonlySet<string> = new Set([
  CODING_SYSTEMS.SNOMED,
  CODING_SYSTEMS.ICD10,
  CODING_SYSTEMS.ICD10_CM,
  CODING_SYSTEMS.ICD9,
  CODING_SYSTEMS.ICD9_CM,
]);

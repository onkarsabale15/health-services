import type { CdsCardCategory, CdsSeverity, FhirCoding } from '../../engine/cds-engine.types';

/**
 * Fallback FHIR coding for CDS card categories.
 * Used when the LLM does not provide SNOMED/LOINC codes in its output.
 */
export const CATEGORY_TO_FHIR_CODE: Record<CdsCardCategory, FhirCoding> = {
  'drug-interaction': {
    system: 'http://snomed.info/sct',
    code: '419511003',
    display: 'Propensity to adverse reactions to drug',
  },
  'allergy-caution': {
    system: 'http://snomed.info/sct',
    code: '420134006',
    display: 'Propensity to adverse reactions to substance',
  },
  'missing-screening': { system: 'http://snomed.info/sct', code: '310634005', display: 'Screening procedure required' },
  'care-gap': { system: 'http://snomed.info/sct', code: '423827005', display: 'Care plan gap identified' },
  'patient-safety': { system: 'http://snomed.info/sct', code: '281694009', display: 'Finding of at-risk patient' },
  'pcp-suggestion': { system: 'http://snomed.info/sct', code: '306206005', display: 'Referral to service' },
};

export const SEVERITY_TO_FHIR_PRIORITY: Record<CdsSeverity, string> = {
  critical: 'stat',
  warning: 'urgent',
  info: 'routine',
};

/** Resolve FHIR coding — prefer LLM-provided, fall back to category default */
export function resolveCoding(card: { category: CdsCardCategory; coding?: FhirCoding }): FhirCoding {
  return card.coding ?? CATEGORY_TO_FHIR_CODE[card.category];
}

import { BadRequestException } from '@nestjs/common';
import { ALLOWED_CONDITION_CODING_SYSTEMS } from '../constants/code-systems';

// ─── FHIR Condition Coding Validator ─────────────────────────────────────────
//
// Vendor-agnostic pre-flight check for Condition write bodies. Enforces one
// rule: at least one coding in `code.coding[]` must come from an accepted
// clinical vocabulary (SNOMED CT, ICD-10, ICD-10-CM, ICD-9, or ICD-9-CM).
//
// Why not a class-validator DTO? The bridge FHIR controllers currently
// accept `body: any` and let the vendor service parse the full shape. A
// focused functional validator is cheaper, easier to test, and doesn't
// leak class-validator metadata through the free-form FHIR surface.

interface FhirCoding {
  system?: string;
  code?: string;
  display?: string;
}

interface FhirCodeableConcept {
  coding?: FhirCoding[];
  text?: string;
}

/**
 * Throws `BadRequestException` if the body does not carry at least one
 * accepted clinical coding. Bodies missing `code` entirely or missing
 * `code.coding[]` are also rejected — Condition.code is required per FHIR.
 */
export function validateConditionCoding(body: unknown): void {
  const codeableConcept = (body as { code?: FhirCodeableConcept })?.code;
  const codings = codeableConcept?.coding;

  if (!codings || codings.length === 0) {
    throw new BadRequestException('Condition.code.coding[] is required and must contain at least one entry.');
  }

  const hasAllowed = codings.some((c) => c.system && ALLOWED_CONDITION_CODING_SYSTEMS.has(c.system));

  if (!hasAllowed) {
    throw new BadRequestException(
      'Condition.code must include at least one coding from an allowed ' +
        'system: SNOMED CT, ICD-10, ICD-10-CM, ICD-9, or ICD-9-CM.',
    );
  }
}

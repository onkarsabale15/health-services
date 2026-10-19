import type { IcdSnomedMapping } from '@hs/infra';
import {
  SYSTEM_URIS,
  type TerminologyConceptDto,
  type TerminologyConceptWithMappingsDto,
  type TerminologySystem,
} from '../dto/terminology.dto';

// ─── Mapping Row Converters ──────────────────────────────────────────────────
//
// Shared logic for turning `icd_snomed_mappings` rows into our
// system-agnostic DTO shape. SNOMED and ICD-10 providers both call these —
// they only differ in which *side* of the row is the primary vs the mapping.

/** Build a TerminologyConceptDto from explicit code + display + system. */
export function buildConcept(system: TerminologySystem, code: string, display: string | null): TerminologyConceptDto {
  return {
    system,
    systemUri: SYSTEM_URIS[system],
    code,
    display,
  };
}

/**
 * Convert a raw mapping row into a SNOMED-primary concept with its ICD-10
 * counterpart attached as a cross-mapping. Null ICD-10 codes produce an
 * empty mapping list.
 */
export function toSnomedPrimary(row: IcdSnomedMapping): TerminologyConceptWithMappingsDto {
  return {
    ...buildConcept('snomed', row.snomedCode, row.snomedConceptName),
    mappings: row.icd10Code ? [buildConcept('icd10', row.icd10Code, row.icd10ConceptName)] : [],
  };
}

/**
 * Convert a raw mapping row into an ICD-10-primary concept with its SNOMED
 * counterpart attached. Note: one ICD-10 code can map to multiple SNOMED
 * concepts — the caller should group rows by `icd10Code` before calling this
 * helper if they want all SNOMED mappings in a single result.
 */
export function toIcd10Primary(row: IcdSnomedMapping): TerminologyConceptWithMappingsDto {
  return {
    ...buildConcept('icd10', row.icd10Code ?? '', row.icd10ConceptName),
    mappings: [buildConcept('snomed', row.snomedCode, row.snomedConceptName)],
  };
}

/**
 * Group multiple rows sharing the same ICD-10 code into a single concept with
 * all its SNOMED counterparts in `mappings`. Used by the ICD-10 provider to
 * avoid duplicate rows in search/lookup results.
 */
export function groupByIcd10(rows: IcdSnomedMapping[]): TerminologyConceptWithMappingsDto[] {
  const byCode = new Map<string, TerminologyConceptWithMappingsDto>();

  for (const row of rows) {
    if (!row.icd10Code) continue;

    const existing = byCode.get(row.icd10Code);
    if (existing) {
      existing.mappings.push(buildConcept('snomed', row.snomedCode, row.snomedConceptName));
      // Prefer a non-null display if we didn't have one yet.
      if (!existing.display && row.icd10ConceptName) {
        existing.display = row.icd10ConceptName;
      }
    } else {
      byCode.set(row.icd10Code, toIcd10Primary(row));
    }
  }

  return [...byCode.values()];
}

// ─── ICD-SNOMED File Record Types ────────────────────────────────────────────
//
// Shape of records inside the `_SnomedMapping__YYYYMMDDHHMM.json` dump:
//
// {
//   "SnomedMapping": [
//     { "id": "...", "isActive": true, "snomedCode": "...", ... },
//     ...
//   ]
// }
//
// These are a pre-processed export (not the Snowstorm API shape), so field
// names differ slightly — see the transformer for the mapping.

/** One record as it appears in the source JSON file. */
export interface SnomedMappingFileRecord {
  id: string;
  isActive: boolean;
  snomedCode: string;
  snomedConceptName: string | null;
  mapGroup: number | string;
  mapPriority: number | string;
  mappingRule: string | null;
  mappingAdvice: string | null;
  icd10Code: string | null;
  icd10ConceptName: string | null;
  correlationId: string | null;
  mapCategoryId: string | null;
  mapCategoryName: string | null;
}

/** Root shape — the array lives under a fixed top-level key. */
export interface SnomedMappingFile {
  SnomedMapping: SnomedMappingFileRecord[];
}

/** Top-level key containing the record array. */
export const FILE_ARRAY_KEY = 'SnomedMapping' as const;

import { resolveMapCategory } from '../../common';
import type { IcdSnomedRow } from '../icd-snomed/icd-snomed.transformer';
import type { SnomedMappingFileRecord } from './icd-snomed-file.interfaces';

// ─── File Record → IcdSnomedRow Transformer ─────────────────────────────────
//
// Pure mapping from the pre-exported JSON dump shape to the shared
// {@link IcdSnomedRow} DTO. Handles the field-name differences between the
// file and the Snowstorm API:
//
//   file.id              → row.id               (primary key / member_id)
//   file.isActive        → row.isActive
//   file.mappingRule     → row.mapRule
//   file.mappingAdvice   → row.mapAdvice
//   file.mapCategoryId   → row.mapCategoryId + row.mapCategory (resolved enum)
//
// Fields absent from the file (`moduleId`, `effectiveTime`) are set to NULL.
// The file carries `icd10ConceptName` directly; we trust it when present and
// fall back to the synthesized `"ICD-10: <code>"` label otherwise.

export function mapFileRecordToRow(record: SnomedMappingFileRecord): IcdSnomedRow {
  const icd10Code = record.icd10Code?.trim() || null;
  const icd10ConceptName = record.icd10ConceptName ?? (icd10Code ? `ICD-10: ${icd10Code}` : null);

  return {
    id: record.id,
    isActive: record.isActive ?? false,
    moduleId: null,
    effectiveTime: null,
    snomedCode: record.snomedCode,
    snomedConceptName: record.snomedConceptName ?? null,
    icd10Code,
    icd10ConceptName,
    mapGroup: toInt(record.mapGroup),
    mapPriority: toInt(record.mapPriority),
    mapRule: record.mappingRule ?? null,
    mapAdvice: record.mappingAdvice ?? null,
    mapCategoryId: record.mapCategoryId ?? null,
    mapCategory: resolveMapCategory(record.mapCategoryId),
    correlationId: record.correlationId ?? null,
  };
}

function toInt(value: number | string | null | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

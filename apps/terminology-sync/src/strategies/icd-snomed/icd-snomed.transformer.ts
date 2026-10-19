import type { MapCategory } from '@hs/infra';
import { resolveMapCategory } from '../../common';
import type { SnowstormMember } from './icd-snomed.interfaces';

// ─── ICD-SNOMED Row Shape ────────────────────────────────────────────────────
//
// Shared DTO used by both strategies (Snowstorm API + JSON file). Mirrors the
// `icd_snomed_mappings` Prisma model minus the auto-managed timestamps
// (`createdAt`, `updatedAt`, `lastSyncedAt`), which the repository fills in.
//
// Keeping this as a plain interface — rather than `Prisma.IcdSnomedMappingCreateInput`
// — means transformers don't leak Prisma-generated types into their signature
// and stay trivially unit-testable.

export interface IcdSnomedRow {
  id: string;
  isActive: boolean;
  moduleId: string | null;
  effectiveTime: string | null;
  snomedCode: string;
  snomedConceptName: string | null;
  icd10Code: string | null;
  icd10ConceptName: string | null;
  mapGroup: number;
  mapPriority: number;
  mapRule: string | null;
  mapAdvice: string | null;
  mapCategoryId: string | null;
  mapCategory: MapCategory | null;
  correlationId: string | null;
}

// ─── Transformer ─────────────────────────────────────────────────────────────
//
// Pure function: Snowstorm API member → DB row object. No I/O, no logger,
// no Prisma — only shape mapping and simple normalization.

export function mapMemberToRow(member: SnowstormMember): IcdSnomedRow {
  const af = member.additionalFields;
  const rc = member.referencedComponent;
  const icd10Code = af.mapTarget?.trim() || null;

  return {
    id: member.memberId,
    isActive: member.active ?? false,
    moduleId: member.moduleId || null,
    effectiveTime: member.effectiveTime || null,
    snomedCode: member.referencedComponentId,
    snomedConceptName: rc?.pt?.term ?? rc?.fsn?.term ?? null,
    icd10Code,
    icd10ConceptName: icd10Code ? `ICD-10: ${icd10Code}` : null,
    mapGroup: Number(af.mapGroup) || 0,
    mapPriority: Number(af.mapPriority) || 0,
    mapRule: af.mapRule || null,
    mapAdvice: af.mapAdvice || null,
    mapCategoryId: af.mapCategoryId || null,
    mapCategory: resolveMapCategory(af.mapCategoryId),
    correlationId: af.correlationId || null,
  };
}

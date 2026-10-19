import { MapCategory } from '@hs/infra';

// ─── Map Category Constants ──────────────────────────────────────────────────
// All known SNOMED CT ICD-10 map category values (children of 447634004).
// Shared across API → DB transformation and any future validation logic.

export const MAP_CATEGORY_LOOKUP: Readonly<Record<string, MapCategory>> = {
  '447637006': MapCategory.PROPERLY_CLASSIFIED,
  '447638001': MapCategory.CANNOT_BE_CLASSIFIED,
  '447639009': MapCategory.CONTEXT_DEPENDENT,
  '447640006': MapCategory.SOURCE_CONCEPT_AMBIGUOUS,
  '447636002': MapCategory.OUTSIDE_SCOPE,
};

/**
 * Resolve a raw SNOMED mapCategoryId to a typed enum value.
 * Returns null for unknown/missing IDs rather than throwing.
 */
export function resolveMapCategory(mapCategoryId: string | undefined | null): MapCategory | null {
  if (!mapCategoryId) return null;
  return MAP_CATEGORY_LOOKUP[mapCategoryId] ?? null;
}

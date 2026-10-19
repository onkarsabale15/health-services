import { Injectable } from '@nestjs/common';
import { SYSTEM_URIS } from '../dto/terminology.dto';
import type { TerminologyConceptWithMappingsDto, TerminologySystem } from '../dto/terminology.dto';
import { BaseTerminologyProvider } from './base-terminology.provider';
import { groupByIcd10 } from './snomed-icd-mapping.helper';

// ─── ICD-10 Provider ─────────────────────────────────────────────────────────
//
// Reads from `icd_snomed_mappings` with ICD-10 as the primary concept. One
// ICD-10 code may map to multiple SNOMED concepts, so rows are collapsed by
// ICD-10 code and each result carries every SNOMED counterpart in
// `mappings`.

@Injectable()
export class Icd10Provider extends BaseTerminologyProvider {
  readonly system: TerminologySystem = 'icd10';
  readonly systemUri = SYSTEM_URIS.icd10;

  protected async doSearch(query: string, limit: number): Promise<TerminologyConceptWithMappingsDto[]> {
    // Fetch generously — we collapse rows by ICD-10 code below, so raw
    // row count may exceed final result count. A 3x multiplier gives
    // headroom for common collapse ratios without a second query.
    const rows = await this.prisma.icdSnomedMapping.findMany({
      where: {
        isActive: true,
        icd10Code: { not: null },
        OR: [
          { icd10Code: { startsWith: query.toUpperCase() } },
          { icd10ConceptName: { contains: query, mode: 'insensitive' } },
          { snomedConceptName: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: limit * 3,
      orderBy: [{ icd10Code: 'asc' }, { mapPriority: 'asc' }],
    });

    return groupByIcd10(rows).slice(0, limit);
  }

  protected async doLookup(code: string): Promise<TerminologyConceptWithMappingsDto | null> {
    const rows = await this.prisma.icdSnomedMapping.findMany({
      where: {
        icd10Code: code.toUpperCase(),
        isActive: true,
      },
      orderBy: [{ mapGroup: 'asc' }, { mapPriority: 'asc' }],
    });

    return groupByIcd10(rows)[0] ?? null;
  }
}

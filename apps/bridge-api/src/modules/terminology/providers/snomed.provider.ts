import { Injectable } from '@nestjs/common';
import { SYSTEM_URIS } from '../dto/terminology.dto';
import type { TerminologyConceptWithMappingsDto, TerminologySystem } from '../dto/terminology.dto';
import { BaseTerminologyProvider } from './base-terminology.provider';
import { toSnomedPrimary } from './snomed-icd-mapping.helper';

// ─── SNOMED CT Provider ──────────────────────────────────────────────────────
//
// Reads from `icd_snomed_mappings` with SNOMED as the primary concept. Every
// returned row has its ICD-10 counterpart populated in `mappings` (empty
// when the SNOMED code has no ICD-10 map).
//
// Scope: only SNOMED concepts that appear in the ICD-10 Extended Map Refset
// (447562003). For SNOMED concepts outside this refset, add a separate
// provider backed by a full-SNOMED data source.

@Injectable()
export class SnomedProvider extends BaseTerminologyProvider {
  readonly system: TerminologySystem = 'snomed';
  readonly systemUri = SYSTEM_URIS.snomed;

  protected async doSearch(query: string, limit: number): Promise<TerminologyConceptWithMappingsDto[]> {
    const rows = await this.prisma.icdSnomedMapping.findMany({
      where: {
        isActive: true,
        OR: [{ snomedCode: { startsWith: query } }, { snomedConceptName: { contains: query, mode: 'insensitive' } }],
      },
      take: limit,
      orderBy: { snomedCode: 'asc' },
    });

    return rows.map(toSnomedPrimary);
  }

  protected async doLookup(code: string): Promise<TerminologyConceptWithMappingsDto | null> {
    // A single SNOMED code may have multiple rows (different map groups
    // / priorities). Prefer the active row with the lowest group/priority.
    const row = await this.prisma.icdSnomedMapping.findFirst({
      where: { snomedCode: code, isActive: true },
      orderBy: [{ mapGroup: 'asc' }, { mapPriority: 'asc' }],
    });

    return row ? toSnomedPrimary(row) : null;
  }
}

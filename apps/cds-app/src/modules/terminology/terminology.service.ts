import { Injectable, BadRequestException } from '@nestjs/common';
import { db } from '@hs/infra';
import { TerminologyClient, type TerminologyConceptWithMappings } from '../../services/terminology.client';

const MAX_RESULTS = 50;
const MIN_QUERY_LENGTH = 3;

/**
 * Code-search service powering the clinical write modals.
 *
 * Routing:
 *   - SNOMED + ICD-10 → bridge terminology API (single source of truth,
 *     returns cross-mappings so the UI can pick one code and automatically
 *     include its counterpart in the FHIR Condition).
 *   - LOINC + RxNorm → local code tables (no bridge provider yet).
 *
 * When bridge adds LOINC/RxNorm providers, the delegation lines at the
 * bottom of this file can be switched over without touching the controller.
 */
@Injectable()
export class TerminologyService {
  constructor(private readonly terminologyClient: TerminologyClient) {}

  validateQuery(q: string): string {
    const trimmed = q?.trim();
    if (!trimmed || trimmed.length < MIN_QUERY_LENGTH) {
      throw new BadRequestException(`Search query must be at least ${MIN_QUERY_LENGTH} characters`);
    }
    return trimmed;
  }

  // ── SNOMED + ICD-10 → bridge ───────────────────────────────────────────

  async searchSnomed(q: string): Promise<TerminologyConceptWithMappings[]> {
    return this.terminologyClient.search('snomed', q, MAX_RESULTS);
  }

  async searchIcd10(q: string): Promise<TerminologyConceptWithMappings[]> {
    return this.terminologyClient.search('icd10', q, MAX_RESULTS);
  }

  // ── LOINC + RxNorm → local tables (no bridge provider yet) ─────────────

  async searchLoinc(q: string) {
    return db.getClient().loincCode.findMany({
      where: {
        isActive: true,
        OR: [
          { code: { startsWith: q } },
          { longName: { contains: q, mode: 'insensitive' } },
          { component: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        code: true,
        longName: true,
        shortName: true,
        component: true,
        classType: true,
      },
      take: MAX_RESULTS,
      orderBy: { code: 'asc' },
    });
  }

  async searchRxnorm(q: string) {
    return db.getClient().rxnormCode.findMany({
      where: {
        isActive: true,
        OR: [{ rxcui: { startsWith: q } }, { name: { contains: q, mode: 'insensitive' } }],
      },
      select: { id: true, rxcui: true, name: true, tty: true },
      take: MAX_RESULTS,
      orderBy: { name: 'asc' },
    });
  }
}

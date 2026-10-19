import { Injectable, OnModuleInit } from '@nestjs/common';
import { logger } from '@hs/observability';
import { withSpan } from '@hs/observability';
import { SyncStrategy, SyncResult } from '../../sync-strategy.interface';
import { SyncRegistry } from '../../sync-registry.service';
import { ICD_SNOMED_CONFIG } from './icd-snomed.config';
import { SnowstormApiClient } from './snowstorm-api.client';
import { mapMemberToRow } from './icd-snomed.transformer';
import { IcdSnomedRepository } from './icd-snomed.repository';
import type { SnowstormMemberResponse } from './icd-snomed.interfaces';

/** Small local helper — avoids pulling in a package for two lines. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── ICD-SNOMED Sync Service ─────────────────────────────────────────────────
//
// Pure orchestrator for the ICD-10 ↔ SNOMED sync:
//
//     Snowstorm API  →  transformer  →  repository (upsert + stale-mark)
//
// No HTTP, no DB, no transformation logic lives here — it just drives the
// pipeline and collects telemetry. Every step is wrapped in a child span of
// the root sync trace.

@Injectable()
export class IcdSnomedSyncService implements SyncStrategy, OnModuleInit {
  readonly type = 'icd-snomed';
  readonly description = 'Sync ICD-10 ↔ SNOMED CT mappings from Snowstorm (Refset 447562003)';

  private readonly apiClient = new SnowstormApiClient(ICD_SNOMED_CONFIG);

  constructor(
    private readonly registry: SyncRegistry,
    private readonly repository: IcdSnomedRepository,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  // ── Orchestration ──────────────────────────────────────────────────────

  async syncAll(): Promise<SyncResult> {
    return withSpan(
      {
        op: 'sync.strategy',
        name: `terminology-sync.${this.type}`,
        attributes: {
          'sync.type': this.type,
          'sync.refsetId': ICD_SNOMED_CONFIG.refsetId,
          'sync.branch': ICD_SNOMED_CONFIG.branch,
        },
      },
      async (span) => {
        const startTime = Date.now();
        const syncStartedAt = new Date();
        const errors: string[] = [];
        let totalUpserted = 0;

        logger.info('Starting ICD-10 ↔ SNOMED mapping sync');

        try {
          const total = await this.probeTotal();
          span.setAttribute('sync.expectedTotal', total);
          logger.info(`Total mappings available: ${total}`);
          await sleep(ICD_SNOMED_CONFIG.delayBetweenCallsMs);

          totalUpserted = await this.paginateAndUpsert(total);
          span.setAttribute('sync.totalUpserted', totalUpserted);

          const staleCount = await this.repository.markStaleInactive(syncStartedAt);
          span.setAttribute('sync.staleMarked', staleCount);
          if (staleCount > 0) {
            logger.info(`Marked ${staleCount} stale records as inactive`);
          }

          logger.info(`ICD-SNOMED sync complete — ${totalUpserted} records upserted`);
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          logger.error('ICD-SNOMED sync failed', error as Error);
          errors.push(message);
        }

        return {
          type: this.type,
          totalRecords: totalUpserted,
          durationMs: Date.now() - startTime,
          errors,
        };
      },
    );
  }

  // ── Steps ──────────────────────────────────────────────────────────────

  /** First probe call — returns the advertised total so we can log progress. */
  private async probeTotal(): Promise<number> {
    const probe = await this.apiClient.fetchMembers(null, 1);
    return probe.total ?? 0;
  }

  /**
   * Walk through every page using the searchAfter cursor, transform each
   * member, and hand the batch to the repository for upsert.
   */
  private async paginateAndUpsert(expectedTotal: number): Promise<number> {
    let totalUpserted = 0;
    let batchNumber = 0;
    let cursor: string | null = null;

    while (true) {
      batchNumber++;

      const response = await this.apiClient.fetchMembers(cursor, ICD_SNOMED_CONFIG.apiBatchSize);

      if (!response.items?.length) {
        logger.info('Pagination complete — no more records');
        break;
      }

      const rows = response.items.map(mapMemberToRow);
      await this.repository.writeBatch(rows);
      totalUpserted += rows.length;

      cursor = extractCursor(response.searchAfter);
      logger.info(`Batch ${batchNumber}: ${totalUpserted} / ~${expectedTotal}`);

      await sleep(ICD_SNOMED_CONFIG.delayBetweenCallsMs);
    }

    return totalUpserted;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Snowstorm returns either string or string[] — normalize to a single token. */
function extractCursor(searchAfter: SnowstormMemberResponse['searchAfter'] | undefined): string | null {
  if (!searchAfter) return null;
  return Array.isArray(searchAfter) ? (searchAfter[0] ?? null) : searchAfter;
}

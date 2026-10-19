import { Injectable, OnModuleInit } from '@nestjs/common';
import { logger } from '@hs/observability';
import { withSpan } from '@hs/observability';
import { SyncStrategy, SyncResult } from '../../sync-strategy.interface';
import { SyncRegistry } from '../../sync-registry.service';
import { IcdSnomedRepository } from '../icd-snomed/icd-snomed.repository';
import type { IcdSnomedRow } from '../icd-snomed/icd-snomed.transformer';
import { loadIcdSnomedFileConfig, type IcdSnomedFileConfig } from './icd-snomed-file.config';
import { StreamingIcdSnomedFileReader } from './icd-snomed-file.reader';
import { mapFileRecordToRow } from './icd-snomed-file.transformer';

// ─── ICD-SNOMED File Sync Service ────────────────────────────────────────────
//
// Strategy that ingests ICD-10 ↔ SNOMED mappings from a pre-exported JSON
// file rather than hitting the live Snowstorm API. Useful for:
//   • air-gapped deploys
//   • replaying a specific snapshot
//   • one-off bulk loads (e.g. seeding a fresh DB from a vendor dump)
//
// Pipeline:
//
//     JSON file → stream parser → transformer → repository upsert
//                                              → mark stale inactive (opt-in)
//
// Reuses `IcdSnomedRepository` so both this strategy and the API strategy
// share one set of SQL / column definitions.

@Injectable()
export class IcdSnomedFileSyncService implements SyncStrategy, OnModuleInit {
  readonly type = 'icd-snomed-file';
  readonly description = 'Ingest ICD-10 ↔ SNOMED CT mappings from a local JSON dump file';

  constructor(
    private readonly registry: SyncRegistry,
    private readonly repository: IcdSnomedRepository,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  // ── Orchestration ──────────────────────────────────────────────────────

  async syncAll(): Promise<SyncResult> {
    const config = loadIcdSnomedFileConfig();
    const reader = new StreamingIcdSnomedFileReader(config.filePath);

    return withSpan(
      {
        op: 'sync.strategy',
        name: `terminology-sync.${this.type}`,
        attributes: {
          'sync.type': this.type,
          'sync.filePath': config.filePath,
          'sync.chunkSize': config.chunkSize,
          'sync.markMissingAsInactive': config.markMissingAsInactive,
        },
      },
      async (span) => {
        const startTime = Date.now();
        const syncStartedAt = new Date();
        const errors: string[] = [];
        let totalUpserted = 0;

        try {
          const { absolutePath, sizeBytes } = await reader.inspect();
          span.setAttribute('sync.fileSizeBytes', sizeBytes);
          logger.info('Starting ICD-SNOMED file sync', {
            path: absolutePath,
            sizeBytes,
          });

          totalUpserted = await this.streamAndUpsert(reader, config);
          span.setAttribute('sync.totalUpserted', totalUpserted);

          if (config.markMissingAsInactive) {
            const staleCount = await this.repository.markStaleInactive(syncStartedAt);
            span.setAttribute('sync.staleMarked', staleCount);
            if (staleCount > 0) {
              logger.info(`Marked ${staleCount} stale records as inactive`);
            }
          }

          logger.info(`ICD-SNOMED file sync complete — ${totalUpserted} records upserted`);
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          logger.error('ICD-SNOMED file sync failed', error as Error);
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

  /**
   * Stream records from the file, transform them, and flush fixed-size
   * chunks to the repository. Memory is bounded to `chunkSize` records at
   * any moment.
   */
  private async streamAndUpsert(reader: StreamingIcdSnomedFileReader, config: IcdSnomedFileConfig): Promise<number> {
    let buffer: IcdSnomedRow[] = [];
    let totalUpserted = 0;
    let chunkNumber = 0;

    const flush = async (): Promise<void> => {
      if (buffer.length === 0) return;
      chunkNumber++;
      const rows = buffer;
      buffer = [];
      await this.repository.writeBatch(rows);
      totalUpserted += rows.length;
      logger.info(`Chunk ${chunkNumber}: ${totalUpserted} records upserted`);
    };

    for await (const record of reader.iterate()) {
      buffer.push(mapFileRecordToRow(record));
      if (buffer.length >= config.chunkSize) {
        await flush();
      }
    }

    await flush();
    return totalUpserted;
  }
}

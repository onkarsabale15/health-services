import { Module } from '@nestjs/common';
import { SyncRegistry } from './sync-registry.service';
import { IcdSnomedSyncService, IcdSnomedRepository } from './strategies/icd-snomed';
import { IcdSnomedFileSyncService } from './strategies/icd-snomed-file';

/**
 * Root module for the terminology-sync CLI app.
 *
 * To add a new sync strategy:
 *   1. Create `src/strategies/<name>/` following the ICD-SNOMED layout
 *      (config, interfaces, reader/api-client, transformer, service).
 *   2. Register the service (and any repository) here as providers.
 *   3. Strategies self-register with `SyncRegistry` via `OnModuleInit`.
 */
@Module({
  providers: [
    SyncRegistry,

    // ── ICD-10 ↔ SNOMED CT strategies ────────────────────────────────
    // Shared DB layer — reused by both the API and file-based strategies.
    IcdSnomedRepository,

    // Pull mappings live from the Snowstorm API.
    IcdSnomedSyncService,

    // Ingest mappings from a local JSON dump file.
    IcdSnomedFileSyncService,

    // Future strategies (RxNorm, LOINC, ...) go here.
  ],
  exports: [SyncRegistry],
})
export class AppModule {}

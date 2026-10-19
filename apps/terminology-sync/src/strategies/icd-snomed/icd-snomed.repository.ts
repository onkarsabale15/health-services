import { Injectable, OnModuleInit } from '@nestjs/common';
import { db, PrismaClient } from '@hs/infra';
import { logger, withSpan } from '@hs/observability';
import type { IcdSnomedRow } from './icd-snomed.transformer';

// ─── ICD-SNOMED Repository ───────────────────────────────────────────────────
//
// All DB interaction for the ICD-SNOMED sync goes through this class. Both
// the Snowstorm API strategy and the JSON-file strategy hand it batches of
// rows and it handles persistence + stale-deactivation.
//
// Write strategy: bulk delete-then-insert per batch — two ORM calls, no
// transaction, no raw SQL, true upsert semantics.
//
//   1. Dedupe the batch by `id` (last occurrence wins) so the insert below
//      can't hit a unique-constraint conflict from duplicates inside the
//      file itself.
//
//   2. `deleteMany({ where: { id: { in: ids } } })`
//        Wipes any existing rows whose IDs appear in this batch. No-op on a
//        fresh DB; removes stale versions on re-runs so the subsequent
//        insert writes the new values.
//
//   3. `createMany({ data: rows })`
//        Single multi-row INSERT — orders of magnitude faster than per-row
//        `upsert`. Safe because step 2 cleared any conflicts first.
//
// Why not `upsert()` or `$transaction([...upserts])`?
//   Prisma has no bulk upsert. Per-row upsert = N round-trips per batch; for
//   120k rows that's ~10 minutes of wire latency. `createMany` does the same
//   work in a single SQL statement.
//
// Why not `createMany({ skipDuplicates: true })`?
//   That's `INSERT … ON CONFLICT DO NOTHING` — it skips updates, so existing
//   rows' content would never refresh. Delete-then-insert preserves content
//   updates at the cost of one extra bulk statement.
//
// `icd_snomed_mappings` is a leaf table (no foreign keys pointing at it), so
// the brief sub-millisecond window between delete and insert is safe.

@Injectable()
export class IcdSnomedRepository implements OnModuleInit {
  private prisma!: PrismaClient;

  onModuleInit(): void {
    this.prisma = db.getClient();
  }

  /**
   * Write a batch of mapping rows to the DB via delete-then-insert.
   *
   * Deduplicates within the batch, deletes any existing rows whose IDs
   * appear in the batch, then bulk-inserts the fresh copies. Two bulk ORM
   * statements total — no per-row round-trips, no enclosing transaction.
   */
  async writeBatch(rows: IcdSnomedRow[]): Promise<void> {
    if (rows.length === 0) return;

    // Dedupe within the batch — last occurrence of each id wins. Cheap
    // insurance against accidental duplicates in the source file; SNOMED
    // memberIds are meant to be unique within a refset, but we don't
    // want a single bad row to fail the whole batch.
    const byId = new Map<string, IcdSnomedRow>();
    for (const row of rows) byId.set(row.id, row);
    const deduped = [...byId.values()];

    await withSpan(
      {
        op: 'db.write',
        name: 'icdSnomedMapping.writeBatch',
        attributes: {
          'db.inputRows': rows.length,
          'db.dedupedRows': deduped.length,
        },
      },
      async (span) => {
        const start = Date.now();
        const lastSyncedAt = new Date();
        const ids = deduped.map((r) => r.id);

        // Step 1: wipe any existing versions of these rows.
        const { count: deleted } = await this.prisma.icdSnomedMapping.deleteMany({
          where: { id: { in: ids } },
        });

        // Step 2: bulk-insert the fresh copies.
        const { count: inserted } = await this.prisma.icdSnomedMapping.createMany({
          data: deduped.map((row) => ({ ...row, lastSyncedAt })),
        });

        const durationMs = Date.now() - start;
        span.setAttribute('db.deleted', deleted);
        span.setAttribute('db.inserted', inserted);
        span.setAttribute('db.durationMs', durationMs);
        logger.info(`Wrote ${inserted} records (${deleted} refreshed, ${inserted - deleted} new, ${durationMs}ms)`);
      },
    );
  }

  /**
   * Soft-delete records that weren't refreshed by the current sync run.
   * Any row whose `lastSyncedAt` is older than the sync start timestamp is
   * assumed gone from the source and marked inactive.
   */
  async markStaleInactive(syncStartedAt: Date): Promise<number> {
    return withSpan(
      {
        op: 'db.update',
        name: 'icdSnomedMapping.markStale',
      },
      async (span) => {
        const result = await this.prisma.icdSnomedMapping.updateMany({
          where: {
            lastSyncedAt: { lt: syncStartedAt },
            isActive: true,
          },
          data: { isActive: false },
        });

        span.setAttribute('db.staleCount', result.count);
        return result.count;
      },
    );
  }
}

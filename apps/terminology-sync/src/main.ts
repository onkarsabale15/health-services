import './instrument';
import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import type { INestApplicationContext } from '@nestjs/common';
import { tracing, withSpan } from '@hs/observability';
import { logger } from '@hs/observability';
import { secrets } from '@hs/infra';
import { db } from '@hs/infra';
import { httpClient } from '@hs/infra';
import { AppModule } from './app.module';
import { SyncRegistry } from './sync-registry.service';
import type { SyncResult } from './sync-strategy.interface';

// ─── Terminology Sync CLI ────────────────────────────────────────────────────
//
// Usage:
//   npx ts-node src/main.ts --type icd-snomed
//   npm run sync -- --type icd-snomed
//
// One invocation = one root span (`terminology-sync.run`) with every API
// call, DB batch, and pagination step attached as a child. That gives us a
// single trace per ECS task run in Sentry / OTel.

const ROOT_SPAN = {
  op: 'sync.run',
  name: 'terminology-sync.run',
} as const;

async function bootstrap(): Promise<void> {
  const syncType = parseTypeArg();

  await initInfrastructure();

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });
  const registry = app.get(SyncRegistry);

  if (!syncType || syncType === 'help' || process.argv.includes('--help')) {
    printHelp(registry);
    await shutdown(app);
    return;
  }

  try {
    await runSync(registry, syncType);
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    tracing.captureException(err, { syncType });
    logger.error('Sync failed', err);
    process.exitCode = 1;
  } finally {
    await shutdown(app);
  }
}

// ─── Lifecycle ───────────────────────────────────────────────────────────────

async function initInfrastructure(): Promise<void> {
  // Init order matches every IB app: tracing → logger → secrets → db → http.
  tracing.init({ serviceName: 'terminology-sync' });
  logger.init({ service: 'terminology-sync' });

  await secrets.loadSecrets(['DATABASE_URL']);

  db.init({ url: process.env.DATABASE_URL });
  await db.connect();

  httpClient.init({ timeout: 30_000 });
}

async function runSync(registry: SyncRegistry, syncType: string): Promise<void> {
  await withSpan(
    {
      ...ROOT_SPAN,
      attributes: { 'sync.type': syncType },
    },
    async (span) => {
      logger.info('Starting terminology sync', { type: syncType });

      const result = await registry.run(syncType);

      applyResultToSpan(span, result);
      logResult(result);

      if (result.errors.length > 0) {
        span.setStatus({ code: 2, message: 'Sync completed with errors' });
        logger.error('Sync completed with errors', new Error(result.errors.join('; ')));
        process.exitCode = 1;
      }
    },
  );
}

async function shutdown(app: INestApplicationContext): Promise<void> {
  await app.close();
  await db.disconnect();
  await tracing.shutdown();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseTypeArg(): string | undefined {
  const args = process.argv.slice(2);
  const idx = args.indexOf('--type');
  return idx !== -1 ? args[idx + 1] : undefined;
}

function printHelp(registry: SyncRegistry): void {
  const descriptions = registry.getDescriptions();
  logger.info('Terminology Sync — available types:');
  for (const { type, description } of descriptions) {
    logger.info(`  --type ${type.padEnd(16)} ${description}`);
  }
}

function applyResultToSpan(
  span: { setAttribute: (k: string, v: string | number | boolean) => void },
  result: SyncResult,
): void {
  span.setAttribute('sync.totalRecords', result.totalRecords);
  span.setAttribute('sync.durationMs', result.durationMs);
  span.setAttribute('sync.errorCount', result.errors.length);
}

function logResult(result: SyncResult): void {
  logger.info('Sync finished', {
    type: result.type,
    totalRecords: result.totalRecords,
    durationMs: result.durationMs,
    errorCount: result.errors.length,
  });
}

bootstrap();

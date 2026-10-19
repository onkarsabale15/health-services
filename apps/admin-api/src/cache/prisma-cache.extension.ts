/**
 * Prisma Client Extension — read-through cache + automatic write invalidation.
 *
 * Architecture:
 *   - Reads (findUnique/findFirst/findMany) → cache-aside pattern
 *   - Writes (create/update/delete/upsert/*Many) → write-through invalidation
 *
 * SOLID:
 *   - SRP: Only handles data-layer caching concern
 *   - OCP: Add new models to CACHED_MODELS without changing logic
 *   - DIP: Depends on ICache interface, not concrete Redis implementation
 *
 * Cache key format:  admin:db:{Model}:{action}:{argsHash}
 * Invalidation:      admin:db:{Model}:*  (+ related models + cross-layer patterns)
 */
import { createHash } from 'crypto';
import type { ICache } from '@hs/infra';
import { logger } from '@hs/observability';
import { AdminCacheTTL } from './cache-ttl';

/** Models whose reads are cached and writes trigger invalidation */
const CACHED_MODELS = new Set([
  'Application',
  'Organization',
  'User',
  'AppEhrAccess',
  'UserAppAccess',
  'CdsRule',
  'Workflow',
  'WorkflowTemplate',
  // Note: WorkflowExecution intentionally NOT cached — high write volume, rapidly changing status
]);

/**
 * When model X is written, also invalidate caches for related models.
 * Handles relational consistency — e.g., Application queries that
 * include { ehrAccess: true } must be invalidated when AppEhrAccess changes.
 */
const RELATED_MODELS: Record<string, string[]> = {
  AppEhrAccess: ['Application'],
  UserAppAccess: ['User', 'Application'],
  CdsRule: ['Application'],
  Workflow: ['Application'],
};

/**
 * Extra non-model cache patterns to invalidate when specific models change.
 * Handles cross-layer consistency — e.g., OAuth's app metadata cache
 * must be invalidated when admin updates Application config.
 */
const EXTRA_INVALIDATION: Record<string, string[]> = {
  Application: ['app:meta:*', 'app:jwks:*'],
  CdsRule: ['cds:rules:*'],
};

// ─── Helpers ──────────────────────────────────────────────────

/** Stable hash of Prisma query args for cache key uniqueness */
function argsHash(args: any): string {
  if (!args) return '0';
  try {
    const str = JSON.stringify(args, (_, v) => {
      if (v instanceof Date) return v.toISOString();
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        return Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)));
      }
      return v;
    });
    return createHash('sha256').update(str).digest('hex').slice(0, 12);
  } catch {
    // Serialization failed — generate unique hash to skip cache
    return createHash('sha256').update(String(Date.now())).digest('hex').slice(0, 12);
  }
}

function cacheKey(model: string, action: string, args: any): string {
  return `admin:db:${model}:${action}:${argsHash(args)}`;
}

function modelPattern(model: string): string {
  return `admin:db:${model}:*`;
}

/** Read-through cache for a Prisma query */
async function cachedRead(
  model: string,
  action: string,
  args: any,
  query: (args: any) => Promise<any>,
  c: ICache,
): Promise<any> {
  if (!CACHED_MODELS.has(model)) return query(args);

  const key = cacheKey(model, action, args);
  try {
    const cached = await c.get(key);
    if (cached !== null) {
      logger.debug('Prisma cache HIT', { model, action });
      return cached;
    }
  } catch {
    // Cache read failed — fall through to DB
  }

  const result = await query(args);
  if (result !== null && result !== undefined) {
    try {
      await c.set(key, result, AdminCacheTTL.DB_QUERY);
    } catch {
      // Non-fatal: continue even if cache write fails
    }
  }
  return result;
}

/** Execute write then invalidate model + related + cross-layer caches */
async function writeThrough(model: string, args: any, query: (args: any) => Promise<any>, c: ICache): Promise<any> {
  const result = await query(args);

  if (!CACHED_MODELS.has(model)) return result;

  const patterns: string[] = [modelPattern(model)];

  // Related models (relational consistency)
  const related = RELATED_MODELS[model];
  if (related) {
    for (const m of related) patterns.push(modelPattern(m));
  }

  // Cross-layer patterns (e.g., OAuth metadata cache)
  const extra = EXTRA_INVALIDATION[model];
  if (extra) patterns.push(...extra);

  try {
    await Promise.all(patterns.map((p) => c.delByPattern(p)));
    logger.debug('Prisma cache invalidated', { model, patterns });
  } catch {
    // Cache invalidation is best-effort — don't fail the write
  }

  return result;
}

// ─── Extension Factory ──────────────────────────────────────

/**
 * Creates a Prisma Client Extension that adds:
 *   - Read-through caching for entity queries (cache-aside pattern)
 *   - Automatic write-through invalidation with relational awareness
 *
 * @param cacheInstance - ICache implementation (injected, follows DIP)
 */
export function createPrismaCacheExtension(cacheInstance: ICache) {
  const read =
    (action: string) =>
    ({ model, args, query }: any) =>
      cachedRead(model, action, args, query, cacheInstance);

  const write = ({ model, args, query }: any) => writeThrough(model, args, query, cacheInstance);

  return {
    query: {
      $allModels: {
        // ─── Cached reads ──────────────────
        findUnique: read('findUnique'),
        findFirst: read('findFirst'),
        findMany: read('findMany'),

        // ─── Write-through invalidation ────
        create: write,
        update: write,
        upsert: write,
        delete: write,
        createMany: write,
        updateMany: write,
        deleteMany: write,
      },
    },
  };
}

import { db, cache, buildCacheKey } from '@hs/infra';
import type { PrismaClient } from '@hs/infra';
import type { ITerminologyProvider } from './terminology.provider.interface';
import type { TerminologyConceptWithMappingsDto, TerminologySystem } from '../dto/terminology.dto';

// ─── Base Terminology Provider ───────────────────────────────────────────────
//
// Every provider extends this and only implements the `doSearch` / `doLookup`
// database-facing methods. The base class owns:
//
//   • Prisma client access (getter so tests can re-init @hs/db mid-run)
//   • Read-through caching via `cache.getOrSet` (@hs/cache)
//   • Cache key building via the shared `@hs/cache.buildCacheKey` helper
//
// TTL is env-configurable so sync runs / tests can dial it down without
// code changes. Cache failures are swallowed by `getOrSet`, so a Redis
// outage degrades gracefully to direct DB reads.
//
// Note on negative lookups: `getOrSet` does NOT cache `null` results, so
// repeated misses for the same code each hit the DB. That's intentional —
// it means a code that just got added by terminology-sync becomes visible
// on the next request, with no cache-flush step needed.

const NAMESPACE = 'bridge:terminology';

const DEFAULT_TTL_SECONDS = Number(process.env.BRIDGE_TERMINOLOGY_CACHE_TTL_SECONDS ?? 3600);

export abstract class BaseTerminologyProvider implements ITerminologyProvider {
  abstract readonly system: TerminologySystem;
  abstract readonly systemUri: string;

  protected get prisma(): PrismaClient {
    return db.getClient();
  }

  /** Public API — cache-aware wrapper over `doSearch`. */
  search(query: string, limit: number): Promise<TerminologyConceptWithMappingsDto[]> {
    const key = buildCacheKey({
      namespace: NAMESPACE,
      operation: `${this.system}.search`,
      args: { q: query.toLowerCase(), limit },
    });
    return cache.getOrSet(key, DEFAULT_TTL_SECONDS, () => this.doSearch(query, limit));
  }

  /** Public API — cache-aware wrapper over `doLookup`. */
  lookup(code: string): Promise<TerminologyConceptWithMappingsDto | null> {
    const key = buildCacheKey({
      namespace: NAMESPACE,
      operation: `${this.system}.lookup`,
      args: { code },
    });
    return cache.getOrSet(key, DEFAULT_TTL_SECONDS, () => this.doLookup(code));
  }

  // ── Abstract hooks ─────────────────────────────────────────────────────

  protected abstract doSearch(query: string, limit: number): Promise<TerminologyConceptWithMappingsDto[]>;

  protected abstract doLookup(code: string): Promise<TerminologyConceptWithMappingsDto | null>;
}

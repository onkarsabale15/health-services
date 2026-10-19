import { Injectable, NotFoundException } from '@nestjs/common';
import { AdminClient } from '@hs/admin-client';
import { toEhrConfig, type EhrClientConfig, type EhrConfigName, type SiteData } from '@hs/ehr-data-service';

interface ResolvedContext {
  config: EhrClientConfig;
  ehrName: EhrConfigName;
  /** Owning org — used by the auth layer for the token↔site tenant-boundary check. */
  organizationId?: string;
}

/** Memo TTL — long enough to collapse a session's calls, short enough that
 *  a re-pointed site recovers within a minute without process restart. */
const CONTEXT_TTL_MS = 30_000;

/** Hard cap on memo entries — bounds memory if many distinct sites are hit. */
const MAX_MEMO_ENTRIES = 500;

/**
 * Resolves an authenticated session's `siteId` into the full runtime
 * context: SiteData (creds + URLs) + the typed `EhrClientConfig`.
 *
 * `ehrName` is DERIVED from SiteData, not from the session token — single
 * source of truth is `EhrSiteConfig.id` → admin-api → SiteData. The token
 * carries scope (siteId) but not vendor identity.
 *
 * A short-TTL, size-bounded in-process memo collapses the repeated lookups
 * one MCP session makes (one `tools/list` + N `tools/call` for the same
 * siteId) into a single admin-api round-trip, and an in-flight map de-dupes
 * concurrent cold lookups for the same site. PR6 replaces this with the
 * shared cache layer + explicit invalidation hooks.
 */
@Injectable()
export class SessionContextService {
  private readonly adminClient = new AdminClient('mcp-service');
  private readonly memo = new Map<string, { value: ResolvedContext; expiresAt: number }>();
  private readonly inflight = new Map<string, Promise<ResolvedContext>>();

  /**
   * Resolve a session's siteId to its EhrClientConfig + the runtime
   * ehrName (for catalog filtering, audit, etc.). Throws NotFoundException
   * when the site doesn't exist or isn't accessible.
   */
  async resolve(siteId: string): Promise<ResolvedContext> {
    const hit = this.memo.get(siteId);
    if (hit && hit.expiresAt > Date.now()) return hit.value;

    // De-dupe concurrent cold lookups so N simultaneous calls hit admin-api once.
    const pending = this.inflight.get(siteId);
    if (pending) return pending;

    const promise = this.fetch(siteId).finally(() => this.inflight.delete(siteId));
    this.inflight.set(siteId, promise);
    return promise;
  }

  private async fetch(siteId: string): Promise<ResolvedContext> {
    const siteData = (await this.adminClient.getSite(siteId)) as SiteData | null;
    if (!siteData) {
      throw new NotFoundException(`Site not found: ${siteId}`);
    }
    const config = toEhrConfig(siteData);
    const organizationId = typeof siteData.organizationId === 'string' ? siteData.organizationId : undefined;
    const value: ResolvedContext = { config, ehrName: config.ehrName, organizationId };
    this.evictIfNeeded();
    this.memo.set(siteId, { value, expiresAt: Date.now() + CONTEXT_TTL_MS });
    return value;
  }

  /** Keep the memo bounded: drop expired entries, then the soonest-to-expire. */
  private evictIfNeeded(): void {
    if (this.memo.size < MAX_MEMO_ENTRIES) return;
    const now = Date.now();
    for (const [key, entry] of this.memo) {
      if (entry.expiresAt <= now) this.memo.delete(key);
    }
    if (this.memo.size < MAX_MEMO_ENTRIES) return;
    const oldestFirst = [...this.memo.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt);
    const dropCount = this.memo.size - MAX_MEMO_ENTRIES + 1;
    for (let i = 0; i < dropCount; i++) this.memo.delete(oldestFirst[i][0]);
  }
}

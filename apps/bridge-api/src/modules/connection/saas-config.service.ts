import { logger } from '@hs/observability';
import { cache } from '@hs/infra';
import { adminClient } from '../../services/admin-client.service';
import { CacheKeys } from '../../cache/cache-keys';
import { CacheTTL } from '../../cache/cache-ttl';

type AppEhrConfigResult = {
  ehrConfig: Record<string, any>;
  ehrTokenScopes: string[];
};

/**
 * Fetches stored EHR config for an application+EHR via admin-api.
 * Results are cached in Redis with a 5-minute TTL.
 */
export async function getAppEhrConfig(clientId: string, ehrName: string): Promise<AppEhrConfigResult | null> {
  const cacheKey = CacheKeys.appEhrConfig(clientId, ehrName);

  // Check cache first
  try {
    const cached = await cache.get<AppEhrConfigResult>(cacheKey);
    if (cached) {
      logger.debug('AppEhrConfig cache hit', { clientId, ehrName });
      return cached;
    }
  } catch {
    // Cache miss or error — fall through
  }

  try {
    const config = await adminClient.getAppEhrConfig(clientId, ehrName);
    if (!config) return null;

    const result: AppEhrConfigResult = {
      ehrConfig: config.ehrConfig as Record<string, any>,
      ehrTokenScopes: config.ehrTokenScopes,
    };

    // Cache the result
    await cache.set(cacheKey, result, CacheTTL.APP_EHR_CONFIG).catch(() => {});

    return result;
  } catch (err) {
    logger.warn('Failed to fetch app EHR config', { clientId, ehrName, error: (err as Error).message });
    return null;
  }
}

/**
 * Invalidate cached EHR config for a specific app+EHR or all EHRs for an app.
 */
export async function invalidateAppEhrConfig(clientId: string, ehrName?: string): Promise<void> {
  try {
    if (ehrName) {
      await cache.del(CacheKeys.appEhrConfig(clientId, ehrName));
    } else {
      await cache.delByPattern(CacheKeys.appPattern(clientId));
    }
    logger.info('Invalidated AppEhrConfig cache', { clientId, ehrName });
  } catch {
    // Non-fatal
  }
}

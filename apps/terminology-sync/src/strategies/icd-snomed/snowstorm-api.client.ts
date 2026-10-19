import { logger } from '@hs/observability';
import { httpClient, requestWithRetry, type RetryConfig } from '@hs/infra';
import { withSpan } from '@hs/observability';
import type { SnowstormMemberResponse } from './icd-snomed.interfaces';

// ─── Snowstorm API Client ────────────────────────────────────────────────────
//
// Pure HTTP layer for the Snowstorm terminology server. No DB, no transforms,
// no business logic — just parameterized GETs issued through the shared
// `@hs/http-client` (logging + error context) wrapped in a tracing span and
// reused exponential-backoff retry on 429.
//
// Headers match the reference `snowStormSync.js` script exactly.

export interface SnowstormClientConfig {
  baseUrl: string;
  branch: string;
  refsetId: string;
  retry: RetryConfig;
}

const SNOWSTORM_HEADERS: Record<string, string> = {
  accept: 'application/json',
  'Accept-Language': 'en-X-900000000000509007,en-X-900000000000508004,en',
  'User-Agent': 'SnowstormSyncScript/1.0',
};

export class SnowstormApiClient {
  constructor(private readonly config: SnowstormClientConfig) {}

  /**
   * Fetch a single page of reference-set members using `searchAfter` cursor
   * pagination. 429s are retried with exponential backoff by
   * {@link requestWithRetry}.
   */
  async fetchMembers(searchAfter: string | null, limit: number): Promise<SnowstormMemberResponse> {
    return withSpan(
      {
        op: 'http.client',
        name: 'snowstorm.fetchMembers',
        attributes: {
          'snowstorm.limit': limit,
          'snowstorm.searchAfter': searchAfter ?? 'initial',
        },
      },
      async (span) => {
        const params: Record<string, string> = {
          referenceSet: this.config.refsetId,
          active: 'true',
          limit: String(limit),
          sort: 'memberId',
        };
        if (searchAfter) params.searchAfter = searchAfter;

        logger.info(`Snowstorm API: fetching ${limit} members`, {
          searchAfter: searchAfter ?? 'initial',
        });

        const { data } = await requestWithRetry<SnowstormMemberResponse>(
          httpClient,
          {
            url: `${this.config.baseUrl}/${this.config.branch}/members`,
            method: 'get',
            headers: SNOWSTORM_HEADERS,
            params,
          },
          this.config.retry,
        );

        const count = data.items?.length ?? 0;
        span.setAttribute('snowstorm.receivedCount', count);
        logger.info(`Snowstorm API: received ${count} members`);
        return data;
      },
    );
  }
}

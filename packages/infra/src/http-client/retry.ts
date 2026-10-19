import { logger } from '@hs/observability';
import type { IHttpClient, HttpRequestConfig, HttpResponse } from './http-client.interface';

// ─── Retry Wrapper ───────────────────────────────────────────────────────────
//
// Reusable exponential-backoff wrapper around any `IHttpClient`. Retries on
// 429 (rate limit) by default; optionally also on 5xx responses and network
// errors. Keeps `httpClient` itself simple and side-effect-free.
//
// Example:
// ```ts
// import { httpClient, requestWithRetry } from '@hs/infra';
//
// const res = await requestWithRetry(httpClient, {
//   url: 'https://api.example.com/items',
//   method: 'get',
//   params: { limit: 100 },
// }, { maxRetries: 5, initialDelayMs: 1_000 });
// ```

export interface RetryConfig {
  /** Maximum number of retry attempts after the initial request (default 5) */
  maxRetries?: number;

  /** Base delay in ms — doubles on every retry (default 1000) */
  initialDelayMs?: number;

  /** Per-request timeout in ms (overrides client default) */
  timeoutMs?: number;

  /** Also retry on 5xx responses (default false — only 429) */
  retryOn5xx?: boolean;

  /** Also retry on network errors / timeouts with no response (default false) */
  retryOnNetworkError?: boolean;
}

const DEFAULTS: Required<Omit<RetryConfig, 'timeoutMs'>> & { timeoutMs?: number } = {
  maxRetries: 5,
  initialDelayMs: 1_000,
  retryOn5xx: false,
  retryOnNetworkError: false,
  timeoutMs: undefined,
};

/**
 * Issue an HTTP request via the given client with exponential-backoff retries.
 *
 * The client is passed in so consumers can inject mocks in tests and so this
 * helper remains stateless.
 */
export async function requestWithRetry<T = unknown>(
  client: IHttpClient,
  config: HttpRequestConfig,
  retryConfig: RetryConfig = {},
): Promise<HttpResponse<T>> {
  const opts = { ...DEFAULTS, ...retryConfig };
  const requestConfig: HttpRequestConfig = opts.timeoutMs ? { ...config, timeout: opts.timeoutMs } : config;

  let attempt = 0;
  while (true) {
    try {
      return await client.request<T>(requestConfig);
    } catch (error: unknown) {
      const err = error as { status?: number; code?: string };
      const status = err.status;
      const isRateLimited = status === 429;
      const isServerError = typeof status === 'number' && status >= 500 && status < 600;
      const isNetworkError = status === undefined;

      const shouldRetry =
        (isRateLimited || (opts.retryOn5xx && isServerError) || (opts.retryOnNetworkError && isNetworkError)) &&
        attempt < opts.maxRetries;

      if (!shouldRetry) throw error;

      const delayMs = opts.initialDelayMs * Math.pow(2, attempt);
      attempt++;

      logger.warn(`HTTP retry ${attempt}/${opts.maxRetries} in ${delayMs}ms`, {
        url: config.url,
        status: status ?? 'network',
        code: err.code,
      });

      await sleep(delayMs);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

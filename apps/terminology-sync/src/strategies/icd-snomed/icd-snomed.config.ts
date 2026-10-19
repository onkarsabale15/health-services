import type { RetryConfig } from '@hs/infra';

// ─── ICD-SNOMED Strategy Config ──────────────────────────────────────────────
//
// All static configuration for the ICD-10 ↔ SNOMED sync lives here so the
// service file only contains orchestration logic. Environment variables are
// read once at import time.

export interface IcdSnomedConfig {
  /** Snowstorm base URL (e.g. https://snowstorm.snomedtools.org/snowstorm/snomed-ct) */
  readonly baseUrl: string;

  /** Terminology branch to query (usually 'MAIN') */
  readonly branch: string;

  /** ICD-10 Extended Map refset concept ID */
  readonly refsetId: string;

  /** Page size for each Snowstorm /members call */
  readonly apiBatchSize: number;

  /** Delay between consecutive page fetches (ms) — avoids rate limiting */
  readonly delayBetweenCallsMs: number;

  /** Retry policy for HTTP calls */
  readonly retry: RetryConfig;
}

export const ICD_SNOMED_CONFIG: IcdSnomedConfig = {
  baseUrl: process.env.SNOWSTORM_BASE_URL ?? 'https://snowstorm.snomedtools.org/snowstorm/snomed-ct',
  branch: process.env.SNOWSTORM_BRANCH ?? 'MAIN',
  refsetId: '447562003',
  apiBatchSize: 10_000,
  delayBetweenCallsMs: 2_000,
  retry: {
    maxRetries: 5,
    initialDelayMs: 1_000,
    timeoutMs: 30_000,
  },
};

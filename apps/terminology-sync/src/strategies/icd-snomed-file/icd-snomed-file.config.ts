// ─── ICD-SNOMED File Strategy Config ─────────────────────────────────────────
//
// All static configuration for the JSON-file-based sync. File path is picked
// from CLI (`--file <path>`) first, then env var, then a repo-root default so
// the service can be invoked with zero args during local dev.

export interface IcdSnomedFileConfig {
  /** Absolute or repo-relative path to the source JSON dump. */
  readonly filePath: string;

  /**
   * Number of records to buffer in memory before flushing to the DB.
   *
   * Each flush becomes a single `createMany` + `updateMany` pair. Keep
   * comfortably below Postgres's 65,535-parameter limit:
   *   rows × (columnsPerRow + 1 id) ≤ 65,535
   *   4000 × 16 ≈ 64,000 — within limit with margin.
   */
  readonly chunkSize: number;

  /**
   * If true, mark any existing DB rows NOT present in this file as inactive
   * after the import completes. Enable for full-snapshot imports; disable
   * for incremental/delta imports.
   */
  readonly markMissingAsInactive: boolean;
}

const DEFAULT_FILE_PATH = '_SnomedMapping__202604100012.json';

/** Build the strategy config by resolving CLI args and env vars. */
export function loadIcdSnomedFileConfig(argv: string[] = process.argv): IcdSnomedFileConfig {
  return {
    filePath: resolveFilePath(argv),
    chunkSize: Number(process.env.SNOMED_FILE_CHUNK_SIZE ?? 4_000),
    markMissingAsInactive: (process.env.SNOMED_FILE_MARK_MISSING_INACTIVE ?? 'true') !== 'false',
  };
}

function resolveFilePath(argv: string[]): string {
  const idx = argv.indexOf('--file');
  if (idx !== -1 && argv[idx + 1]) return argv[idx + 1];
  return process.env.SNOMED_MAPPING_FILE ?? DEFAULT_FILE_PATH;
}

// ─── Sync Strategy Interface ─────────────────────────────────────────────────
// All terminology sync services implement this contract.
// To add a new sync: implement SyncStrategy, register in AppModule.

export interface SyncResult {
  type: string;
  totalRecords: number;
  durationMs: number;
  errors: string[];
}

export interface SyncStrategy {
  /** Unique key used in CLI --type argument (e.g. 'icd-snomed', 'rxnorm', 'loinc') */
  readonly type: string;

  /** Human-readable description shown in --help output */
  readonly description: string;

  /** Execute the full sync. Returns summary of what was synced. */
  syncAll(): Promise<SyncResult>;
}

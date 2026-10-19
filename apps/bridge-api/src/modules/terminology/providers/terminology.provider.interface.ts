import type { TerminologyConceptWithMappingsDto, TerminologySystem } from '../dto/terminology.dto';

// ─── Terminology Provider Contract ───────────────────────────────────────────
//
// One provider per code system. New systems (LOINC, RxNorm, ...) plug in by
// implementing this interface and adding themselves to the `TERMINOLOGY_PROVIDERS`
// multi-provider array in `terminology.module.ts` — no controller or service
// changes required.
//
// Providers always return concepts with their cross-mappings included. For
// the SNOMED ↔ ICD-10 pair the cross-mapping is pulled from the same row in
// `icd_snomed_mappings`. Providers with no cross-coding concept (e.g. LOINC)
// return empty `mappings` arrays.

export interface ITerminologyProvider {
  /** Machine-readable system identifier — e.g. 'snomed', 'icd10' */
  readonly system: TerminologySystem;

  /** Canonical FHIR system URI — e.g. 'http://snomed.info/sct' */
  readonly systemUri: string;

  /**
   * Search concepts by code prefix or display-text substring.
   * Results include cross-mappings to other code systems.
   */
  search(query: string, limit: number): Promise<TerminologyConceptWithMappingsDto[]>;

  /**
   * Look up a single concept by exact code match. Returns null if missing.
   * Response includes cross-mappings to other code systems.
   */
  lookup(code: string): Promise<TerminologyConceptWithMappingsDto | null>;
}

/**
 * Nest DI token used by {@link TerminologyService} to collect every
 * registered {@link ITerminologyProvider}. Register new providers by adding
 * them to the `useValue` array (or `useFactory` list) in the module file.
 */
export const TERMINOLOGY_PROVIDERS = Symbol('TERMINOLOGY_PROVIDERS');

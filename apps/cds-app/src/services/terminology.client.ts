import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { httpClient } from '@hs/infra';
import { cache, buildCacheKey } from '@hs/infra';
import { PlatformTokenService } from './platform-token.service';

// ─── Terminology Client (CDS → Bridge) ───────────────────────────────────────
//
// Dedicated client for the bridge `/terminology/*` endpoints. Kept separate
// from `BridgeClientService` (which is FHIR-only) so each bridge consumer
// stays focused on one concern:
//
//     BridgeClientService  → /fhir/r4/v1/*   (wraps @hs/bridge-client)
//     TerminologyClient    → /terminology/*  (direct httpClient)
//
// Both share `PlatformTokenService` for auth — one token, one cache, one
// place to change the grant flow.
//
// Wire shape matches bridge exactly so the same types work on both sides
// without a generated SDK layer. If bridge adds a typed terminology client
// to `@hs/bridge-client` later, this file becomes a one-liner.

export type TerminologySystem = 'snomed' | 'icd10' | 'loinc' | 'rxnorm';

export interface TerminologyConcept {
  system: TerminologySystem;
  systemUri: string;
  code: string;
  display: string | null;
}

export interface TerminologyConceptWithMappings extends TerminologyConcept {
  mappings: TerminologyConcept[];
}

interface SearchResponse {
  results: TerminologyConceptWithMappings[];
  count: number;
}

// ─── Cache configuration ─────────────────────────────────────────────────────
//
// CDS-app caches terminology responses from bridge so the same clinical
// write modal keystrokes don't round-trip bridge every time. Short-ish TTL
// (15 min default) because cds-app sits in front of the user — we want
// fresh data after a bridge restart or terminology sync without an operator
// having to manually flush anything.

const CACHE_NAMESPACE = 'cds:terminology';
const DEFAULT_TTL_SECONDS = Number(process.env.CDS_TERMINOLOGY_CACHE_TTL_SECONDS ?? 900);

/**
 * Canonical FHIR system URI → internal terminology system identifier.
 * Single source of truth within cds-app — consumed by `TerminologyClient`
 * for parameter building and by {@link FhirCodingEnricher} for reverse
 * lookups when scanning FHIR bodies. Matches bridge's `SYSTEM_URIS` map.
 */
export const SYSTEM_URIS: Record<TerminologySystem, string> = {
  snomed: 'http://snomed.info/sct',
  // icd-10-cm (US Clinical Modification) — what Cerner Millennium and other
  // US EHRs accept on write. Mirrors bridge's SYSTEM_URIS resolution.
  icd10: 'http://hl7.org/fhir/sid/icd-10-cm',
  loinc: 'http://loinc.org',
  rxnorm: 'http://www.nlm.nih.gov/research/umls/rxnorm',
};

/**
 * Reverse lookup: FHIR `Coding.system` URI → our internal system identifier.
 * Both ICD-10 variants (international + US-CM) reverse-map to `icd10` since
 * the table is shared; only the canonical `SYSTEM_URIS.icd10` is used on writes.
 */
export const URI_TO_SYSTEM: Record<string, TerminologySystem> = {
  [SYSTEM_URIS.snomed]: 'snomed',
  [SYSTEM_URIS.icd10]: 'icd10',
  'http://hl7.org/fhir/sid/icd-10': 'icd10',
  [SYSTEM_URIS.loinc]: 'loinc',
  [SYSTEM_URIS.rxnorm]: 'rxnorm',
};

@Injectable()
export class TerminologyClient {
  constructor(
    private readonly config: ConfigService,
    private readonly tokens: PlatformTokenService,
  ) {}

  /**
   * Search the given code system; results include cross-mappings.
   *
   * Cached per `(system, lowercased query, limit)` — identical searches
   * hit Redis, not bridge. Cache failures fall through to a live call.
   */
  search(system: TerminologySystem, query: string, limit = 20): Promise<TerminologyConceptWithMappings[]> {
    const key = buildCacheKey({
      namespace: CACHE_NAMESPACE,
      operation: `${system}.search`,
      args: { q: query.toLowerCase(), limit },
    });
    return cache.getOrSet(key, DEFAULT_TTL_SECONDS, async () => {
      const { results } = await this.get<SearchResponse>('/terminology/search', {
        system,
        q: query,
        limit: String(limit),
      });
      return results;
    });
  }

  /**
   * Look up a single concept by exact code. Returns null on 404 so the
   * caller can treat "not found" as a soft miss instead of a thrown
   * error. Negative lookups are not cached (see @hs/cache.getOrSet).
   */
  lookup(system: TerminologySystem, code: string): Promise<TerminologyConceptWithMappings | null> {
    const key = buildCacheKey({
      namespace: CACHE_NAMESPACE,
      operation: `${system}.lookup`,
      args: { code },
    });
    return cache.getOrSet(key, DEFAULT_TTL_SECONDS, async () => {
      try {
        return await this.get<TerminologyConceptWithMappings>('/terminology/lookup', { system, code });
      } catch (error: unknown) {
        if ((error as { status?: number }).status === 404) return null;
        throw error;
      }
    });
  }

  // ── Internal ───────────────────────────────────────────────────────────

  private async get<T>(path: string, params: Record<string, string>): Promise<T> {
    const baseUrl = this.config.get<string>('app.bridgeApiUrl')!;
    const token = await this.tokens.getToken();

    const response = await httpClient.request<T>({
      url: `${baseUrl}${path}`,
      method: 'get',
      authType: 'Bearer',
      authToken: token,
      params,
    });
    return response.data;
  }
}

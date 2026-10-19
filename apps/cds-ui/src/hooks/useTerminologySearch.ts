'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cdsApi } from '@/lib/api';
import type { TerminologyConceptWithMappings, TerminologySystem } from '@/types';

// ─── useTerminologySearch ────────────────────────────────────────────────────
//
// Reusable React hook for ICD-10 / SNOMED code search. Designed to be the
// ONLY thing a form component needs to wire into its search input — it
// handles every client-side throttling concern in one place so every code
// picker in the app has identical behaviour:
//
//   • Debounce — 400ms after the last keystroke before firing a request
//   • Minimum query length — no request until >= MIN_QUERY_LENGTH chars
//   • Request cancellation — aborts the in-flight fetch when the query
//     changes mid-flight so stale responses can't overwrite fresh state
//   • In-memory query cache — identical (system, query) pairs return
//     cached results without hitting the network (cleared on unmount)
//   • Strict mode safety — guards against setState after unmount
//
// Consumers get:
//   const { query, setQuery, results, loading, error, clear } =
//     useTerminologySearch('snomed');
//
// Swap `snomed` for `icd10` as needed. Results carry cross-mappings so the
// caller can build a multi-coded FHIR Condition without a second lookup.

const DEBOUNCE_MS = 400;
const MIN_QUERY_LENGTH = 3;
const CACHE_MAX_ENTRIES = 50;

type SupportedSystem = Extract<TerminologySystem, 'snomed' | 'icd10'>;

interface UseTerminologySearchResult {
  /** Current (undebounced) input value — bind this to your text input */
  query: string;
  /** Update the input value — triggers a debounced search */
  setQuery: (value: string) => void;
  /** Latest search results (cross-mapped) */
  results: TerminologyConceptWithMappings[];
  /** True while a request is in flight */
  loading: boolean;
  /** Error message from the last failed request, or null */
  error: string | null;
  /** Reset query + results (e.g. on modal close) */
  clear: () => void;
}

export function useTerminologySearch(system: SupportedSystem): UseTerminologySearchResult {
  const [query, setQueryState] = useState('');
  const [results, setResults] = useState<TerminologyConceptWithMappings[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs that must survive re-renders without causing them.
  const abortRef = useRef<AbortController | null>(null);
  const cacheRef = useRef<Map<string, TerminologyConceptWithMappings[]>>(new Map());
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  // Memoized fetcher — picks the right endpoint based on the system prop.
  const fetcher = useMemo(() => {
    if (system === 'snomed') return cdsApi.searchSnomed.bind(cdsApi);
    return cdsApi.searchIcd10.bind(cdsApi);
  }, [system]);

  // Debounced effect: trims, validates length, checks cache, fires.
  useEffect(() => {
    const trimmed = query.trim();

    if (trimmed.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setError(null);
      setLoading(false);
      abortRef.current?.abort();
      return;
    }

    const cacheKey = buildCacheKey(system, trimmed);
    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      setResults(cached);
      setError(null);
      setLoading(false);
      return;
    }

    // Cancel any previous in-flight request — we only care about the
    // latest keystroke's result.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const timer = window.setTimeout(async () => {
      if (controller.signal.aborted) return;
      setLoading(true);
      setError(null);
      try {
        const data = await fetcher(trimmed, controller.signal);
        if (controller.signal.aborted || !mountedRef.current) return;
        rememberInCache(cacheRef.current, cacheKey, data);
        setResults(data);
      } catch (err: unknown) {
        if (controller.signal.aborted || !mountedRef.current) return;
        setError((err as Error)?.message ?? 'Terminology search failed');
        setResults([]);
      } finally {
        if (mountedRef.current && !controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, system, fetcher]);

  const setQuery = useCallback((value: string) => {
    setQueryState(value);
  }, []);

  const clear = useCallback(() => {
    abortRef.current?.abort();
    setQueryState('');
    setResults([]);
    setError(null);
    setLoading(false);
  }, []);

  return { query, setQuery, results, loading, error, clear };
}

// ─── Internal helpers ────────────────────────────────────────────────────────

function buildCacheKey(system: SupportedSystem, query: string): string {
  return `${system}:${query.toLowerCase()}`;
}

/**
 * LRU-lite: evict the oldest entry when the cache exceeds the cap. Keeps
 * memory bounded without pulling in a dedicated LRU library.
 */
function rememberInCache(
  cache: Map<string, TerminologyConceptWithMappings[]>,
  key: string,
  value: TerminologyConceptWithMappings[],
): void {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, value);
}

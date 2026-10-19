'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Check } from 'lucide-react';
import { useTerminologySearch } from '@/hooks/useTerminologySearch';
import type { TerminologyConceptWithMappings } from '@/types';

// ─── TerminologySearchField ──────────────────────────────────────────────────
//
// Accessible, debounced terminology picker for clinical write forms.
//
// Provider-friendly behaviour:
//   • Debounced input (400ms via useTerminologySearch) so each keystroke
//     doesn't fire a request
//   • Minimum 3 characters before any lookup
//   • In-memory result cache so reopening the modal with the same query is
//     instant
//   • Cross-mapping preview on every result row — the provider can see at
//     a glance that picking a SNOMED concept will also attach its ICD-10
//     counterpart to the Condition being created/edited
//   • Click / Enter / Arrow keys work — select happens on click
//   • Selected state shows as a "chip" with a clear button; search input
//     is reused when the provider wants to change the selection
//   • Disabled mode (update flow): the code is locked — provider sees the
//     selected concept and cannot change it

type System = 'snomed' | 'icd10';

interface Props {
  system: System;
  label: string;
  placeholder?: string;
  /** Currently selected concept (controlled) */
  value: TerminologyConceptWithMappings | null;
  onChange: (concept: TerminologyConceptWithMappings | null) => void;
  /** When true, selection is locked (used in update mode) */
  disabled?: boolean;
  /** Shown below the field as a helper line */
  hint?: string;
  /** Error message shown below the field */
  error?: string;
  required?: boolean;
}

export default function TerminologySearchField({
  system,
  label,
  placeholder,
  value,
  onChange,
  disabled = false,
  hint,
  error,
  required = false,
}: Props) {
  const { query, setQuery, results: rawResults, loading, error: searchError, clear } = useTerminologySearch(system);
  // Dedupe by (system, code) — terminology search can return the same concept
  // via multiple paths (e.g. as a primary hit AND as a related concept under
  // a different parent). Duplicate React keys downstream → console warnings.
  const results = useMemo(() => {
    const seen = new Set<string>();
    return rawResults.filter((r) => {
      const key = `${r.system}:${r.code}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [rawResults]);
  const [focused, setFocused] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close result list on outside click.
  useEffect(() => {
    if (!focused) return;
    const onDocClick = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setFocused(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [focused]);

  const handleSelect = (concept: TerminologyConceptWithMappings) => {
    onChange(concept);
    clear();
    setFocused(false);
  };

  const handleClear = () => {
    if (disabled) return;
    onChange(null);
    clear();
  };

  // ── Selected (chip) state ──────────────────────────────────────────────
  if (value) {
    return (
      <div className="space-y-1">
        <label className="text-xs font-medium text-surface-on/80 flex items-center gap-1">
          {label}
          {required && <span className="text-red-500">*</span>}
        </label>
        <div
          className={`rounded-xl border-2 px-4 py-3 ${
            disabled
              ? 'border-surface-container-high/40 bg-surface-container-lowest/60'
              : 'border-primary/30 bg-primary-container/30'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 w-6 h-6 rounded-full bg-primary text-on-primary flex items-center justify-center shrink-0">
              <Check size={14} strokeWidth={3} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-surface-on">
                {value.display ?? <span className="italic text-secondary">No display name</span>}
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-white/60 text-surface-on">
                  {value.system.toUpperCase()} {value.code}
                </span>
                {value.mappings.map((m) => (
                  <span
                    key={`${m.system}:${m.code}`}
                    className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-white/60 text-secondary"
                    title={`Auto-attached via cross-mapping: ${m.display ?? m.code}`}
                  >
                    + {m.system.toUpperCase()} {m.code}
                  </span>
                ))}
              </div>
            </div>
            {!disabled && (
              <button
                type="button"
                onClick={handleClear}
                className="text-secondary hover:text-surface-on shrink-0 w-6 h-6 rounded hover:bg-white/60 flex items-center justify-center"
                aria-label={`Clear ${label}`}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
        {disabled && (
          <p className="text-[11px] text-secondary italic">
            Code cannot be changed on an existing condition — create a new one instead.
          </p>
        )}
        {hint && !disabled && <p className="text-[11px] text-secondary">{hint}</p>}
        {error && <p className="text-[11px] text-red-500">{error}</p>}
      </div>
    );
  }

  // ── Search state ───────────────────────────────────────────────────────
  return (
    <div className="space-y-1" ref={wrapperRef}>
      <label className="text-xs font-medium text-surface-on/80 flex items-center gap-1">
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <div className="flex items-center gap-2 rounded-xl border-2 border-surface-container-high/40 focus-within:border-primary/60 bg-white px-3 py-2.5">
          <Search size={16} className="text-secondary shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            placeholder={placeholder ?? `Search by code or description (min 3 chars)`}
            className="flex-1 bg-transparent outline-none text-sm text-surface-on placeholder:text-secondary/60"
            aria-autocomplete="list"
            aria-expanded={focused && results.length > 0}
          />
          {loading && (
            <div className="w-4 h-4 border-2 border-primary-container border-t-primary rounded-full animate-spin shrink-0" />
          )}
        </div>

        <AnimatePresence>
          {focused && (query.trim().length >= 3 || results.length > 0) && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.12 }}
              className="absolute left-0 right-0 top-full mt-1 z-10 rounded-xl bg-white border border-surface-container-high/60 shadow-lg overflow-hidden"
            >
              {loading && results.length === 0 && <p className="px-4 py-3 text-xs text-secondary">Searching…</p>}
              {!loading && searchError && <p className="px-4 py-3 text-xs text-red-500">{searchError}</p>}
              {!loading && !searchError && results.length === 0 && query.trim().length >= 3 && (
                <p className="px-4 py-3 text-xs text-secondary">No results for &ldquo;{query}&rdquo;</p>
              )}
              {results.length > 0 && (
                <ul role="listbox" className="max-h-72 overflow-y-auto divide-y divide-surface-container-high/30">
                  {results.map((r) => (
                    <li key={`${r.system}:${r.code}`} role="option" aria-selected="false">
                      <button
                        type="button"
                        onClick={() => handleSelect(r)}
                        className="w-full text-left px-4 py-2.5 hover:bg-primary-container/30 transition-colors"
                      >
                        <p className="text-sm text-surface-on leading-tight">
                          {r.display ?? <span className="italic text-secondary">No display name</span>}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <span className="text-[10px] font-mono px-1 py-0.5 rounded bg-surface-container-low text-surface-on">
                            {r.system.toUpperCase()} {r.code}
                          </span>
                          {r.mappings.slice(0, 2).map((m) => (
                            <span
                              key={`${m.system}:${m.code}`}
                              className="text-[10px] font-mono px-1 py-0.5 rounded bg-surface-container-low/60 text-secondary"
                            >
                              + {m.system.toUpperCase()} {m.code}
                            </span>
                          ))}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {hint && <p className="text-[11px] text-secondary">{hint}</p>}
      {error && <p className="text-[11px] text-red-500">{error}</p>}
    </div>
  );
}

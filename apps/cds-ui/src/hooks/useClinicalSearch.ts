'use client';

import { useMemo } from 'react';

/**
 * Generic filter hook for clinical data lists.
 *
 * Preserves `null` (data still loading) vs `[]` (loaded but empty/no matches).
 * The caller supplies a `getSearchableText` function that concatenates the
 * fields relevant for that resource type into a single string.
 */
export function useClinicalSearch<T>(
  items: T[] | null,
  query: string,
  getSearchableText: (item: T) => string,
): T[] | null {
  return useMemo(() => {
    if (!items) return null;
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => getSearchableText(item).toLowerCase().includes(q));
  }, [items, query, getSearchableText]);
}

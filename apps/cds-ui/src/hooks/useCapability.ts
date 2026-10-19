'use client';

import { useMemo } from 'react';
import type { ClinicalOperation, OperationSupport } from '@/lib/capabilities.types';
import { useSession } from './useSession';

// ─── Capability hooks ────────────────────────────────────────────────────
//
// Per-resource flags (allowAdd, categories, encounterBound) live on every
// list/detail response envelope and are consumed via `useResource()`. This
// hook covers the residual case of cross-resource operations that don't bind
// to a single endpoint — today only `careplan.generate`. Add new operations
// here ONLY if they cannot be expressed on a resource envelope.

/**
 * Check if the current session supports a cross-resource operation. Returns
 * the full `OperationSupport` (with `reason` + `encounterBound` flags) plus
 * a `loading` flag while the session bootstrap is in flight.
 */
export function useCapability(operation: ClinicalOperation): OperationSupport & { loading: boolean } {
  const { session, loading } = useSession();
  return useMemo(() => {
    if (loading || !session) {
      return { supported: false, reason: 'Loading session...', loading };
    }
    const result = session.operations?.[operation];
    return result ? { ...result, loading: false } : { supported: false, reason: 'Unknown operation', loading: false };
  }, [session, loading, operation]);
}

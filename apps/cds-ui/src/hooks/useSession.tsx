'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { cdsApi } from '@/lib/api';
import type { ClinicalOperation, OperationSupport } from '@/lib/capabilities.types';

export type ProviderRole =
  | 'physician'
  | 'nurse_practitioner'
  | 'physician_assistant'
  | 'nurse'
  | 'medical_assistant'
  | 'support'
  | 'system';

export interface ProviderCapabilities {
  /** Can transition a DRAFT care plan to ACTIVE — gates the "Approve" button. */
  canApproveCarePlan: boolean;
}

export interface SessionInfo {
  ehrName: string;
  launchMode: 'ehr' | 'standalone' | 'system';
  provider: {
    fhirId: string | null;
    name: string | null;
    /**
     * Descriptive role of the launching user. Useful for display, audit,
     * analytics. Components MUST NOT gate UI on this directly — read the
     * matching flag on `capabilities` instead so action policy lives in
     * one place server-side.
     */
    role: ProviderRole;
    /**
     * Action-scoped capability flags. The BE re-enforces every gate
     * server-side; this is purely for UI affordance.
     */
    capabilities: ProviderCapabilities;
  };
  currentPatient: { patientId: string; encounterId?: string } | null;
  /**
   * Cross-resource operations — capabilities that don't bind to a single
   * resource (today: `careplan.generate`). Per-resource flags
   * (`condition.write`, `allergy.write`, etc.) are returned on each
   * list/detail envelope and consumed via `useResource()`, NOT from here.
   * Null only when the BE has no provider registered for this EHR
   * (treated as "everything unsupported").
   */
  operations: Partial<Record<ClinicalOperation, OperationSupport>> | null;
}

interface SessionCtx {
  session: SessionInfo | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

const SessionContext = createContext<SessionCtx>({
  session: null,
  loading: true,
  error: null,
  refresh: () => {},
});

/** Provides session context to the tree. Mount once in app layout. */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await cdsApi.getSessionInfo();
      setSession({
        ehrName: data.ehrName,
        launchMode: data.launchMode as SessionInfo['launchMode'],
        provider: data.provider,
        currentPatient: data.currentPatient,
        operations: (data.operations as SessionInfo['operations']) ?? null,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load session');
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Auto-refresh session every 2 minutes to catch expiry
  useEffect(() => {
    const interval = setInterval(load, 120_000);
    return () => clearInterval(interval);
  }, [load]);

  return (
    <SessionContext.Provider value={{ session, loading, error, refresh: load }}>{children}</SessionContext.Provider>
  );
}

/** Access the current CDS session (ehrName, launchMode, provider, patient, cross-resource ops). */
export function useSession() {
  return useContext(SessionContext);
}

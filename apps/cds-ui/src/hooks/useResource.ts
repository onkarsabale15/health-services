'use client';

import { useCallback, useEffect, useState } from 'react';
import { cdsApi } from '@/lib/api';
import type {
  AllergySummary,
  AppointmentSummary,
  ConditionSummary,
  EncounterSummary,
  MedicationSummary,
  PatientSummary,
  VitalSummary,
} from '@/types';
import type { PatientResponseEnvelope, ResourceCapabilities, ResponseEnvelope } from '@/lib/capabilities.types';

interface UseResourceState<T, M> {
  data: T | null;
  capabilities: ResourceCapabilities | null;
  meta: M | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

interface EnvelopeShape<T, M> {
  data: T;
  capabilities: ResourceCapabilities;
  meta: M;
}

/**
 * Generic resource hook — fetches an envelope endpoint and surfaces both
 * the data and the per-resource capability flags. The capability flags are
 * what drive the UI's Add / Edit / Delete button gating, category pickers,
 * and encounter selectors. `data` is the actual list/detail payload.
 *
 * Components consuming this hook should NOT branch on `meta.ehrName`. If
 * a flag isn't expressible via `capabilities`, that's a backend gap —
 * extend the capability shape, don't add UI conditionals.
 *
 * Generic over both `T` (data shape) and `M` (meta shape) so detail hooks
 * with extended meta — like `usePatient` carrying linkage IDs — preserve
 * their fields without an `as` cast at the call site.
 */
function useResource<T, M = ResponseEnvelope<T>['meta']>(
  fetcher: (() => Promise<EnvelopeShape<T, M>>) | null,
): UseResourceState<T, M> {
  const [state, setState] = useState<{
    data: T | null;
    capabilities: ResourceCapabilities | null;
    meta: M | null;
    loading: boolean;
    error: string | null;
  }>({
    data: null,
    capabilities: null,
    meta: null,
    loading: fetcher !== null,
    error: null,
  });

  const load = useCallback(() => {
    if (fetcher === null) {
      // Disabled — typically because a required input (e.g., id) isn't
      // resolved yet. Keep state at its idle defaults and skip the request.
      setState({ data: null, capabilities: null, meta: null, loading: false, error: null });
      return () => {};
    }
    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    fetcher()
      .then((envelope) => {
        if (cancelled) return;
        setState({
          data: envelope.data,
          capabilities: envelope.capabilities,
          meta: envelope.meta,
          loading: false,
          error: null,
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Request failed';
        setState((prev) => ({ ...prev, loading: false, error: message }));
      });
    return () => {
      cancelled = true;
    };
  }, [fetcher]);

  useEffect(() => {
    const cleanup = load();
    return cleanup;
  }, [load]);

  return { ...state, reload: load };
}

// ── Typed wrappers ─────────────────────────────────────────────────────

export function usePatient() {
  return useResource<PatientSummary | null, PatientResponseEnvelope<PatientSummary | null>['meta']>(
    useCallback(() => cdsApi.getPatientResponse(), []),
  );
}

/**
 * Detail-by-id hooks. Pass `undefined` to disable the fetch — used when the
 * patient meta hasn't loaded yet, or when this EHR has no encounter model.
 * While disabled, the hook reports `loading: false` and `data: null`.
 */
export function useEncounter(id: string | undefined) {
  const fetcher = useCallback(() => (id ? cdsApi.getEncounter(id) : Promise.reject(new Error('no id'))), [id]);
  return useResource<EncounterSummary | null>(id ? fetcher : null);
}

export function useAppointment(id: string | undefined) {
  const fetcher = useCallback(() => (id ? cdsApi.getAppointment(id) : Promise.reject(new Error('no id'))), [id]);
  return useResource<AppointmentSummary | null>(id ? fetcher : null);
}

/**
 * The active-status-aware list hooks accept an `includeInactive` option —
 * `false` (default) for the Clinical Summary 2x2 grid, `true` for the
 * "View all" detail modal. The dep array tracks the flag so flipping it
 * triggers a fresh request rather than serving stale active-only data.
 */
export function useConditions(options?: { includeInactive?: boolean }) {
  const includeInactive = options?.includeInactive ?? false;
  return useResource<ConditionSummary[]>(
    useCallback(() => cdsApi.getConditionsResponse({ includeInactive }), [includeInactive]),
  );
}

export function useAllergies(options?: { includeInactive?: boolean }) {
  const includeInactive = options?.includeInactive ?? false;
  return useResource<AllergySummary[]>(
    useCallback(() => cdsApi.getAllergiesResponse({ includeInactive }), [includeInactive]),
  );
}

export function useMedications(options?: { includeInactive?: boolean }) {
  const includeInactive = options?.includeInactive ?? false;
  return useResource<MedicationSummary[]>(
    useCallback(() => cdsApi.getMedicationsResponse({ includeInactive }), [includeInactive]),
  );
}

export function useVitals() {
  return useResource<VitalSummary[]>(useCallback(() => cdsApi.getVitalsResponse(), []));
}

export function useAppointments() {
  return useResource<AppointmentSummary[]>(useCallback(() => cdsApi.getAppointmentsResponse(), []));
}

export function useEncounters(filters?: { appointmentId?: string; date?: string }) {
  return useResource<EncounterSummary[]>(
    useCallback(() => cdsApi.getEncountersResponse(filters), [filters?.appointmentId, filters?.date]),
  );
}

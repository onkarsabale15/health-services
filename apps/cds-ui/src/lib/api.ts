import type {
  AnalysisResponse,
  CarePlan,
  CdsCard,
  FhirResourceResult,
  TerminologyConceptWithMappings,
  LocalTerminologyCode,
  ConditionRequest,
  PatientSummary,
  EncounterSummary,
  AppointmentSummary,
  ConditionSummary,
  AllergySummary,
  MedicationSummary,
  VitalSummary,
} from '@/types';
import type { OperationSupport, PatientResponseEnvelope, ResponseEnvelope } from './capabilities.types';

const CDS_API_URL = process.env.NEXT_PUBLIC_CDS_API_URL || 'http://localhost:3003';

/**
 * CDS API client — uses HttpOnly cookie for auth (set by /launch).
 * No session ID in code — browser sends cookie automatically.
 */
export class CdsApiClient {
  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    // Wire the caller's signal (if any) into our own controller so that
    // BOTH the 60s timeout and caller-initiated cancellation abort the
    // fetch. Needed for debounced keystroke searches that cancel
    // in-flight requests when a new keystroke arrives.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    const callerSignal = options.signal as AbortSignal | undefined;
    if (callerSignal) {
      if (callerSignal.aborted) controller.abort();
      else callerSignal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    try {
      const res = await fetch(`${CDS_API_URL}/api${path}`, {
        ...options,
        credentials: 'include',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `API error: ${res.status}`);
      }
      const text = await res.text();
      return (text ? JSON.parse(text) : null) as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  // ── Session ──────────────────────────────────────────────
  async getPractitioner(): Promise<{
    id: string;
    fullName: string;
    npi?: string;
    specialty?: string;
    qualification?: string;
    email?: string;
    phone?: string;
  } | null> {
    return this.request('/clinical-data/practitioner');
  }

  async getSessionInfo(): Promise<{
    provider: {
      fhirId: string | null;
      name: string | null;
      /**
       * Descriptive role — for display, audit, analytics. UI MUST NOT
       * gate actions on this; read the matching flag on `capabilities`
       * instead.
       */
      role:
        | 'physician'
        | 'nurse_practitioner'
        | 'physician_assistant'
        | 'nurse'
        | 'medical_assistant'
        | 'support'
        | 'system';
      /** Action-scoped capability flags. Drives action gating. */
      capabilities: { canApproveCarePlan: boolean };
    };
    ehrName: string;
    launchMode: string;
    currentPatient: { patientId: string; encounterId?: string } | null;
    /**
     * Cross-resource ops (today: `careplan.generate`). Per-resource
     * capabilities are returned alongside their data on each list/detail
     * envelope and are NOT duplicated here.
     */
    operations: Record<string, OperationSupport> | null;
  }> {
    return this.request('/clinical-data/session');
  }

  // ── Analysis ─────────────────────────────────────────────
  async startAnalysis(options?: { previousCarePlanId?: string; instructions?: string }): Promise<void> {
    await this.request('/analysis/start', {
      method: 'POST',
      body: JSON.stringify(options || {}),
    });
  }

  async getAnalysisStatus(): Promise<AnalysisResponse> {
    return this.request('/analysis/status');
  }

  // ── Clinical Data ────────────────────────────────────────
  // Every clinical-data endpoint returns `{ data, capabilities, meta }`.
  // The hooks in `useResource.ts` consume these envelopes directly — page
  // components read both `data` and `capabilities` from the same response.

  getPatientResponse(): Promise<PatientResponseEnvelope<PatientSummary | null>> {
    return this.request('/clinical-data/patient');
  }
  getEncounter(id: string): Promise<ResponseEnvelope<EncounterSummary | null>> {
    return this.request(`/clinical-data/encounters/${encodeURIComponent(id)}`);
  }
  getAppointment(id: string): Promise<ResponseEnvelope<AppointmentSummary | null>> {
    return this.request(`/clinical-data/appointments/${encodeURIComponent(id)}`);
  }
  getConditionsResponse(options?: { includeInactive?: boolean }): Promise<ResponseEnvelope<ConditionSummary[]>> {
    return this.request(`/clinical-data/conditions${options?.includeInactive ? '?includeInactive=true' : ''}`);
  }
  getAllergiesResponse(options?: { includeInactive?: boolean }): Promise<ResponseEnvelope<AllergySummary[]>> {
    return this.request(`/clinical-data/allergies${options?.includeInactive ? '?includeInactive=true' : ''}`);
  }
  getMedicationsResponse(options?: { includeInactive?: boolean }): Promise<ResponseEnvelope<MedicationSummary[]>> {
    return this.request(`/clinical-data/medications${options?.includeInactive ? '?includeInactive=true' : ''}`);
  }
  getVitalsResponse(): Promise<ResponseEnvelope<VitalSummary[]>> {
    return this.request('/clinical-data/vitals');
  }
  getAppointmentsResponse(): Promise<ResponseEnvelope<AppointmentSummary[]>> {
    return this.request('/clinical-data/appointments');
  }
  getEncountersResponse(filters?: {
    appointmentId?: string;
    date?: string;
  }): Promise<ResponseEnvelope<EncounterSummary[]>> {
    const params = new URLSearchParams();
    if (filters?.appointmentId) params.set('appointmentId', filters.appointmentId);
    if (filters?.date) params.set('date', filters.date);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/clinical-data/encounters${query}`);
  }

  // ── Care Plans ───────────────────────────────────────────
  async getCarePlan(id: string): Promise<CarePlan> {
    return this.request(`/care-plans/${id}`);
  }

  /**
   * Latest care plan for the cookie-bound session's (patient, encounter).
   * Returns `null` when nothing exists for this context — that's the signal
   * for the analysis page to render the "Generate" empty state.
   */
  async getCurrentCarePlan(): Promise<CarePlan | null> {
    return this.request('/care-plans/current');
  }

  async getCarePlans(patientFilter?: 'current'): Promise<CarePlan[]> {
    const query = patientFilter ? `?patientId=${patientFilter}` : '';
    return this.request(`/care-plans${query}`);
  }

  async createCarePlan(data: { title: string; cards: CdsCard[]; providerName?: string }): Promise<CarePlan> {
    return this.request('/care-plans', { method: 'POST', body: JSON.stringify(data) });
  }

  async updateCarePlan(id: string, data: { title?: string; cards?: CdsCard[] }): Promise<CarePlan> {
    return this.request(`/care-plans/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  }

  async approveCarePlan(id: string): Promise<CarePlan> {
    return this.request(`/care-plans/${id}/approve`, { method: 'POST' });
  }

  async completeCarePlan(id: string): Promise<CarePlan> {
    return this.request(`/care-plans/${id}/complete`, { method: 'POST' });
  }

  async revokeCarePlan(id: string, reason: string): Promise<CarePlan> {
    return this.request(`/care-plans/${id}/revoke`, { method: 'POST', body: JSON.stringify({ reason }) });
  }

  async deleteCarePlan(id: string): Promise<void> {
    await this.request(`/care-plans/${id}`, { method: 'DELETE' });
  }

  // ── Launcher ────────────────────────────────────────────
  async getLauncherIntegrations(): Promise<{
    ehrs: Array<{
      ehrName: string;
      label: string;
      modes: Array<{
        appType: string;
        integrationId: string;
        sites: Array<{ id: string; name: string; isDefault: boolean }>;
      }>;
      capabilities: Record<string, Record<string, boolean>>;
      carePlan: Record<string, { feasible: boolean; missingRequired: string[]; missingOptional: string[] }>;
    }>;
  }> {
    return this.request('/launcher/integrations');
  }

  // ── Patient Search ──────────────────────────────────────
  async searchPatients(params: { name?: string; birthdate?: string; identifier?: string }): Promise<PatientSummary[]> {
    const query = new URLSearchParams();
    if (params.name) query.set('name', params.name);
    if (params.birthdate) query.set('birthdate', params.birthdate);
    if (params.identifier) query.set('identifier', params.identifier);
    return this.request(`/patients/search?${query.toString()}`);
  }

  async selectPatient(patientId: string): Promise<PatientSummary> {
    return this.request('/patients/select', { method: 'POST', body: JSON.stringify({ patientId }) });
  }

  // ── Clinical Write ──────────────────────────────────────
  //
  // Condition create/update take a lean request shape — the backend
  // ConditionBodyBuilder assembles the FHIR Condition resource. Callers
  // never touch FHIR URIs.

  async createCondition(request: ConditionRequest): Promise<FhirResourceResult> {
    return this.request('/clinical-data/conditions', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async updateCondition(id: string, request: ConditionRequest): Promise<FhirResourceResult> {
    return this.request(`/clinical-data/conditions/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(request),
    });
  }

  async createAllergy(body: Record<string, unknown>): Promise<FhirResourceResult> {
    return this.request('/clinical-data/allergies', { method: 'POST', body: JSON.stringify(body) });
  }

  async createObservation(body: Record<string, unknown>): Promise<FhirResourceResult> {
    return this.request('/clinical-data/observations', { method: 'POST', body: JSON.stringify(body) });
  }

  async createAppointment(body: Record<string, unknown>): Promise<FhirResourceResult> {
    return this.request('/clinical-data/appointments', { method: 'POST', body: JSON.stringify(body) });
  }

  async createEncounter(body: Record<string, unknown>): Promise<FhirResourceResult> {
    return this.request('/clinical-data/encounters', { method: 'POST', body: JSON.stringify(body) });
  }

  // ── Terminology Search ──────────────────────────────────
  //
  // SNOMED + ICD-10 results include cross-mappings so the caller can pick
  // one concept and build a Condition body with BOTH codings in a single
  // step (no extra lookup round-trip).
  //
  // LOINC + RxNorm still return the legacy local-table shape until bridge
  // providers exist for those systems.

  async searchIcd10(q: string, signal?: AbortSignal): Promise<TerminologyConceptWithMappings[]> {
    return this.request(`/terminology/icd10?q=${encodeURIComponent(q)}`, { signal });
  }

  async searchSnomed(q: string, signal?: AbortSignal): Promise<TerminologyConceptWithMappings[]> {
    return this.request(`/terminology/snomed?q=${encodeURIComponent(q)}`, { signal });
  }

  async searchLoinc(q: string, signal?: AbortSignal): Promise<LocalTerminologyCode[]> {
    return this.request(`/terminology/loinc?q=${encodeURIComponent(q)}`, { signal });
  }

  async searchRxnorm(q: string, signal?: AbortSignal): Promise<LocalTerminologyCode[]> {
    return this.request(`/terminology/rxnorm?q=${encodeURIComponent(q)}`, { signal });
  }

  async exportCarePlanPdf(id: string): Promise<{ downloadUrl: string; storageKey: string; expiresAt: string }> {
    return this.request(`/care-plans/${id}/export-pdf`, { method: 'POST' });
  }
}

/** Singleton — no session ID needed, cookie handles auth */
export const cdsApi = new CdsApiClient();

import { BaseEhrService, TokenResult } from '../../core';
import type { EhrResponse } from '../../core';
import type { EhrClientConfig } from '../../core';
import { httpClient } from '@hs/infra';
import type {
  AthenaAppointment,
  AthenaAppointmentResponse,
  AthenaCcdaResponse,
  AthenaDepartmentResponse,
  AthenaEncounter,
  AthenaEncounterResponse,
  AthenaPatient,
  AthenaPatientResponse,
  AthenaTokenPayload,
} from './athena.types';

// ---------------------------------------------------------------------------
// AthenaService — raw API wrappers for athenahealth
//
// Methods do NOT transform params or responses. They make the authenticated
// HTTP call with whatever params they receive and return the raw response.
// ---------------------------------------------------------------------------

class AthenaService extends BaseEhrService {
  readonly ehrName = 'athenanet';

  // =========================================================================
  // Auth
  // =========================================================================

  async getToken(payload: unknown): Promise<TokenResult> {
    try {
      const { grantType, clientId, clientSecret, scope } = payload as AthenaTokenPayload;
      const data = new URLSearchParams();
      data.append('grant_type', grantType || 'client_credentials');
      if (scope) data.append('scope', scope);
      const baseUrl = this.getResolvedAuthUrl(payload as any);

      const requestOptions: any = {
        url: baseUrl,
        method: 'post',
        data,
        contentType: 'application/x-www-form-urlencoded',
      };

      if (clientSecret) {
        // Confidential app — use Basic auth
        const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
        requestOptions.authType = 'Basic';
        requestOptions.authToken = basicAuth;
      } else {
        // Public app — send client_id in body
        data.append('client_id', clientId);
      }

      const response = await httpClient.request<any>(requestOptions);
      return { accessToken: response?.data?.access_token, expiresIn: response?.data?.expires_in - 30 };
    } catch (error: unknown) {
      throw this.handleAuthError(error);
    }
  }

  // =========================================================================
  // Helpers
  // =========================================================================

  /** Resolve base URL and accountId from config */
  private resolveEhr(config: EhrClientConfig): { baseUrl: string; accountId: string } {
    const connectionData = this.buildConnectionData(config, null);
    return {
      baseUrl: this.getResolvedBaseUrl(connectionData),
      accountId: (connectionData.accountId as string) ?? '',
    };
  }

  // =========================================================================
  // Patient — FHIR R4
  // =========================================================================

  /** GET {base}/fhir/r4/Patient — FHIR patient search */
  async fhirPatientSearch(config: EhrClientConfig, params?: Record<string, unknown>): Promise<EhrResponse> {
    return this.makeAuthenticatedRequest(config, {
      url: `${this.resolveEhr(config).baseUrl}/fhir/r4/Patient`,
      method: 'get',
      params,
    });
  }

  /** GET {base}/fhir/r4/Patient/{id} — FHIR patient read */
  async getPatientByFhirId(config: EhrClientConfig, id: string): Promise<EhrResponse> {
    return this.makeAuthenticatedRequest(config, {
      url: `${this.resolveEhr(config).baseUrl}/fhir/r4/Patient/${id}`,
      method: 'get',
    });
  }

  // =========================================================================
  // Patient — Proprietary API
  // =========================================================================

  /** GET {base}/v1/{accountId}/patients — proprietary patient search */
  async searchPatients(
    config: EhrClientConfig,
    params?: Record<string, unknown>,
  ): Promise<EhrResponse<AthenaPatientResponse>> {
    const { baseUrl, accountId } = this.resolveEhr(config);
    return this.makeAuthenticatedRequest<AthenaPatientResponse>(config, {
      url: `${baseUrl}/v1/${accountId}/patients`,
      method: 'get',
      params,
    });
  }

  /** GET {base}/v1/{accountId}/patients/enhancedbestmatch — enhanced patient match */
  async enhancedBestMatch(
    config: EhrClientConfig,
    params?: Record<string, unknown>,
  ): Promise<EhrResponse<AthenaPatient[]>> {
    const { baseUrl, accountId } = this.resolveEhr(config);
    return this.makeAuthenticatedRequest<AthenaPatient[]>(config, {
      url: `${baseUrl}/v1/${accountId}/patients/enhancedbestmatch`,
      method: 'get',
      params,
    });
  }

  /** GET {base}/v1/{accountId}/patients/{patientId} — get patient by proprietary ID */
  async getPatientById(
    config: EhrClientConfig,
    patientId: string,
    params?: Record<string, unknown>,
  ): Promise<EhrResponse<AthenaPatient[]>> {
    const { baseUrl, accountId } = this.resolveEhr(config);
    return this.makeAuthenticatedRequest<AthenaPatient[]>(config, {
      url: `${baseUrl}/v1/${accountId}/patients/${patientId}`,
      method: 'get',
      params,
    });
  }

  /** POST {base}/v1/{accountId}/patients — create patient (proprietary) */
  async createPatient(config: EhrClientConfig, body: unknown): Promise<EhrResponse> {
    const { baseUrl, accountId } = this.resolveEhr(config);
    return this.makeAuthenticatedRequest(config, {
      url: `${baseUrl}/v1/${accountId}/patients`,
      method: 'post',
      data: body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  }

  // =========================================================================
  // AllergyIntolerance — FHIR R4
  // =========================================================================

  /** GET {base}/fhir/r4/AllergyIntolerance — search allergies */
  async searchAllergies(config: EhrClientConfig, params?: Record<string, unknown>): Promise<EhrResponse> {
    return this.makeAuthenticatedRequest(config, {
      url: `${this.resolveEhr(config).baseUrl}/fhir/r4/AllergyIntolerance`,
      method: 'get',
      params,
    });
  }

  /** GET {base}/fhir/r4/AllergyIntolerance/{id} — get allergy by FHIR ID */
  async getAllergyByFhirId(config: EhrClientConfig, id: string): Promise<EhrResponse> {
    return this.makeAuthenticatedRequest(config, {
      url: `${this.resolveEhr(config).baseUrl}/fhir/r4/AllergyIntolerance/${id}`,
      method: 'get',
    });
  }

  // =========================================================================
  // AllergyIntolerance — Proprietary API
  // =========================================================================

  /** PUT {base}/v1/{accountId}/chart/{patientId}/allergies — create/update allergy */
  async putChartAllergy(config: EhrClientConfig, patientId: string, body: unknown): Promise<EhrResponse> {
    const { baseUrl, accountId } = this.resolveEhr(config);
    return this.makeAuthenticatedRequest(config, {
      url: `${baseUrl}/v1/${accountId}/chart/${patientId}/allergies`,
      method: 'put',
      data: body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  }

  // =========================================================================
  // Appointment — Proprietary API
  // =========================================================================

  /** GET {base}/v1/{accountId}/appointments/booked — practice-wide appointments */
  async getBookedAppointments(
    config: EhrClientConfig,
    params?: Record<string, unknown>,
  ): Promise<EhrResponse<AthenaAppointmentResponse>> {
    const { baseUrl, accountId } = this.resolveEhr(config);
    return this.makeAuthenticatedRequest<AthenaAppointmentResponse>(config, {
      url: `${baseUrl}/v1/${accountId}/appointments/booked`,
      method: 'get',
      params,
    });
  }

  /** GET {base}/v1/{accountId}/appointments/booked/multipledepartment — multi-dept appointments */
  async getMultiDeptAppointments(
    config: EhrClientConfig,
    params?: Record<string, unknown>,
  ): Promise<EhrResponse<AthenaAppointmentResponse>> {
    const { baseUrl, accountId } = this.resolveEhr(config);
    return this.makeAuthenticatedRequest<AthenaAppointmentResponse>(config, {
      url: `${baseUrl}/v1/${accountId}/appointments/booked/multipledepartment`,
      method: 'get',
      params,
    });
  }

  /** GET {base}/v1/{accountId}/appointments/{appointmentId} — single appointment */
  async getAppointmentById(
    config: EhrClientConfig,
    appointmentId: string,
    params?: Record<string, unknown>,
  ): Promise<EhrResponse<AthenaAppointment[]>> {
    const { baseUrl, accountId } = this.resolveEhr(config);
    return this.makeAuthenticatedRequest<AthenaAppointment[]>(config, {
      url: `${baseUrl}/v1/${accountId}/appointments/${appointmentId}`,
      method: 'get',
      params,
    });
  }

  // =========================================================================
  // Encounter — Proprietary API
  // =========================================================================

  /** GET {base}/v1/{accountId}/chart/{patientId}/encounters — patient encounters */
  async getPatientEncounters(
    config: EhrClientConfig,
    patientId: string,
    params?: Record<string, unknown>,
  ): Promise<EhrResponse<AthenaEncounterResponse>> {
    const { baseUrl, accountId } = this.resolveEhr(config);
    return this.makeAuthenticatedRequest<AthenaEncounterResponse>(config, {
      url: `${baseUrl}/v1/${accountId}/chart/${patientId}/encounters`,
      method: 'get',
      params,
    });
  }

  /** GET {base}/v1/{accountId}/chart/encounter/{encounterId} — single encounter */
  async getEncounterById(config: EhrClientConfig, encounterId: string): Promise<EhrResponse<AthenaEncounter[]>> {
    const { baseUrl, accountId } = this.resolveEhr(config);
    return this.makeAuthenticatedRequest<AthenaEncounter[]>(config, {
      url: `${baseUrl}/v1/${accountId}/chart/encounter/${encounterId}`,
      method: 'get',
    });
  }

  /** GET {base}/v1/{accountId}/chart/encounter/{encounterId}/diagnoses — encounter diagnoses */
  async getEncounterDiagnoses(config: EhrClientConfig, encounterId: string): Promise<EhrResponse> {
    const { baseUrl, accountId } = this.resolveEhr(config);
    return this.makeAuthenticatedRequest(config, {
      url: `${baseUrl}/v1/${accountId}/chart/encounter/${encounterId}/diagnoses`,
      method: 'get',
    });
  }

  /** POST {base}/v1/{accountId}/chart/encounter/{encounterId}/diagnoses — create diagnosis */
  async createEncounterDiagnosis(config: EhrClientConfig, encounterId: string, body: unknown): Promise<EhrResponse> {
    const { baseUrl, accountId } = this.resolveEhr(config);
    return this.makeAuthenticatedRequest(config, {
      url: `${baseUrl}/v1/${accountId}/chart/encounter/${encounterId}/diagnoses`,
      method: 'post',
      data: body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  }

  /** PUT {base}/v1/{accountId}/chart/encounter/{encounterId}/diagnoses/{diagnosisId} — update diagnosis */
  async updateEncounterDiagnosis(
    config: EhrClientConfig,
    encounterId: string,
    diagnosisId: string,
    body: unknown,
  ): Promise<EhrResponse> {
    const { baseUrl, accountId } = this.resolveEhr(config);
    return this.makeAuthenticatedRequest(config, {
      url: `${baseUrl}/v1/${accountId}/chart/encounter/${encounterId}/diagnoses/${diagnosisId}`,
      method: 'put',
      data: body,
    });
  }

  // =========================================================================
  // Coverage / Insurance — Proprietary API
  // =========================================================================

  /** GET {base}/v1/{accountId}/patients/{patientId}/insurances — patient insurances */
  async getPatientInsurances(config: EhrClientConfig, patientId: string): Promise<EhrResponse> {
    const { baseUrl, accountId } = this.resolveEhr(config);
    return this.makeAuthenticatedRequest(config, {
      url: `${baseUrl}/v1/${accountId}/patients/${patientId}/insurances`,
      method: 'get',
    });
  }

  /** POST {base}/v1/{accountId}/patients/{patientId}/insurances — create insurance */
  async createPatientInsurance(config: EhrClientConfig, patientId: string, body: unknown): Promise<EhrResponse> {
    const { baseUrl, accountId } = this.resolveEhr(config);
    return this.makeAuthenticatedRequest(config, {
      url: `${baseUrl}/v1/${accountId}/patients/${patientId}/insurances`,
      method: 'post',
      data: body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  }

  // =========================================================================
  // Condition — FHIR R4
  // =========================================================================

  /** GET {base}/fhir/r4/Condition — search conditions */
  async searchConditions(config: EhrClientConfig, params?: Record<string, unknown>): Promise<EhrResponse> {
    return this.makeAuthenticatedRequest(config, {
      url: `${this.resolveEhr(config).baseUrl}/fhir/r4/Condition`,
      method: 'get',
      params,
    });
  }

  /** GET {base}/fhir/r4/Condition/{id} — get condition by FHIR ID */
  async getConditionByFhirId(config: EhrClientConfig, id: string): Promise<EhrResponse> {
    return this.makeAuthenticatedRequest(config, {
      url: `${this.resolveEhr(config).baseUrl}/fhir/r4/Condition/${id}`,
      method: 'get',
    });
  }

  // =========================================================================
  // Condition / Problems — Proprietary API
  // =========================================================================

  /** GET {base}/v1/{accountId}/chart/{patientId}/problems — chart problems */
  async getChartProblems(
    config: EhrClientConfig,
    patientId: string,
    params?: Record<string, unknown>,
  ): Promise<EhrResponse> {
    const { baseUrl, accountId } = this.resolveEhr(config);
    return this.makeAuthenticatedRequest(config, {
      url: `${baseUrl}/v1/${accountId}/chart/${patientId}/problems`,
      method: 'get',
      params,
    });
  }

  /** POST {base}/v1/{accountId}/chart/{patientId}/problems — create problem */
  async createProblem(config: EhrClientConfig, patientId: string, body: unknown): Promise<EhrResponse> {
    const { baseUrl, accountId } = this.resolveEhr(config);
    return this.makeAuthenticatedRequest(config, {
      url: `${baseUrl}/v1/${accountId}/chart/${patientId}/problems`,
      method: 'post',
      data: body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  }

  /** PUT {base}/v1/{accountId}/chart/{patientId}/problems/{problemId} — update problem */
  async updateProblem(
    config: EhrClientConfig,
    patientId: string,
    problemId: string,
    body: unknown,
  ): Promise<EhrResponse> {
    const { baseUrl, accountId } = this.resolveEhr(config);
    return this.makeAuthenticatedRequest(config, {
      url: `${baseUrl}/v1/${accountId}/chart/${patientId}/problems/${problemId}`,
      method: 'put',
      data: body,
    });
  }

  /** PUT {base}/v1/{accountId}/chart/{patientId}/problems/sectionnote — problem section note */
  async putProblemSectionNote(config: EhrClientConfig, patientId: string, body: unknown): Promise<EhrResponse> {
    const { baseUrl, accountId } = this.resolveEhr(config);
    return this.makeAuthenticatedRequest(config, {
      url: `${baseUrl}/v1/${accountId}/chart/${patientId}/problems/sectionnote`,
      method: 'put',
      data: body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  }

  // =========================================================================
  // Practitioner — FHIR R4
  // =========================================================================

  /** GET {base}/fhir/r4/Practitioner — search practitioners (FHIR) */
  async searchPractitioners(config: EhrClientConfig, params?: Record<string, unknown>): Promise<EhrResponse> {
    return this.makeAuthenticatedRequest(config, {
      url: `${this.resolveEhr(config).baseUrl}/fhir/r4/Practitioner`,
      method: 'get',
      params,
    });
  }

  /** GET {base}/fhir/r4/Practitioner/{id} — get practitioner by FHIR ID */
  async getPractitionerByFhirId(config: EhrClientConfig, id: string): Promise<EhrResponse> {
    return this.makeAuthenticatedRequest(config, {
      url: `${this.resolveEhr(config).baseUrl}/fhir/r4/Practitioner/${id}`,
      method: 'get',
    });
  }

  // =========================================================================
  // Practitioner — Proprietary API
  // =========================================================================

  /** GET {base}/v1/{accountId}/providers — search providers (proprietary) */
  async searchProviders(config: EhrClientConfig, params?: Record<string, unknown>): Promise<EhrResponse> {
    const { baseUrl, accountId } = this.resolveEhr(config);
    return this.makeAuthenticatedRequest(config, {
      url: `${baseUrl}/v1/${accountId}/providers`,
      method: 'get',
      params,
    });
  }

  // =========================================================================
  // Observation — FHIR R4
  // =========================================================================

  /** GET {base}/fhir/r4/Observation — search observations */
  async searchObservations(config: EhrClientConfig, params?: Record<string, unknown>): Promise<EhrResponse> {
    return this.makeAuthenticatedRequest(config, {
      url: `${this.resolveEhr(config).baseUrl}/fhir/r4/Observation`,
      method: 'get',
      params,
    });
  }

  /** GET {base}/fhir/r4/Observation/{id} — get observation by FHIR ID */
  async getObservationByFhirId(
    config: EhrClientConfig,
    id: string,
    params?: Record<string, unknown>,
  ): Promise<EhrResponse> {
    return this.makeAuthenticatedRequest(config, {
      url: `${this.resolveEhr(config).baseUrl}/fhir/r4/Observation/${id}`,
      method: 'get',
      params,
    });
  }

  // =========================================================================
  // ServiceRequest — FHIR R4
  // =========================================================================

  /** GET {base}/fhir/r4/ServiceRequest — search service requests */
  async searchServiceRequests(config: EhrClientConfig, params?: Record<string, unknown>): Promise<EhrResponse> {
    return this.makeAuthenticatedRequest(config, {
      url: `${this.resolveEhr(config).baseUrl}/fhir/r4/ServiceRequest`,
      method: 'get',
      params,
    });
  }

  /** GET {base}/fhir/r4/ServiceRequest/{id} — get service request by FHIR ID */
  async getServiceRequestByFhirId(config: EhrClientConfig, id: string): Promise<EhrResponse> {
    return this.makeAuthenticatedRequest(config, {
      url: `${this.resolveEhr(config).baseUrl}/fhir/r4/ServiceRequest/${id}`,
      method: 'get',
    });
  }

  // =========================================================================
  // Communication / Chart Alert — Proprietary API
  // =========================================================================

  /** GET {base}/v1/{accountId}/patients/{patientId}/chartalert — get chart alerts */
  async getChartAlerts(
    config: EhrClientConfig,
    patientId: string,
    params?: Record<string, unknown>,
  ): Promise<EhrResponse> {
    const { baseUrl, accountId } = this.resolveEhr(config);
    return this.makeAuthenticatedRequest(config, {
      url: `${baseUrl}/v1/${accountId}/patients/${patientId}/chartalert`,
      method: 'get',
      params,
    });
  }

  /** POST {base}/v1/{accountId}/patients/{patientId}/chartalert — create chart alert */
  async createChartAlert(config: EhrClientConfig, patientId: string, body: unknown): Promise<EhrResponse> {
    const { baseUrl, accountId } = this.resolveEhr(config);
    return this.makeAuthenticatedRequest(config, {
      url: `${baseUrl}/v1/${accountId}/patients/${patientId}/chartalert`,
      method: 'post',
      data: body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  }

  // =========================================================================
  // DocumentReference — FHIR R4
  // =========================================================================

  /** GET {base}/fhir/r4/DocumentReference — search document references */
  async searchDocumentReferences(config: EhrClientConfig, params?: Record<string, unknown>): Promise<EhrResponse> {
    return this.makeAuthenticatedRequest(config, {
      url: `${this.resolveEhr(config).baseUrl}/fhir/r4/DocumentReference`,
      method: 'get',
      params,
    });
  }

  /** GET {base}/fhir/r4/DocumentReference/{id} — get document reference by FHIR ID */
  async getDocumentReferenceByFhirId(config: EhrClientConfig, id: string): Promise<EhrResponse> {
    return this.makeAuthenticatedRequest(config, {
      url: `${this.resolveEhr(config).baseUrl}/fhir/r4/DocumentReference/${id}`,
      method: 'get',
    });
  }

  // =========================================================================
  // DocumentReference — Proprietary API
  // =========================================================================

  /** POST {base}/v1/{accountId}/patients/{patientId}/documents/encounterdocument — create encounter document */
  async createEncounterDocument(config: EhrClientConfig, patientId: string, body: unknown): Promise<EhrResponse> {
    const { baseUrl, accountId } = this.resolveEhr(config);
    return this.makeAuthenticatedRequest(config, {
      url: `${baseUrl}/v1/${accountId}/patients/${patientId}/documents/encounterdocument`,
      method: 'post',
      data: body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  }

  /** PUT {base}/v1/{accountId}/chart/encounter/{encounterId}/hpi — update HPI note */
  async putEncounterHpi(config: EhrClientConfig, encounterId: string, body: unknown): Promise<EhrResponse> {
    const { baseUrl, accountId } = this.resolveEhr(config);
    return this.makeAuthenticatedRequest(config, {
      url: `${baseUrl}/v1/${accountId}/chart/encounter/${encounterId}/hpi`,
      method: 'put',
      data: body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  }

  /** PUT {base}/v1/{accountId}/chart/encounter/{encounterId}/assessment — update assessment plan */
  async putEncounterAssessment(config: EhrClientConfig, encounterId: string, body: unknown): Promise<EhrResponse> {
    const { baseUrl, accountId } = this.resolveEhr(config);
    return this.makeAuthenticatedRequest(config, {
      url: `${baseUrl}/v1/{accountId}/chart/encounter/${encounterId}/assessment`,
      method: 'put',
      data: body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  }

  // =========================================================================
  // CCDA — Proprietary API
  // =========================================================================

  /** GET {base}/v1/{accountId}/ccda/{patientId}/ccdaexport — export CCDA document */
  async getCcdaExport(
    config: EhrClientConfig,
    patientId: string,
    params?: Record<string, unknown>,
  ): Promise<EhrResponse<AthenaCcdaResponse>> {
    const { baseUrl, accountId } = this.resolveEhr(config);
    return this.makeAuthenticatedRequest<AthenaCcdaResponse>(config, {
      url: `${baseUrl}/v1/${accountId}/ccda/${patientId}/ccdaexport`,
      method: 'get',
      params,
    });
  }

  // =========================================================================
  // Location / Departments — Proprietary API
  // =========================================================================

  /** GET {base}/v1/{accountId}/departments — list departments */
  async getDepartments(
    config: EhrClientConfig,
    params?: Record<string, unknown>,
  ): Promise<EhrResponse<AthenaDepartmentResponse>> {
    const { baseUrl, accountId } = this.resolveEhr(config);
    return this.makeAuthenticatedRequest<AthenaDepartmentResponse>(config, {
      url: `${baseUrl}/v1/${accountId}/departments`,
      method: 'get',
      params,
    });
  }
}

export const athena = new AthenaService();

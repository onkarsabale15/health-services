// nextgen.service.ts
// NextGen EHR vendor service.
//
// NextGen specifics:
//   - FHIR R4 endpoints use enterprise/practice/session headers
//   - Non-FHIR REST API at /nge/prod/nge-api/api/ for appointments, alerts, SOAP notes, etc.
//   - Pagination uses _maxresults / page instead of _count / _getpagesoffset
//   - OData $filter for appointment queries

import { BaseEhrService, EhrError, TokenResult } from '../../core';
import type { EhrResponse } from '../../core';
import type { ConnectionData } from '../../core';
import type { EhrClientConfig } from '../../core/interfaces/ehr-client-config.interface';
import { httpClient } from '@hs/infra';

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface NextgenEhrData {
  baseUrl: string;
  fhirBaseurl: string;
  authToken: string;
  accountId: string;
  tenant: string;
  sessionId: string;
}

// Session ID used as the x-ng-sessionid header value
const NEXTGEN_SESSION_ID = '';

// ---------------------------------------------------------------------------
// NextgenService
// ---------------------------------------------------------------------------

class NextgenService extends BaseEhrService {
  readonly ehrName = 'nextgen';

  async getToken(payload: any): Promise<TokenResult> {
    try {
      const { clientId, clientSecret, siteId, grantType } = payload;
      if (!siteId || !grantType || !clientId) {
        throw new Error(JSON.stringify({ code: 400, message: 'clientId, siteId, grantType are required' }));
      }
      const data = new URLSearchParams();
      data.append('client_id', clientId);
      if (clientSecret) {
        data.append('client_secret', clientSecret);
      }
      data.append('site_id', siteId);
      data.append('grant_type', grantType);
      const baseUrl = this.getResolvedAuthUrl(payload);
      const response = await httpClient.request<any>({
        url: baseUrl,
        data,
        method: 'post',
        contentType: 'application/x-www-form-urlencoded',
      });
      return { accessToken: response?.data?.access_token, expiresIn: response?.data?.expires_in - 30 };
    } catch (error: any) {
      throw this.handleAuthError(error);
    }
  }

  // -- Connection helpers ---------------------------------------------------

  private getEhrParams(connectionData: ConnectionData): NextgenEhrData {
    const baseUrl = this.getResolvedBaseUrl(connectionData);
    const fhirBaseurl = this.getResolvedExtraUrl(connectionData, 'fhirBaseUrl') ?? '';
    return {
      baseUrl,
      fhirBaseurl,
      authToken: connectionData.accessToken,
      accountId: (connectionData as any).accountId ?? '',
      tenant: (connectionData as any).tenant ?? '',
      sessionId: NEXTGEN_SESSION_ID,
    };
  }

  /** Standard FHIR headers required by NextGen's FHIR R4 surface */
  private fhirHeaders(ehrData: NextgenEhrData): Record<string, string> {
    return {
      'x-enterprise-id': ehrData.accountId,
      'x-practice-id': ehrData.tenant,
      'x-ng-sessionid': ehrData.sessionId,
    };
  }

  /** Headers for NextGen non-FHIR REST API (session only, no enterprise/practice) */
  private restHeaders(ehrData: NextgenEhrData): Record<string, string> {
    return {
      'x-ng-sessionid': ehrData.sessionId,
    };
  }

  // =========================================================================
  // Patient
  // =========================================================================

  /** FHIR R4 Patient search */
  async fhirPatientSearch(params: Record<string, any>, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const ehrData = this.getEhrParams(conn);
      const response = await this.makeAuthenticatedRequest(config, {
        url: `${ehrData.fhirBaseurl}/Patient`,
        method: 'get',
        params,
        headers: this.fhirHeaders(ehrData),
      });
      return { statusCode: 200, data: response?.data };
    } catch (error: any) {
      throw error;
    }
  }

  /** FHIR R4 Patient read by ID */
  async getPatientById(id: string, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const ehrData = this.getEhrParams(conn);
      const response = await this.makeAuthenticatedRequest(config, {
        url: `${ehrData.fhirBaseurl}/Patient/${id}`,
        method: 'get',
        headers: this.fhirHeaders(ehrData),
      });
      return { statusCode: 200, data: response?.data };
    } catch (error: any) {
      throw error;
    }
  }

  /** Create a person via NextGen native REST API */
  async nativePersonCreate(data: Record<string, any>, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const ehrData = this.getEhrParams(conn);
      const response = await this.makeAuthenticatedRequest(config, {
        url: `${ehrData.baseUrl}/nge/prod/nge-api/api/persons`,
        method: 'post',
        data,
        headers: this.restHeaders(ehrData),
      });
      return { statusCode: 201, data: response?.data, headers: response?.headers };
    } catch (error: any) {
      throw error;
    }
  }

  // =========================================================================
  // Allergies
  // =========================================================================

  /** FHIR R4 AllergyIntolerance search */
  async fhirAllergySearch(params: Record<string, any>, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const ehrData = this.getEhrParams(conn);
      const response = await this.makeAuthenticatedRequest(config, {
        url: `${ehrData.fhirBaseurl}/AllergyIntolerance`,
        method: 'get',
        params,
        headers: this.fhirHeaders(ehrData),
      });
      return { statusCode: 200, data: response?.data };
    } catch (error: any) {
      throw error;
    }
  }

  /** FHIR R4 AllergyIntolerance read by ID */
  async getAllergyById(id: string, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const ehrData = this.getEhrParams(conn);
      const response = await this.makeAuthenticatedRequest(config, {
        url: `${ehrData.fhirBaseurl}/AllergyIntolerance/${id}`,
        method: 'get',
        headers: this.fhirHeaders(ehrData),
      });
      return { statusCode: 200, data: response?.data };
    } catch (error: any) {
      throw error;
    }
  }

  // =========================================================================
  // Appointments (NextGen native REST API)
  // =========================================================================

  /** Search appointments via NextGen native REST API (optionally scoped to a person) */
  async nativeAppointmentSearch(params: Record<string, any>, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const ehrData = this.getEhrParams(conn);
      const { personId, ...rest } = params;

      let apiUrl: string;
      if (personId) {
        apiUrl = `${ehrData.baseUrl}/nge/prod/nge-api/api/persons/${personId}/appointments`;
      } else {
        apiUrl = `${ehrData.baseUrl}/nge/prod/nge-api/api/appointments`;
      }

      const response = await this.makeAuthenticatedRequest(config, {
        url: apiUrl,
        method: 'get',
        params: rest,
        headers: this.restHeaders(ehrData),
      });
      return { statusCode: 200, data: response?.data };
    } catch (error: any) {
      throw error;
    }
  }

  /** Get a single appointment by ID via NextGen native REST API */
  async getAppointmentById(id: string, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const ehrData = this.getEhrParams(conn);
      const response = await this.makeAuthenticatedRequest(config, {
        url: `${ehrData.baseUrl}/nge/prod/nge-api/api/appointments/${id}`,
        method: 'get',
        headers: this.restHeaders(ehrData),
      });
      return { statusCode: 200, data: response?.data };
    } catch (error: any) {
      throw error;
    }
  }

  // =========================================================================
  // Encounters
  // =========================================================================

  /** FHIR R4 Encounter search */
  async fhirEncounterSearch(params: Record<string, any>, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const ehrData = this.getEhrParams(conn);
      const response = await this.makeAuthenticatedRequest(config, {
        url: `${ehrData.fhirBaseurl}/Encounter`,
        method: 'get',
        params,
        headers: {
          ...this.fhirHeaders(ehrData),
          'x-person-id': params?._id ?? null,
        },
      });
      return { statusCode: 200, data: response?.data };
    } catch (error: any) {
      throw error;
    }
  }

  /** FHIR R4 Encounter read by ID */
  async getEncounterById(id: string, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const ehrData = this.getEhrParams(conn);
      const response = await this.makeAuthenticatedRequest(config, {
        url: `${ehrData.fhirBaseurl}/Encounter/${id}`,
        method: 'get',
        headers: this.fhirHeaders(ehrData),
      });
      return { statusCode: 200, data: response?.data };
    } catch (error: any) {
      throw error;
    }
  }

  // =========================================================================
  // Coverage
  // =========================================================================

  /** FHIR R4 Coverage search */
  async fhirCoverageSearch(params: Record<string, any>, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const ehrData = this.getEhrParams(conn);
      const response = await this.makeAuthenticatedRequest(config, {
        url: `${ehrData.fhirBaseurl}/Coverage`,
        method: 'get',
        params,
        headers: this.fhirHeaders(ehrData),
      });
      return { statusCode: 200, data: response?.data };
    } catch (error: any) {
      throw error;
    }
  }

  /** FHIR R4 Coverage read by ID */
  async getCoverageById(id: string, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const ehrData = this.getEhrParams(conn);
      const response = await this.makeAuthenticatedRequest(config, {
        url: `${ehrData.fhirBaseurl}/Coverage/${id}`,
        method: 'get',
        headers: this.fhirHeaders(ehrData),
      });
      return { statusCode: 200, data: response?.data };
    } catch (error: any) {
      throw error;
    }
  }

  /** Create insurance via NextGen native REST API */
  async nativeInsuranceCreate(
    personId: string,
    data: Record<string, any>,
    config: EhrClientConfig,
  ): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const ehrData = this.getEhrParams(conn);
      const response = await this.makeAuthenticatedRequest(config, {
        url: `${ehrData.baseUrl}/nge/prod/nge-api/api/persons/${personId}/insurances`,
        method: 'post',
        data,
        headers: this.restHeaders(ehrData),
      });
      return { statusCode: 201, data: response?.data, headers: response?.headers };
    } catch (error: any) {
      throw error;
    }
  }

  // =========================================================================
  // Conditions / Problems
  // =========================================================================

  /** FHIR R4 Condition search */
  async fhirConditionSearch(params: Record<string, any>, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const ehrData = this.getEhrParams(conn);
      const response = await this.makeAuthenticatedRequest(config, {
        url: `${ehrData.fhirBaseurl}/Condition`,
        method: 'get',
        params,
        headers: this.fhirHeaders(ehrData),
      });
      return { statusCode: 200, data: response?.data };
    } catch (error: any) {
      throw error;
    }
  }

  /** FHIR R4 Condition read by ID */
  async getConditionById(id: string, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const ehrData = this.getEhrParams(conn);
      const response = await this.makeAuthenticatedRequest(config, {
        url: `${ehrData.fhirBaseurl}/Condition/${id}`,
        method: 'get',
        headers: this.fhirHeaders(ehrData),
      });
      return { statusCode: 200, data: response?.data };
    } catch (error: any) {
      throw error;
    }
  }

  /** FHIR R4 Condition update by ID */
  async updateCondition(config: EhrClientConfig, id: string, data: Record<string, any>): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const ehrData = this.getEhrParams(conn);
      const response = await this.makeAuthenticatedRequest(config, {
        url: `${ehrData.fhirBaseurl}/Condition/${id}`,
        method: 'put',
        data,
        headers: this.fhirHeaders(ehrData),
      });
      return { statusCode: 200, data: response?.data };
    } catch (error: any) {
      throw error;
    }
  }

  /** Create a problem via NextGen native REST API */
  async nativeProblemCreate(
    personId: string,
    data: Record<string, any>,
    config: EhrClientConfig,
  ): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const ehrData = this.getEhrParams(conn);
      const response = await this.makeAuthenticatedRequest(config, {
        url: `${ehrData.baseUrl}/nge/prod/nge-api/api/persons/${personId}/chart/problems`,
        method: 'post',
        data,
        headers: this.restHeaders(ehrData),
      });
      return { statusCode: 201, data: response?.data, headers: response?.headers };
    } catch (error: any) {
      throw error;
    }
  }

  /** Create a diagnosis on an encounter via NextGen native REST API */
  async nativeDiagnosisCreate(
    personId: string,
    encounterId: string,
    data: Record<string, any>,
    config: EhrClientConfig,
  ): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const ehrData = this.getEhrParams(conn);
      const response = await this.makeAuthenticatedRequest(config, {
        url: `${ehrData.baseUrl}/nge/prod/nge-api/api/persons/${personId}/chart/encounters/${encounterId}/diagnoses`,
        method: 'post',
        data,
        headers: this.restHeaders(ehrData),
      });
      return { statusCode: 201, data: response?.data, headers: response?.headers };
    } catch (error: any) {
      throw error;
    }
  }

  /** Create a diagnosis assessment on an encounter via NextGen native REST API */
  async nativeDiagnosisAssessmentCreate(
    personId: string,
    encounterId: string,
    diagnosisId: string,
    data: Record<string, any>,
    config: EhrClientConfig,
  ): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const ehrData = this.getEhrParams(conn);
      const response = await this.makeAuthenticatedRequest(config, {
        url: `${ehrData.baseUrl}/nge/prod/nge-api/api/persons/${personId}/chart/encounters/${encounterId}/diagnoses/${diagnosisId}/assessments`,
        method: 'post',
        data,
        headers: this.restHeaders(ehrData),
      });
      return { statusCode: 201, data: response?.data, headers: response?.headers };
    } catch (error: any) {
      throw error;
    }
  }

  // =========================================================================
  // Practitioners
  // =========================================================================

  /** FHIR R4 Practitioner search */
  async fhirPractitionerSearch(params: Record<string, any>, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const ehrData = this.getEhrParams(conn);
      const response = await this.makeAuthenticatedRequest(config, {
        url: `${ehrData.fhirBaseurl}/Practitioner`,
        method: 'get',
        params,
        headers: this.fhirHeaders(ehrData),
      });
      return { statusCode: 200, data: response?.data };
    } catch (error: any) {
      throw error;
    }
  }

  /** FHIR R4 Practitioner read by ID */
  async getPractitionerById(id: string, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const ehrData = this.getEhrParams(conn);
      const response = await this.makeAuthenticatedRequest(config, {
        url: `${ehrData.fhirBaseurl}/Practitioner/${id}`,
        method: 'get',
        headers: this.fhirHeaders(ehrData),
      });
      return { statusCode: 200, data: response?.data };
    } catch (error: any) {
      throw error;
    }
  }

  // =========================================================================
  // Observations
  // =========================================================================

  /** FHIR R4 Observation search */
  async fhirObservationSearch(params: Record<string, any>, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const ehrData = this.getEhrParams(conn);
      const response = await this.makeAuthenticatedRequest(config, {
        url: `${ehrData.fhirBaseurl}/Observation`,
        method: 'get',
        params,
        headers: this.fhirHeaders(ehrData),
      });
      return { statusCode: 200, data: response?.data };
    } catch (error: any) {
      throw error;
    }
  }

  /** FHIR R4 Observation read by ID */
  async getObservationById(id: string, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const ehrData = this.getEhrParams(conn);
      const response = await this.makeAuthenticatedRequest(config, {
        url: `${ehrData.fhirBaseurl}/Observation/${id}`,
        method: 'get',
        headers: this.fhirHeaders(ehrData),
      });
      return { statusCode: 200, data: response?.data };
    } catch (error: any) {
      throw error;
    }
  }

  // =========================================================================
  // Service Requests
  // =========================================================================

  /** FHIR R4 ServiceRequest search */
  async fhirServiceRequestSearch(params: Record<string, any>, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const ehrData = this.getEhrParams(conn);
      const response = await this.makeAuthenticatedRequest(config, {
        url: `${ehrData.fhirBaseurl}/ServiceRequest`,
        method: 'get',
        params,
        headers: this.fhirHeaders(ehrData),
      });
      return { statusCode: 200, data: response?.data };
    } catch (error: any) {
      throw error;
    }
  }

  /** FHIR R4 ServiceRequest read by ID */
  async getServiceRequestById(id: string, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const ehrData = this.getEhrParams(conn);
      const response = await this.makeAuthenticatedRequest(config, {
        url: `${ehrData.fhirBaseurl}/ServiceRequest/${id}`,
        method: 'get',
        headers: this.fhirHeaders(ehrData),
      });
      return { statusCode: 200, data: response?.data };
    } catch (error: any) {
      throw error;
    }
  }

  // =========================================================================
  // Medication Statements
  // =========================================================================

  /** FHIR R4 MedicationStatement search */
  async fhirMedicationStatementSearch(params: Record<string, any>, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const ehrData = this.getEhrParams(conn);
      const response = await this.makeAuthenticatedRequest(config, {
        url: `${ehrData.fhirBaseurl}/MedicationStatement`,
        method: 'get',
        params,
        headers: this.fhirHeaders(ehrData),
      });
      return { statusCode: 200, data: response?.data };
    } catch (error: any) {
      throw error;
    }
  }

  /** FHIR R4 MedicationStatement read by ID */
  async getMedicationStatementById(id: string, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const ehrData = this.getEhrParams(conn);
      const response = await this.makeAuthenticatedRequest(config, {
        url: `${ehrData.fhirBaseurl}/MedicationStatement/${id}`,
        method: 'get',
        headers: this.fhirHeaders(ehrData),
      });
      return { statusCode: 200, data: response?.data };
    } catch (error: any) {
      throw error;
    }
  }

  // =========================================================================
  // Communications / Alerts (NextGen native REST API)
  // =========================================================================

  /** Create an alert (Communication) via NextGen native REST API */
  async nativeAlertCreate(personId: string, data: Record<string, any>, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const ehrData = this.getEhrParams(conn);
      const response = await this.makeAuthenticatedRequest(config, {
        url: `${ehrData.baseUrl}/nge/prod/nge-api/api/persons/${personId}/chart/alerts`,
        method: 'post',
        data,
        headers: this.restHeaders(ehrData),
      });
      return { statusCode: 201, data: response?.data, headers: response?.headers };
    } catch (error: any) {
      throw error;
    }
  }

  /** Get alerts for a person via NextGen native REST API */
  async nativeAlertSearch(personId: string, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const ehrData = this.getEhrParams(conn);
      const response = await this.makeAuthenticatedRequest(config, {
        url: `${ehrData.baseUrl}/nge/prod/nge-api/api/persons/${personId}/chart/alerts`,
        method: 'get',
        headers: this.restHeaders(ehrData),
      });
      return { statusCode: 200, data: response?.data };
    } catch (error: any) {
      throw error;
    }
  }

  // =========================================================================
  // Document References / SOAP Notes / Clinical Notes (NextGen native REST API)
  // =========================================================================

  /** Get SOAP notes for an encounter via NextGen native REST API */
  async nativeSoapNoteSearch(personId: string, encounterId: string, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const ehrData = this.getEhrParams(conn);
      const response = await this.makeAuthenticatedRequest(config, {
        url: `${ehrData.baseUrl}/nge/prod/nge-api/api/persons/${personId}/chart/encounters/${encounterId}/soap-notes`,
        method: 'get',
        headers: this.restHeaders(ehrData),
      });
      return { statusCode: 200, data: response?.data };
    } catch (error: any) {
      throw error;
    }
  }

  /** Create a SOAP note on an encounter via NextGen native REST API */
  async nativeSoapNoteCreate(
    personId: string,
    encounterId: string,
    data: Record<string, any>,
    config: EhrClientConfig,
  ): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const ehrData = this.getEhrParams(conn);
      const response = await this.makeAuthenticatedRequest(config, {
        url: `${ehrData.baseUrl}/nge/prod/nge-api/api/persons/${personId}/chart/encounters/${encounterId}/soap-notes`,
        method: 'post',
        data,
        headers: this.restHeaders(ehrData),
      });
      return { statusCode: 201, data: response?.data, headers: response?.headers };
    } catch (error: any) {
      throw error;
    }
  }

  /** Get clinical notes for a person via NextGen native REST API */
  async nativeClinicalNoteSearch(personId: string, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const ehrData = this.getEhrParams(conn);
      const response = await this.makeAuthenticatedRequest(config, {
        url: `${ehrData.baseUrl}/nge/prod/nge-api/api/persons/${personId}/chart/clinical-notes`,
        method: 'get',
        headers: this.restHeaders(ehrData),
      });
      return { statusCode: 200, data: response?.data };
    } catch (error: any) {
      throw error;
    }
  }

  /** Get notes for a specific problem via NextGen native REST API */
  async nativeProblemNoteSearch(personId: string, conditionId: string, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const ehrData = this.getEhrParams(conn);
      const response = await this.makeAuthenticatedRequest(config, {
        url: `${ehrData.baseUrl}/nge/prod/nge-api/api/persons/${personId}/chart/problems/${conditionId}/notes`,
        method: 'get',
        headers: this.restHeaders(ehrData),
      });
      return { statusCode: 200, data: response?.data };
    } catch (error: any) {
      throw error;
    }
  }
}

export const nextgen = new NextgenService();

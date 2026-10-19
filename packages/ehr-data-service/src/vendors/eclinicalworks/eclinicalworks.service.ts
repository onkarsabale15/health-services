// eclinicalworks.service.ts
// eClinicalWorks EHR vendor service.
//
// eClinicalWorks specifics:
//   - Content-Type is 'application/json+fhir' for all reads
//   - All creates are posted as a Transaction Bundle to the base FHIR URL
//   - Base URL contains a {tenant} placeholder filled from connectionData.tenant
//   - MedicationStatement is served via the MedicationRequest endpoint
//   - Encounter search uses custom startDate/endDate params

import { BaseEhrService, TokenResult, JwkSet } from '../../core';
import type { EhrResponse } from '../../core';
import type { ConnectionData } from '../../core';
import type { EhrClientConfig } from '../../core/interfaces/ehr-client-config.interface';
import { httpClient } from '@hs/infra';

/** eCW-specific headers for all FHIR read requests */
const ECW_FHIR_HEADERS = {
  'Content-Type': 'application/json+fhir',
  Accept: 'application/json+fhir',
};

class EClinicalWorksService extends BaseEhrService {
  readonly ehrName = 'eClinicalWorks';

  async getToken(payload: ConnectionData, secrets?: any): Promise<TokenResult> {
    try {
      const { clientId, tenant } = payload;
      if (!tenant) {
        throw new Error(JSON.stringify({ code: 400, message: 'Please pass tenant in the payload' }));
      }
      const baseUrl = this.getResolvedExtraUrl(payload, 'tokenUrl');
      if (!baseUrl) {
        throw new Error('Token URL not configured for eClinicalWorks');
      }
      const jwks = secrets?.JWKS as JwkSet;
      if (!jwks || !jwks.keys || jwks.keys.length === 0) {
        throw new Error('JWKS not configured correctly in secrets.');
      }
      const privateKey = jwks.keys[0];
      const alg = privateKey.alg ?? 'RS256';
      const assertionToken = await this.getJwkSignedToken({
        jwks,
        audience: baseUrl,
        alg,
        issuer: clientId!,
        subject: clientId!,
      });
      const data = new URLSearchParams();
      data.append('grant_type', 'client_credentials');
      data.append('scope', payload.scope ?? '');
      data.append('client_assertion_type', 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer');
      data.append('client_assertion', assertionToken);
      const response = await httpClient.request<any>({
        url: baseUrl,
        data,
        method: 'post',
        contentType: 'application/x-www-form-urlencoded',
      });
      return { accessToken: response.data.access_token, expiresIn: response.data.expires_in - 30 };
    } catch (error: any) {
      throw this.handleAuthError(error);
    }
  }

  // =========================================================================
  // Patient
  // =========================================================================

  /** FHIR Patient search */
  async fhirPatientSearch(params: Record<string, any>, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const baseUrl = this.getResolvedBaseUrl(conn);
      const response = await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}/Patient`,
        method: 'get',
        params,
        headers: ECW_FHIR_HEADERS,
      });
      return { statusCode: response.statusCode, data: response.data };
    } catch (error: any) {
      throw error;
    }
  }

  /** FHIR Patient read by ID */
  async getPatientById(patientId: string, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const baseUrl = this.getResolvedBaseUrl(conn);
      const response = await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}/Patient/${patientId}`,
        method: 'get',
        headers: ECW_FHIR_HEADERS,
      });
      return { statusCode: response.statusCode, data: response.data };
    } catch (error: any) {
      throw error;
    }
  }

  /** Create a FHIR resource via Transaction Bundle POST to the base URL */
  async fhirTransactionCreate(resource: Record<string, any>, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const baseUrl = this.getResolvedBaseUrl(conn);
      const token = await this.getOrCreateToken(config);
      const response = await httpClient.request({
        url: baseUrl,
        method: 'post',
        authType: 'Bearer',
        authToken: token.accessToken,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        data: resource,
      });
      return { statusCode: response.status || 201, data: response.data };
    } catch (error: any) {
      throw error;
    }
  }

  // =========================================================================
  // Coverage
  // =========================================================================

  /** FHIR Coverage search */
  async fhirCoverageSearch(params: Record<string, any>, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const baseUrl = this.getResolvedBaseUrl(conn);
      const response = await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}/Coverage`,
        method: 'get',
        params,
        headers: ECW_FHIR_HEADERS,
      });
      return { statusCode: response.statusCode, data: response.data };
    } catch (error: any) {
      throw error;
    }
  }

  // =========================================================================
  // Encounter
  // =========================================================================

  /** FHIR Encounter search (endpoint may include custom startDate/endDate params) */
  async fhirEncounterSearch(endpoint: string, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const baseUrl = this.getResolvedBaseUrl(conn);
      const response = await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}${endpoint}`,
        method: 'get',
        headers: ECW_FHIR_HEADERS,
      });
      return { statusCode: response.statusCode, data: response.data };
    } catch (error: any) {
      throw error;
    }
  }

  /** FHIR Encounter read by ID */
  async getEncounterById(encounterId: string, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const baseUrl = this.getResolvedBaseUrl(conn);
      const response = await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}/Encounter/${encounterId}`,
        method: 'get',
        headers: ECW_FHIR_HEADERS,
      });
      return { statusCode: response.statusCode, data: response.data };
    } catch (error: any) {
      throw error;
    }
  }

  // =========================================================================
  // Condition
  // =========================================================================

  /** FHIR Condition search */
  async fhirConditionSearch(params: Record<string, any>, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const baseUrl = this.getResolvedBaseUrl(conn);
      const response = await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}/Condition`,
        method: 'get',
        params,
        headers: ECW_FHIR_HEADERS,
      });
      return { statusCode: response.statusCode, data: response.data };
    } catch (error: any) {
      throw error;
    }
  }

  /** FHIR Condition read by ID */
  async getConditionById(conditionId: string, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const baseUrl = this.getResolvedBaseUrl(conn);
      const response = await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}/Condition/${conditionId}`,
        method: 'get',
        headers: ECW_FHIR_HEADERS,
      });
      return { statusCode: response.statusCode, data: response.data };
    } catch (error: any) {
      throw error;
    }
  }

  /** Update a FHIR Condition */
  async updateCondition(config: EhrClientConfig, id: string, data: Record<string, any>): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const baseUrl = this.getResolvedBaseUrl(conn);
      const response = await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}/Condition/${id}`,
        method: 'put',
        data,
        headers: ECW_FHIR_HEADERS,
      });
      return { statusCode: response.statusCode, data: response.data };
    } catch (error: any) {
      throw error;
    }
  }

  // =========================================================================
  // AllergyIntolerance
  // =========================================================================

  /** FHIR AllergyIntolerance search */
  async fhirAllergySearch(params: Record<string, any>, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const baseUrl = this.getResolvedBaseUrl(conn);
      const response = await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}/AllergyIntolerance`,
        method: 'get',
        params,
        headers: ECW_FHIR_HEADERS,
      });
      return { statusCode: response.statusCode, data: response.data };
    } catch (error: any) {
      throw error;
    }
  }

  /** FHIR AllergyIntolerance read by ID */
  async getAllergyById(allergyId: string, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const baseUrl = this.getResolvedBaseUrl(conn);
      const response = await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}/AllergyIntolerance/${allergyId}`,
        method: 'get',
        headers: ECW_FHIR_HEADERS,
      });
      return { statusCode: response.statusCode, data: response.data };
    } catch (error: any) {
      throw error;
    }
  }

  // =========================================================================
  // Practitioner
  // =========================================================================

  /** FHIR Practitioner search */
  async fhirPractitionerSearch(params: Record<string, any>, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const baseUrl = this.getResolvedBaseUrl(conn);
      const response = await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}/Practitioner`,
        method: 'get',
        params,
        headers: ECW_FHIR_HEADERS,
      });
      return { statusCode: response.statusCode, data: response.data };
    } catch (error: any) {
      throw error;
    }
  }

  /** FHIR Practitioner read by ID */
  async getPractitionerById(providerId: string, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const baseUrl = this.getResolvedBaseUrl(conn);
      const response = await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}/Practitioner/${providerId}`,
        method: 'get',
        headers: ECW_FHIR_HEADERS,
      });
      return { statusCode: response.statusCode, data: response.data };
    } catch (error: any) {
      throw error;
    }
  }

  // =========================================================================
  // DocumentReference
  // =========================================================================

  /** FHIR DocumentReference search */
  async fhirDocumentReferenceSearch(params: Record<string, any>, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const baseUrl = this.getResolvedBaseUrl(conn);
      const response = await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}/DocumentReference`,
        method: 'get',
        params,
        headers: ECW_FHIR_HEADERS,
      });
      return { statusCode: response.statusCode, data: response.data };
    } catch (error: any) {
      throw error;
    }
  }

  /** FHIR DocumentReference read by ID */
  async getDocumentReferenceById(docRefId: string, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const baseUrl = this.getResolvedBaseUrl(conn);
      const response = await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}/DocumentReference/${docRefId}`,
        method: 'get',
        headers: ECW_FHIR_HEADERS,
      });
      return { statusCode: response.statusCode, data: response.data };
    } catch (error: any) {
      throw error;
    }
  }

  // =========================================================================
  // Observation
  // =========================================================================

  /** FHIR Observation search */
  async fhirObservationSearch(params: Record<string, any>, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const baseUrl = this.getResolvedBaseUrl(conn);
      const response = await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}/Observation`,
        method: 'get',
        params,
        headers: ECW_FHIR_HEADERS,
      });
      return { statusCode: response.statusCode, data: response.data };
    } catch (error: any) {
      throw error;
    }
  }

  /** FHIR Observation read by ID */
  async getObservationById(observationId: string, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const baseUrl = this.getResolvedBaseUrl(conn);
      const response = await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}/Observation/${observationId}`,
        method: 'get',
        headers: ECW_FHIR_HEADERS,
      });
      return { statusCode: response.statusCode, data: response.data };
    } catch (error: any) {
      throw error;
    }
  }

  // =========================================================================
  // MedicationStatement (maps to MedicationRequest endpoint)
  // =========================================================================

  /** FHIR MedicationRequest search (serves MedicationStatement data) */
  async fhirMedicationRequestSearch(params: Record<string, any>, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const baseUrl = this.getResolvedBaseUrl(conn);
      const response = await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}/MedicationRequest`,
        method: 'get',
        params,
        headers: ECW_FHIR_HEADERS,
      });
      return { statusCode: response.statusCode, data: response.data };
    } catch (error: any) {
      throw error;
    }
  }

  /** FHIR MedicationRequest read by ID (serves MedicationStatement data) */
  async getMedicationRequestById(medicationId: string, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const baseUrl = this.getResolvedBaseUrl(conn);
      const response = await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}/MedicationRequest/${medicationId}`,
        method: 'get',
        headers: ECW_FHIR_HEADERS,
      });
      return { statusCode: response.statusCode, data: response.data };
    } catch (error: any) {
      throw error;
    }
  }
}

export const ecw = new EClinicalWorksService();

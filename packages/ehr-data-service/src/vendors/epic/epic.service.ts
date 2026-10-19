// epic.service.ts
// Epic EHR vendor service — raw API layer.
//
// Each method makes an authenticated HTTP call to the Epic FHIR R4 API
// and returns the raw response. No param filtering or response transformation.

import { BaseEhrService, TokenResult, EhrResponse } from '../../core';
import type { ConnectionData } from '../../core';
import type { EhrClientConfig } from '../../core';
import { httpClient } from '@hs/infra';
import type { Bundle } from '@medplum/fhirtypes';
import type {
  EpicPatient,
  EpicAppointment,
  EpicEncounter,
  EpicCoverage,
  EpicCondition,
  EpicAllergy,
  EpicMedication,
  EpicObservation,
  EpicDocument,
  EpicPractitioner,
} from './epic.types';

class EpicService extends BaseEhrService {
  readonly ehrName = 'epic';

  async getToken(payload: ConnectionData): Promise<TokenResult> {
    try {
      const { grantType, clientId, clientSecret, scope } = payload;
      const data = new URLSearchParams();
      if (grantType) data.append('grant_type', grantType);
      if (scope) data.append('scope', scope);
      const url = this.getResolvedAuthUrl(payload);

      const requestOptions: any = {
        url,
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
        data.append('client_id', clientId!);
      }

      const response = await httpClient.request<any>(requestOptions);
      return { accessToken: response?.data?.access_token, expiresIn: (response?.data?.expires_in || 3600) - 30 };
    } catch (error: any) {
      throw this.handleAuthError(error);
    }
  }

  // Resolves the FHIR base URL for the tenant via centralized config.
  private getEpicBaseUrl(connectionData: ConnectionData): string {
    return this.getResolvedBaseUrl(connectionData);
  }

  // ---------------------------------------------------------------------------
  // Patient
  // ---------------------------------------------------------------------------

  async searchPatients(
    config: EhrClientConfig,
    params: Record<string, any>,
  ): Promise<EhrResponse<Bundle<EpicPatient>>> {
    const conn = this.buildConnectionData(config, null);
    return this.makeAuthenticatedRequest<Bundle<EpicPatient>>(config, {
      url: `${this.getEpicBaseUrl(conn)}/Patient`,
      method: 'get',
      params,
    });
  }

  async getPatient(config: EhrClientConfig, id: string): Promise<EhrResponse<EpicPatient>> {
    const conn = this.buildConnectionData(config, null);
    return this.makeAuthenticatedRequest<EpicPatient>(config, {
      url: `${this.getEpicBaseUrl(conn)}/Patient/${id}`,
      method: 'get',
    });
  }

  async createPatient(config: EhrClientConfig, data: Record<string, any>): Promise<EhrResponse<EpicPatient>> {
    const conn = this.buildConnectionData(config, null);
    return this.makeAuthenticatedRequest<EpicPatient>(config, {
      url: `${this.getEpicBaseUrl(conn)}/Patient`,
      method: 'post',
      data,
    });
  }

  // ---------------------------------------------------------------------------
  // Appointment
  // ---------------------------------------------------------------------------

  async searchAppointments(
    config: EhrClientConfig,
    params: Record<string, any>,
  ): Promise<EhrResponse<Bundle<EpicAppointment>>> {
    const conn = this.buildConnectionData(config, null);
    return this.makeAuthenticatedRequest<Bundle<EpicAppointment>>(config, {
      url: `${this.getEpicBaseUrl(conn)}/Appointment`,
      method: 'get',
      params,
    });
  }

  async getAppointment(config: EhrClientConfig, id: string): Promise<EhrResponse<EpicAppointment>> {
    const conn = this.buildConnectionData(config, null);
    return this.makeAuthenticatedRequest<EpicAppointment>(config, {
      url: `${this.getEpicBaseUrl(conn)}/Appointment/${id}`,
      method: 'get',
    });
  }

  // ---------------------------------------------------------------------------
  // Encounter
  // ---------------------------------------------------------------------------

  async searchEncounters(
    config: EhrClientConfig,
    params: Record<string, any>,
  ): Promise<EhrResponse<Bundle<EpicEncounter>>> {
    const conn = this.buildConnectionData(config, null);
    return this.makeAuthenticatedRequest<Bundle<EpicEncounter>>(config, {
      url: `${this.getEpicBaseUrl(conn)}/Encounter`,
      method: 'get',
      params,
    });
  }

  async getEncounter(config: EhrClientConfig, id: string): Promise<EhrResponse<EpicEncounter>> {
    const conn = this.buildConnectionData(config, null);
    return this.makeAuthenticatedRequest<EpicEncounter>(config, {
      url: `${this.getEpicBaseUrl(conn)}/Encounter/${id}`,
      method: 'get',
    });
  }

  // ---------------------------------------------------------------------------
  // Coverage
  // ---------------------------------------------------------------------------

  async searchCoverages(
    config: EhrClientConfig,
    params: Record<string, any>,
  ): Promise<EhrResponse<Bundle<EpicCoverage>>> {
    const conn = this.buildConnectionData(config, null);
    return this.makeAuthenticatedRequest<Bundle<EpicCoverage>>(config, {
      url: `${this.getEpicBaseUrl(conn)}/Coverage`,
      method: 'get',
      params,
    });
  }

  async getCoverage(config: EhrClientConfig, id: string): Promise<EhrResponse<EpicCoverage>> {
    const conn = this.buildConnectionData(config, null);
    return this.makeAuthenticatedRequest<EpicCoverage>(config, {
      url: `${this.getEpicBaseUrl(conn)}/Coverage/${id}`,
      method: 'get',
    });
  }

  // ---------------------------------------------------------------------------
  // Condition
  // ---------------------------------------------------------------------------

  async searchConditions(
    config: EhrClientConfig,
    params: Record<string, any>,
  ): Promise<EhrResponse<Bundle<EpicCondition>>> {
    const conn = this.buildConnectionData(config, null);
    return this.makeAuthenticatedRequest<Bundle<EpicCondition>>(config, {
      url: `${this.getEpicBaseUrl(conn)}/Condition`,
      method: 'get',
      params,
    });
  }

  async getCondition(config: EhrClientConfig, id: string): Promise<EhrResponse<EpicCondition>> {
    const conn = this.buildConnectionData(config, null);
    return this.makeAuthenticatedRequest<EpicCondition>(config, {
      url: `${this.getEpicBaseUrl(conn)}/Condition/${id}`,
      method: 'get',
    });
  }

  async createCondition(config: EhrClientConfig, data: Record<string, any>): Promise<EhrResponse<EpicCondition>> {
    const conn = this.buildConnectionData(config, null);
    return this.makeAuthenticatedRequest<EpicCondition>(config, {
      url: `${this.getEpicBaseUrl(conn)}/Condition`,
      method: 'post',
      data,
    });
  }

  // ---------------------------------------------------------------------------
  // AllergyIntolerance
  // ---------------------------------------------------------------------------

  async searchAllergies(
    config: EhrClientConfig,
    params: Record<string, any>,
  ): Promise<EhrResponse<Bundle<EpicAllergy>>> {
    const conn = this.buildConnectionData(config, null);
    return this.makeAuthenticatedRequest<Bundle<EpicAllergy>>(config, {
      url: `${this.getEpicBaseUrl(conn)}/AllergyIntolerance`,
      method: 'get',
      params,
    });
  }

  async getAllergy(config: EhrClientConfig, id: string): Promise<EhrResponse<EpicAllergy>> {
    const conn = this.buildConnectionData(config, null);
    return this.makeAuthenticatedRequest<EpicAllergy>(config, {
      url: `${this.getEpicBaseUrl(conn)}/AllergyIntolerance/${id}`,
      method: 'get',
    });
  }

  async createAllergy(config: EhrClientConfig, data: Record<string, any>): Promise<EhrResponse<EpicAllergy>> {
    const conn = this.buildConnectionData(config, null);
    return this.makeAuthenticatedRequest<EpicAllergy>(config, {
      url: `${this.getEpicBaseUrl(conn)}/AllergyIntolerance`,
      method: 'post',
      data,
    });
  }

  // ---------------------------------------------------------------------------
  // MedicationStatement
  // ---------------------------------------------------------------------------

  async searchMedicationStatements(
    config: EhrClientConfig,
    params: Record<string, any>,
  ): Promise<EhrResponse<Bundle<EpicMedication>>> {
    const conn = this.buildConnectionData(config, null);
    return this.makeAuthenticatedRequest<Bundle<EpicMedication>>(config, {
      url: `${this.getEpicBaseUrl(conn)}/MedicationStatement`,
      method: 'get',
      params,
    });
  }

  async getMedicationStatement(config: EhrClientConfig, id: string): Promise<EhrResponse<EpicMedication>> {
    const conn = this.buildConnectionData(config, null);
    return this.makeAuthenticatedRequest<EpicMedication>(config, {
      url: `${this.getEpicBaseUrl(conn)}/MedicationStatement/${id}`,
      method: 'get',
    });
  }

  // ---------------------------------------------------------------------------
  // Observation
  // ---------------------------------------------------------------------------

  async searchObservations(
    config: EhrClientConfig,
    params: Record<string, any>,
  ): Promise<EhrResponse<Bundle<EpicObservation>>> {
    const conn = this.buildConnectionData(config, null);
    return this.makeAuthenticatedRequest<Bundle<EpicObservation>>(config, {
      url: `${this.getEpicBaseUrl(conn)}/Observation`,
      method: 'get',
      params,
    });
  }

  async getObservation(config: EhrClientConfig, id: string): Promise<EhrResponse<EpicObservation>> {
    const conn = this.buildConnectionData(config, null);
    return this.makeAuthenticatedRequest<EpicObservation>(config, {
      url: `${this.getEpicBaseUrl(conn)}/Observation/${id}`,
      method: 'get',
    });
  }

  async createObservation(config: EhrClientConfig, data: Record<string, any>): Promise<EhrResponse<EpicObservation>> {
    const conn = this.buildConnectionData(config, null);
    return this.makeAuthenticatedRequest<EpicObservation>(config, {
      url: `${this.getEpicBaseUrl(conn)}/Observation`,
      method: 'post',
      data,
    });
  }

  // ---------------------------------------------------------------------------
  // DocumentReference
  // ---------------------------------------------------------------------------

  async searchDocumentReferences(
    config: EhrClientConfig,
    params: Record<string, any>,
  ): Promise<EhrResponse<Bundle<EpicDocument>>> {
    const conn = this.buildConnectionData(config, null);
    return this.makeAuthenticatedRequest<Bundle<EpicDocument>>(config, {
      url: `${this.getEpicBaseUrl(conn)}/DocumentReference`,
      method: 'get',
      params,
    });
  }

  async getDocumentReference(config: EhrClientConfig, id: string): Promise<EhrResponse<EpicDocument>> {
    const conn = this.buildConnectionData(config, null);
    return this.makeAuthenticatedRequest<EpicDocument>(config, {
      url: `${this.getEpicBaseUrl(conn)}/DocumentReference/${id}`,
      method: 'get',
    });
  }

  async createDocumentReference(
    config: EhrClientConfig,
    data: Record<string, any>,
  ): Promise<EhrResponse<EpicDocument>> {
    const conn = this.buildConnectionData(config, null);
    return this.makeAuthenticatedRequest<EpicDocument>(config, {
      url: `${this.getEpicBaseUrl(conn)}/DocumentReference`,
      method: 'post',
      data,
    });
  }

  // ---------------------------------------------------------------------------
  // Practitioner
  // ---------------------------------------------------------------------------

  async searchPractitioners(
    config: EhrClientConfig,
    params: Record<string, any>,
  ): Promise<EhrResponse<Bundle<EpicPractitioner>>> {
    const conn = this.buildConnectionData(config, null);
    return this.makeAuthenticatedRequest<Bundle<EpicPractitioner>>(config, {
      url: `${this.getEpicBaseUrl(conn)}/Practitioner`,
      method: 'get',
      params,
    });
  }

  async getPractitioner(config: EhrClientConfig, id: string): Promise<EhrResponse<EpicPractitioner>> {
    const conn = this.buildConnectionData(config, null);
    return this.makeAuthenticatedRequest<EpicPractitioner>(config, {
      url: `${this.getEpicBaseUrl(conn)}/Practitioner/${id}`,
      method: 'get',
    });
  }

  // ---------------------------------------------------------------------------
  // Communication
  // ---------------------------------------------------------------------------

  async searchCommunications(config: EhrClientConfig, params: Record<string, any>): Promise<EhrResponse<Bundle<any>>> {
    const conn = this.buildConnectionData(config, null);
    return this.makeAuthenticatedRequest<Bundle<any>>(config, {
      url: `${this.getEpicBaseUrl(conn)}/Communication`,
      method: 'get',
      params,
    });
  }

  async getCommunication(config: EhrClientConfig, id: string): Promise<EhrResponse<any>> {
    const conn = this.buildConnectionData(config, null);
    return this.makeAuthenticatedRequest<any>(config, {
      url: `${this.getEpicBaseUrl(conn)}/Communication/${id}`,
      method: 'get',
    });
  }

  async createCommunication(config: EhrClientConfig, data: Record<string, any>): Promise<EhrResponse<any>> {
    const conn = this.buildConnectionData(config, null);
    return this.makeAuthenticatedRequest<any>(config, {
      url: `${this.getEpicBaseUrl(conn)}/Communication`,
      method: 'post',
      data,
    });
  }

  // ---------------------------------------------------------------------------
  // ServiceRequest
  // ---------------------------------------------------------------------------

  async searchServiceRequests(config: EhrClientConfig, params: Record<string, any>): Promise<EhrResponse<Bundle<any>>> {
    const conn = this.buildConnectionData(config, null);
    return this.makeAuthenticatedRequest<Bundle<any>>(config, {
      url: `${this.getEpicBaseUrl(conn)}/ServiceRequest`,
      method: 'get',
      params,
    });
  }

  async getServiceRequest(config: EhrClientConfig, id: string): Promise<EhrResponse<any>> {
    const conn = this.buildConnectionData(config, null);
    return this.makeAuthenticatedRequest<any>(config, {
      url: `${this.getEpicBaseUrl(conn)}/ServiceRequest/${id}`,
      method: 'get',
    });
  }
}

export const epic = new EpicService();

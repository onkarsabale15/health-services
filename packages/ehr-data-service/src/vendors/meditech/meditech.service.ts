// meditech.service.ts
// MEDITECH EHR vendor service.
//
// MEDITECH uses two FHIR version paths in the same API:
//   /v2/uscore/R4/  — Patient, Condition, Encounter, Practitioner (R4 standard)
//   /v2/uscore/STU6/ — Coverage, AllergyIntolerance, DocumentReference,
//                      MedicationRequest, Communication, Observation (MEDITECH STU6 extension)

import { BaseEhrService, EhrError, TokenResult } from '../../core';
import type { EhrClientConfig } from '../../core/interfaces/ehr-client-config.interface';
import type { ConnectionData } from '../../core/interfaces/connection-data.interface';
import { httpClient } from '@hs/infra';

class MeditechService extends BaseEhrService {
  readonly ehrName = 'meditech';

  async getToken(payload: any): Promise<TokenResult> {
    try {
      const { clientId, clientSecret, code, grantType } = payload;
      if (!grantType || !clientId || !code) {
        throw new Error('clientId, code, grantType are required');
      }
      const body: Record<string, string> = {
        grant_type: grantType,
        code,
        client_id: clientId,
        redirect_uri: 'https://oauth.pstmn.io/v1/callback',
      };
      if (clientSecret) {
        body.client_secret = clientSecret;
      }
      const response = await httpClient.request<any>({
        url: this.getResolvedAuthUrl(payload),
        data: body,
        method: 'post',
        contentType: 'application/json',
      });
      return {
        accessToken: response?.data?.access_token,
        refreshToken: response?.data?.refresh_token,
        expiresIn: response?.data?.expires_in,
      };
    } catch (error: any) {
      throw this.handleAuthError(error);
    }
  }

  protected getBaseUrl(connectionData: ConnectionData): string {
    return this.getResolvedBaseUrl(connectionData);
  }

  // ── R4 Patient ──────────────────────────────────────────────────────────────

  async fhirPatientSearch(params: Record<string, any>, config: EhrClientConfig): Promise<any> {
    try {
      const conn = this.buildConnectionData(config, null);
      return await this.makeAuthenticatedRequest(config, {
        url: `${this.getBaseUrl(conn)}/v2/uscore/R4/Patient`,
        method: 'get',
        params,
      });
    } catch (error: any) {
      throw error;
    }
  }

  async getPatientById(id: string, config: EhrClientConfig): Promise<any> {
    try {
      const conn = this.buildConnectionData(config, null);
      return await this.makeAuthenticatedRequest(config, {
        url: `${this.getBaseUrl(conn)}/v2/uscore/R4/Patient/${id}`,
        method: 'get',
      });
    } catch (error: any) {
      throw error;
    }
  }

  // ── R4 Condition ────────────────────────────────────────────────────────────

  async fhirConditionSearch(params: Record<string, any>, config: EhrClientConfig): Promise<any> {
    try {
      const conn = this.buildConnectionData(config, null);
      return await this.makeAuthenticatedRequest(config, {
        url: `${this.getBaseUrl(conn)}/v2/uscore/R4/Condition`,
        method: 'get',
        params,
      });
    } catch (error: any) {
      throw error;
    }
  }

  async getConditionById(id: string, config: EhrClientConfig): Promise<any> {
    try {
      const conn = this.buildConnectionData(config, null);
      return await this.makeAuthenticatedRequest(config, {
        url: `${this.getBaseUrl(conn)}/v2/uscore/R4/Condition/${id}`,
        method: 'get',
      });
    } catch (error: any) {
      throw error;
    }
  }

  // ── R4 Encounter ────────────────────────────────────────────────────────────

  async fhirEncounterSearch(params: Record<string, any>, config: EhrClientConfig): Promise<any> {
    try {
      const conn = this.buildConnectionData(config, null);
      return await this.makeAuthenticatedRequest(config, {
        url: `${this.getBaseUrl(conn)}/v2/uscore/R4/Encounter`,
        method: 'get',
        params,
      });
    } catch (error: any) {
      throw error;
    }
  }

  async getEncounterById(id: string, config: EhrClientConfig): Promise<any> {
    try {
      const conn = this.buildConnectionData(config, null);
      return await this.makeAuthenticatedRequest(config, {
        url: `${this.getBaseUrl(conn)}/v2/uscore/R4/Encounter/${id}`,
        method: 'get',
      });
    } catch (error: any) {
      throw error;
    }
  }

  // ── R4 Practitioner ─────────────────────────────────────────────────────────

  async fhirPractitionerSearch(params: Record<string, any>, config: EhrClientConfig): Promise<any> {
    try {
      const conn = this.buildConnectionData(config, null);
      return await this.makeAuthenticatedRequest(config, {
        url: `${this.getBaseUrl(conn)}/v2/uscore/R4/Practitioner`,
        method: 'get',
        params,
      });
    } catch (error: any) {
      throw error;
    }
  }

  async getPractitionerById(id: string, config: EhrClientConfig): Promise<any> {
    try {
      const conn = this.buildConnectionData(config, null);
      return await this.makeAuthenticatedRequest(config, {
        url: `${this.getBaseUrl(conn)}/v2/uscore/STU6/Practitioner/${id}`,
        method: 'get',
      });
    } catch (error: any) {
      throw error;
    }
  }

  // ── STU6 Coverage ───────────────────────────────────────────────────────────

  async stu6CoverageSearch(params: Record<string, any>, config: EhrClientConfig): Promise<any> {
    try {
      const conn = this.buildConnectionData(config, null);
      return await this.makeAuthenticatedRequest(config, {
        url: `${this.getBaseUrl(conn)}/v2/uscore/STU6/Coverage`,
        method: 'get',
        params,
      });
    } catch (error: any) {
      throw error;
    }
  }

  async getCoverageById(id: string, config: EhrClientConfig): Promise<any> {
    try {
      const conn = this.buildConnectionData(config, null);
      return await this.makeAuthenticatedRequest(config, {
        url: `${this.getBaseUrl(conn)}/v2/uscore/STU6/Coverage/${id}`,
        method: 'get',
      });
    } catch (error: any) {
      throw error;
    }
  }

  // ── STU6 AllergyIntolerance ─────────────────────────────────────────────────

  async stu6AllergySearch(params: Record<string, any>, config: EhrClientConfig): Promise<any> {
    try {
      const conn = this.buildConnectionData(config, null);
      return await this.makeAuthenticatedRequest(config, {
        url: `${this.getBaseUrl(conn)}/v2/uscore/STU6/AllergyIntolerance`,
        method: 'get',
        params,
      });
    } catch (error: any) {
      throw error;
    }
  }

  async getAllergyById(id: string, config: EhrClientConfig): Promise<any> {
    try {
      const conn = this.buildConnectionData(config, null);
      return await this.makeAuthenticatedRequest(config, {
        url: `${this.getBaseUrl(conn)}/v2/uscore/STU6/AllergyIntolerance/${id}`,
        method: 'get',
      });
    } catch (error: any) {
      throw error;
    }
  }

  // ── STU6 DocumentReference ──────────────────────────────────────────────────

  async stu6DocumentReferenceSearch(params: Record<string, any>, config: EhrClientConfig): Promise<any> {
    try {
      const conn = this.buildConnectionData(config, null);
      return await this.makeAuthenticatedRequest(config, {
        url: `${this.getBaseUrl(conn)}/v2/uscore/STU6/DocumentReference`,
        method: 'get',
        params,
      });
    } catch (error: any) {
      throw error;
    }
  }

  async getDocumentReferenceById(id: string, config: EhrClientConfig): Promise<any> {
    try {
      const conn = this.buildConnectionData(config, null);
      return await this.makeAuthenticatedRequest(config, {
        url: `${this.getBaseUrl(conn)}/v2/uscore/STU6/DocumentReference/${id}`,
        method: 'get',
      });
    } catch (error: any) {
      throw error;
    }
  }

  // ── STU6 MedicationRequest ──────────────────────────────────────────────────

  async stu6MedicationRequestSearch(params: Record<string, any>, config: EhrClientConfig): Promise<any> {
    try {
      const conn = this.buildConnectionData(config, null);
      return await this.makeAuthenticatedRequest(config, {
        url: `${this.getBaseUrl(conn)}/v2/uscore/STU6/MedicationRequest`,
        method: 'get',
        params,
      });
    } catch (error: any) {
      throw error;
    }
  }

  async getMedicationById(id: string, config: EhrClientConfig): Promise<any> {
    try {
      const conn = this.buildConnectionData(config, null);
      return await this.makeAuthenticatedRequest(config, {
        url: `${this.getBaseUrl(conn)}/v2/uscore/STU6/Medication/${id}`,
        method: 'get',
      });
    } catch (error: any) {
      throw error;
    }
  }

  // ── STU6 Communication ──────────────────────────────────────────────────────

  async stu6CommunicationSearch(params: Record<string, any>, config: EhrClientConfig): Promise<any> {
    try {
      const conn = this.buildConnectionData(config, null);
      return await this.makeAuthenticatedRequest(config, {
        url: `${this.getBaseUrl(conn)}/v2/uscore/STU6/Communication`,
        method: 'get',
        params,
      });
    } catch (error: any) {
      throw error;
    }
  }

  async getCommunicationById(id: string, config: EhrClientConfig): Promise<any> {
    try {
      const conn = this.buildConnectionData(config, null);
      return await this.makeAuthenticatedRequest(config, {
        url: `${this.getBaseUrl(conn)}/v2/uscore/STU6/Communication/${id}`,
        method: 'get',
      });
    } catch (error: any) {
      throw error;
    }
  }

  // ── STU6 Observation ────────────────────────────────────────────────────────

  async stu6ObservationSearch(params: Record<string, any>, config: EhrClientConfig): Promise<any> {
    try {
      const conn = this.buildConnectionData(config, null);
      return await this.makeAuthenticatedRequest(config, {
        url: `${this.getBaseUrl(conn)}/v2/uscore/STU6/Observation`,
        method: 'get',
        params,
      });
    } catch (error: any) {
      throw error;
    }
  }

  async getObservationById(id: string, config: EhrClientConfig): Promise<any> {
    try {
      const conn = this.buildConnectionData(config, null);
      return await this.makeAuthenticatedRequest(config, {
        url: `${this.getBaseUrl(conn)}/v2/uscore/STU6/Observation/${id}`,
        method: 'get',
      });
    } catch (error: any) {
      throw error;
    }
  }
}

export const meditech = new MeditechService();

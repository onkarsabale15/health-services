// medent.service.ts
// MEDENT EHR vendor service.
//
// MEDENT exposes a FHIR-like API with account-scoped URLs:
//   /{accountId}/{ResourceType}
//   /{accountId}/{ResourceType}/{id}

import { BaseEhrService, TokenResult } from '../../core';
import type { EhrClientConfig } from '../../core/interfaces/ehr-client-config.interface';
import type { ConnectionData } from '../../core/interfaces/connection-data.interface';

class MedentService extends BaseEhrService {
  readonly ehrName = 'medent';

  async getToken(_payload: any): Promise<TokenResult> {
    return {
      accessToken: 'this is sample token as the credentials are not available to implement the flow',
      expiresIn: 3600,
    };
  }

  private getEhrParams(connectionData: ConnectionData): { accountId: string; baseUrl: string } {
    return {
      accountId: (connectionData as any).accountId ?? '',
      baseUrl: this.getResolvedBaseUrl(connectionData),
    };
  }

  // ── Patient ─────────────────────────────────────────────────────────────────

  async fhirPatientSearch(params: Record<string, any>, config: EhrClientConfig): Promise<any> {
    try {
      const conn = this.buildConnectionData(config, null);
      const { accountId, baseUrl } = this.getEhrParams(conn);
      return await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}/${accountId}/Patient`,
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
      const { accountId, baseUrl } = this.getEhrParams(conn);
      return await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}/${accountId}/Patient/${id}`,
        method: 'get',
      });
    } catch (error: any) {
      throw error;
    }
  }

  async createPatient(data: any, config: EhrClientConfig): Promise<any> {
    try {
      const conn = this.buildConnectionData(config, null);
      const { accountId, baseUrl } = this.getEhrParams(conn);
      return await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}/${accountId}/Patient`,
        method: 'post',
        data,
      });
    } catch (error: any) {
      throw error;
    }
  }

  // ── AllergyIntolerance ──────────────────────────────────────────────────────

  async fhirAllergySearch(params: Record<string, any>, config: EhrClientConfig): Promise<any> {
    try {
      const conn = this.buildConnectionData(config, null);
      const { accountId, baseUrl } = this.getEhrParams(conn);
      return await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}/${accountId}/AllergyIntolerance`,
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
      const { accountId, baseUrl } = this.getEhrParams(conn);
      return await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}/${accountId}/AllergyIntolerance/${id}`,
        method: 'get',
      });
    } catch (error: any) {
      throw error;
    }
  }

  async createAllergy(data: any, config: EhrClientConfig): Promise<any> {
    try {
      const conn = this.buildConnectionData(config, null);
      const { accountId, baseUrl } = this.getEhrParams(conn);
      return await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}/${accountId}/AllergyIntolerance`,
        method: 'post',
        data,
      });
    } catch (error: any) {
      throw error;
    }
  }

  // ── Condition ───────────────────────────────────────────────────────────────

  async fhirConditionSearch(params: Record<string, any>, config: EhrClientConfig): Promise<any> {
    try {
      const conn = this.buildConnectionData(config, null);
      const { accountId, baseUrl } = this.getEhrParams(conn);
      return await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}/${accountId}/Condition`,
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
      const { accountId, baseUrl } = this.getEhrParams(conn);
      return await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}/${accountId}/Condition/${id}`,
        method: 'get',
      });
    } catch (error: any) {
      throw error;
    }
  }

  async createCondition(data: any, config: EhrClientConfig): Promise<any> {
    try {
      const conn = this.buildConnectionData(config, null);
      const { accountId, baseUrl } = this.getEhrParams(conn);
      return await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}/${accountId}/Condition`,
        method: 'post',
        data,
      });
    } catch (error: any) {
      throw error;
    }
  }

  // ── Encounter ───────────────────────────────────────────────────────────────

  async fhirEncounterSearch(params: Record<string, any>, config: EhrClientConfig): Promise<any> {
    try {
      const conn = this.buildConnectionData(config, null);
      const { accountId, baseUrl } = this.getEhrParams(conn);
      return await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}/${accountId}/Encounter`,
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
      const { accountId, baseUrl } = this.getEhrParams(conn);
      return await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}/${accountId}/Encounter/${id}`,
        method: 'get',
      });
    } catch (error: any) {
      throw error;
    }
  }

  // ── Appointment ─────────────────────────────────────────────────────────────

  async fhirAppointmentSearch(params: Record<string, any>, config: EhrClientConfig): Promise<any> {
    try {
      const conn = this.buildConnectionData(config, null);
      const { accountId, baseUrl } = this.getEhrParams(conn);
      return await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}/${accountId}/Appointment`,
        method: 'get',
        params,
      });
    } catch (error: any) {
      throw error;
    }
  }

  async getAppointmentById(id: string, config: EhrClientConfig): Promise<any> {
    try {
      const conn = this.buildConnectionData(config, null);
      const { accountId, baseUrl } = this.getEhrParams(conn);
      return await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}/${accountId}/Appointment/${id}`,
        method: 'get',
      });
    } catch (error: any) {
      throw error;
    }
  }

  // ── DocumentReference ───────────────────────────────────────────────────────

  async fhirDocumentReferenceSearch(params: Record<string, any>, config: EhrClientConfig): Promise<any> {
    try {
      const conn = this.buildConnectionData(config, null);
      const { accountId, baseUrl } = this.getEhrParams(conn);
      return await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}/${accountId}/DocumentReference`,
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
      const { accountId, baseUrl } = this.getEhrParams(conn);
      return await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}/${accountId}/DocumentReference/${id}`,
        method: 'get',
      });
    } catch (error: any) {
      throw error;
    }
  }

  async createDocumentReference(data: any, config: EhrClientConfig): Promise<any> {
    try {
      const conn = this.buildConnectionData(config, null);
      const { accountId, baseUrl } = this.getEhrParams(conn);
      return await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}/${accountId}/DocumentReference`,
        method: 'post',
        data,
      });
    } catch (error: any) {
      throw error;
    }
  }

  // ── Observation ─────────────────────────────────────────────────────────────

  async fhirObservationSearch(params: Record<string, any>, config: EhrClientConfig): Promise<any> {
    try {
      const conn = this.buildConnectionData(config, null);
      const { accountId, baseUrl } = this.getEhrParams(conn);
      return await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}/${accountId}/Observation`,
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
      const { accountId, baseUrl } = this.getEhrParams(conn);
      return await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}/${accountId}/Observation/${id}`,
        method: 'get',
      });
    } catch (error: any) {
      throw error;
    }
  }

  async createObservation(data: any, config: EhrClientConfig): Promise<any> {
    try {
      const conn = this.buildConnectionData(config, null);
      const { accountId, baseUrl } = this.getEhrParams(conn);
      return await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}/${accountId}/Observation`,
        method: 'post',
        data,
      });
    } catch (error: any) {
      throw error;
    }
  }

  // ── Practitioner ────────────────────────────────────────────────────────────

  async fhirPractitionerSearch(params: Record<string, any>, config: EhrClientConfig): Promise<any> {
    try {
      const conn = this.buildConnectionData(config, null);
      const { accountId, baseUrl } = this.getEhrParams(conn);
      return await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}/${accountId}/Practitioner`,
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
      const { accountId, baseUrl } = this.getEhrParams(conn);
      return await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}/${accountId}/Practitioner/${id}`,
        method: 'get',
      });
    } catch (error: any) {
      throw error;
    }
  }
}

export const medent = new MedentService();

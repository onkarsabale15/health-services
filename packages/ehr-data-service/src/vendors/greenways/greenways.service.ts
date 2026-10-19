// greenways.service.ts
// Greenways EHR vendor service.
//
// Greenways exposes a FHIR R4 API with tenant-scoped URLs:
//   /fhir/R4/{tenant}    — Patient search
//   /{tenant}/{ResourceType}
//   /{tenant}/{ResourceType}/{id}

import { BaseEhrService, TokenResult } from '../../core';
import type { EhrClientConfig } from '../../core/interfaces/ehr-client-config.interface';
import type { ConnectionData } from '../../core/interfaces/connection-data.interface';

class GreenwaysService extends BaseEhrService {
  readonly ehrName = 'greenways';

  async getToken(_payload: any): Promise<TokenResult> {
    return {
      accessToken: 'this is sample token as the credentials are not available to implement the flow',
      expiresIn: 3600,
    };
  }

  private getEhrParams(connectionData: ConnectionData): { tenant: string; baseUrl: string } {
    return {
      tenant: (connectionData as any).tenant ?? '',
      baseUrl: this.getResolvedBaseUrl(connectionData),
    };
  }

  // ── Patient ─────────────────────────────────────────────────────────────────

  async fhirPatientSearch(params: Record<string, any>, config: EhrClientConfig): Promise<any> {
    try {
      const conn = this.buildConnectionData(config, null);
      const { tenant, baseUrl } = this.getEhrParams(conn);
      return await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}/fhir/R4/${tenant}`,
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
      const { tenant, baseUrl } = this.getEhrParams(conn);
      return await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}/${tenant}/Patient/${id}`,
        method: 'get',
      });
    } catch (error: any) {
      throw error;
    }
  }

  async createPatient(data: any, config: EhrClientConfig): Promise<any> {
    try {
      const conn = this.buildConnectionData(config, null);
      const { tenant, baseUrl } = this.getEhrParams(conn);
      return await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}/${tenant}/Patient`,
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
      const { tenant, baseUrl } = this.getEhrParams(conn);
      return await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}/${tenant}/AllergyIntolerance`,
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
      const { tenant, baseUrl } = this.getEhrParams(conn);
      return await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}/${tenant}/AllergyIntolerance/${id}`,
        method: 'get',
      });
    } catch (error: any) {
      throw error;
    }
  }

  async createAllergy(data: any, config: EhrClientConfig): Promise<any> {
    try {
      const conn = this.buildConnectionData(config, null);
      const { tenant, baseUrl } = this.getEhrParams(conn);
      return await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}/${tenant}/AllergyIntolerance`,
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
      const { tenant, baseUrl } = this.getEhrParams(conn);
      return await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}/${tenant}/Condition`,
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
      const { tenant, baseUrl } = this.getEhrParams(conn);
      return await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}/${tenant}/Condition/${id}`,
        method: 'get',
      });
    } catch (error: any) {
      throw error;
    }
  }

  async createCondition(data: any, config: EhrClientConfig): Promise<any> {
    try {
      const conn = this.buildConnectionData(config, null);
      const { tenant, baseUrl } = this.getEhrParams(conn);
      return await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}/${tenant}/Condition`,
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
      const { tenant, baseUrl } = this.getEhrParams(conn);
      return await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}/${tenant}/Encounter`,
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
      const { tenant, baseUrl } = this.getEhrParams(conn);
      return await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}/${tenant}/Encounter/${id}`,
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
      const { tenant, baseUrl } = this.getEhrParams(conn);
      return await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}/${tenant}/Appointment`,
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
      const { tenant, baseUrl } = this.getEhrParams(conn);
      return await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}/${tenant}/Appointment/${id}`,
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
      const { tenant, baseUrl } = this.getEhrParams(conn);
      return await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}/${tenant}/DocumentReference`,
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
      const { tenant, baseUrl } = this.getEhrParams(conn);
      return await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}/${tenant}/DocumentReference/${id}`,
        method: 'get',
      });
    } catch (error: any) {
      throw error;
    }
  }

  async createDocumentReference(data: any, config: EhrClientConfig): Promise<any> {
    try {
      const conn = this.buildConnectionData(config, null);
      const { tenant, baseUrl } = this.getEhrParams(conn);
      return await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}/${tenant}/DocumentReference`,
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
      const { tenant, baseUrl } = this.getEhrParams(conn);
      return await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}/${tenant}/Observation`,
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
      const { tenant, baseUrl } = this.getEhrParams(conn);
      return await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}/${tenant}/Observation/${id}`,
        method: 'get',
      });
    } catch (error: any) {
      throw error;
    }
  }

  async createObservation(data: any, config: EhrClientConfig): Promise<any> {
    try {
      const conn = this.buildConnectionData(config, null);
      const { tenant, baseUrl } = this.getEhrParams(conn);
      return await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}/${tenant}/Observation`,
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
      const { tenant, baseUrl } = this.getEhrParams(conn);
      return await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}/${tenant}/Practitioner`,
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
      const { tenant, baseUrl } = this.getEhrParams(conn);
      return await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}/${tenant}/Practitioner/${id}`,
        method: 'get',
      });
    } catch (error: any) {
      throw error;
    }
  }
}

export const greenways = new GreenwaysService();

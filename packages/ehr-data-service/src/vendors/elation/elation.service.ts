// elation.service.ts
// ElationEMR vendor service.
//
// ElationEMR specifics:
//   - REST API — each resource has a dedicated endpoint (not FHIR-native)
//   - Token read directly from connectionData.accessToken
//   - Coverage is derived from patient record's insurances[] (GET /patients/{id})
//   - Communication is a PATCH to /patients/{id} with { notes }
//   - Visit notes at /visit_notes, CCDA at /ccda/{patientId}
//   - Observation endpoint is /vitals
//   - Practitioners are at /physicians

import { BaseEhrService, TokenResult } from '../../core';
import type { EhrResponse } from '../../core';
import type { EhrClientConfig } from '../../core/interfaces/ehr-client-config.interface';
import { httpClient } from '@hs/infra';
import type {
  ElationAppointment,
  ElationLabOrder,
  ElationPatient,
  ElationReport,
  ElationTokenPayload,
} from './elation.types';

class ElationService extends BaseEhrService {
  readonly ehrName = 'elationEmr';

  async getToken(payload: unknown): Promise<TokenResult> {
    try {
      const { clientId, clientSecret, grantType } = payload as ElationTokenPayload;
      const data = new URLSearchParams();
      data.append('grant_type', grantType);
      data.append('client_id', clientId);
      if (clientSecret) {
        data.append('client_secret', clientSecret);
      }
      const baseUrl = this.getResolvedAuthUrl(payload as any);
      const response = await httpClient.request<any>({
        url: baseUrl,
        method: 'post',
        data,
        contentType: 'application/x-www-form-urlencoded',
      });
      if (response?.data?.error) {
        throw new Error(JSON.stringify({ code: 400, message: response?.data?.data }));
      }
      return { accessToken: response?.data?.access_token, expiresIn: response?.data?.expires_in - 30 };
    } catch (error: unknown) {
      throw this.handleAuthError(error);
    }
  }

  // ── Patient ─────────────────────────────────────────────────────────────────

  async searchPatients(
    params: Record<string, unknown>,
    config: EhrClientConfig,
  ): Promise<EhrResponse<ElationPatient[]>> {
    try {
      const conn = this.buildConnectionData(config, null);
      const baseUrl = this.getResolvedBaseUrl(conn);
      return await this.makeAuthenticatedRequest<ElationPatient[]>(config, {
        url: `${baseUrl}/patients/`,
        method: 'get',
        params,
      });
    } catch (error: unknown) {
      throw error;
    }
  }

  async getPatient(patientId: string, config: EhrClientConfig): Promise<EhrResponse<ElationPatient>> {
    try {
      const conn = this.buildConnectionData(config, null);
      const baseUrl = this.getResolvedBaseUrl(conn);
      return await this.makeAuthenticatedRequest<ElationPatient>(config, {
        url: `${baseUrl}/patients/${patientId}`,
        method: 'get',
      });
    } catch (error: unknown) {
      throw error;
    }
  }

  async createPatient(data: unknown, config: EhrClientConfig): Promise<EhrResponse<ElationPatient>> {
    try {
      const conn = this.buildConnectionData(config, null);
      const baseUrl = this.getResolvedBaseUrl(conn);
      return await this.makeAuthenticatedRequest<ElationPatient>(config, {
        url: `${baseUrl}/patients`,
        method: 'post',
        data,
      });
    } catch (error: unknown) {
      throw error;
    }
  }

  // ── Appointment ──────────────────────────────────────────────────────────────

  async searchAppointments(
    params: Record<string, unknown>,
    config: EhrClientConfig,
  ): Promise<EhrResponse<ElationAppointment[]>> {
    try {
      const conn = this.buildConnectionData(config, null);
      const baseUrl = this.getResolvedBaseUrl(conn);
      return await this.makeAuthenticatedRequest<ElationAppointment[]>(config, {
        url: `${baseUrl}/appointments/`,
        method: 'get',
        params,
      });
    } catch (error: unknown) {
      throw error;
    }
  }

  async getAppointment(appointmentId: string, config: EhrClientConfig): Promise<EhrResponse<ElationAppointment>> {
    try {
      const conn = this.buildConnectionData(config, null);
      const baseUrl = this.getResolvedBaseUrl(conn);
      return await this.makeAuthenticatedRequest<ElationAppointment>(config, {
        url: `${baseUrl}/appointments/${appointmentId}`,
        method: 'get',
      });
    } catch (error: unknown) {
      throw error;
    }
  }

  // ── Problems (Conditions) ────────────────────────────────────────────────────

  async searchProblems(params: Record<string, unknown>, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const baseUrl = this.getResolvedBaseUrl(conn);
      return await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}/problems/`,
        method: 'get',
        params,
      });
    } catch (error: unknown) {
      throw error;
    }
  }

  async getProblem(problemId: string, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const baseUrl = this.getResolvedBaseUrl(conn);
      return await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}/problems/${problemId}/`,
        method: 'get',
      });
    } catch (error: unknown) {
      throw error;
    }
  }

  async createProblem(data: unknown, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const baseUrl = this.getResolvedBaseUrl(conn);
      return await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}/problems/`,
        method: 'post',
        data,
      });
    } catch (error: unknown) {
      throw error;
    }
  }

  // ── Allergies ────────────────────────────────────────────────────────────────

  async searchAllergies(params: Record<string, unknown>, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const baseUrl = this.getResolvedBaseUrl(conn);
      return await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}/allergies`,
        method: 'get',
        params,
      });
    } catch (error: unknown) {
      throw error;
    }
  }

  async getAllergy(allergyId: string, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const baseUrl = this.getResolvedBaseUrl(conn);
      return await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}/allergies/${allergyId}`,
        method: 'get',
      });
    } catch (error: unknown) {
      throw error;
    }
  }

  async createAllergy(data: unknown, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const baseUrl = this.getResolvedBaseUrl(conn);
      return await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}/allergies`,
        method: 'post',
        data,
      });
    } catch (error: unknown) {
      throw error;
    }
  }

  // ── Vitals (Observations) ────────────────────────────────────────────────────

  async searchVitals(params: Record<string, unknown>, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const baseUrl = this.getResolvedBaseUrl(conn);
      return await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}/vitals`,
        method: 'get',
        params,
      });
    } catch (error: unknown) {
      throw error;
    }
  }

  async getVital(vitalId: string, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const baseUrl = this.getResolvedBaseUrl(conn);
      return await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}/vitals/${vitalId}`,
        method: 'get',
      });
    } catch (error: unknown) {
      throw error;
    }
  }

  async createVital(data: unknown, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const baseUrl = this.getResolvedBaseUrl(conn);
      return await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}/vitals`,
        method: 'post',
        data,
      });
    } catch (error: unknown) {
      throw error;
    }
  }

  // ── Visit Notes ──────────────────────────────────────────────────────────────

  async searchVisitNotes(params: Record<string, unknown>, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const baseUrl = this.getResolvedBaseUrl(conn);
      return await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}/visit_notes`,
        method: 'get',
        params,
      });
    } catch (error: unknown) {
      throw error;
    }
  }

  async createVisitNote(data: unknown, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const baseUrl = this.getResolvedBaseUrl(conn);
      return await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}/visit_notes`,
        method: 'post',
        data,
      });
    } catch (error: unknown) {
      throw error;
    }
  }

  // ── CCDA ─────────────────────────────────────────────────────────────────────

  async getCcda(patientId: string, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const baseUrl = this.getResolvedBaseUrl(conn);
      return await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}/ccda/${patientId}`,
        method: 'get',
      });
    } catch (error: unknown) {
      throw error;
    }
  }

  // ── Medications ──────────────────────────────────────────────────────────────

  async searchMedications(params: Record<string, unknown>, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const baseUrl = this.getResolvedBaseUrl(conn);
      return await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}/medications`,
        method: 'get',
        params,
      });
    } catch (error: unknown) {
      throw error;
    }
  }

  async getMedication(medicationId: string, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const baseUrl = this.getResolvedBaseUrl(conn);
      return await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}/medications/${medicationId}`,
        method: 'get',
      });
    } catch (error: unknown) {
      throw error;
    }
  }

  // ── Physicians (Practitioners) ───────────────────────────────────────────────

  async searchPhysicians(params: Record<string, unknown>, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const baseUrl = this.getResolvedBaseUrl(conn);
      return await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}/physicians`,
        method: 'get',
        params,
      });
    } catch (error: unknown) {
      throw error;
    }
  }

  async getPhysician(physicianId: string, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const baseUrl = this.getResolvedBaseUrl(conn);
      return await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}/physicians/${physicianId}`,
        method: 'get',
      });
    } catch (error: unknown) {
      throw error;
    }
  }

  // ── Patient Notes (Communication) ────────────────────────────────────────────

  async patchPatientNotes(patientId: string, data: unknown, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const baseUrl = this.getResolvedBaseUrl(conn);
      return await this.makeAuthenticatedRequest(config, {
        url: `${baseUrl}/patients/${patientId}`,
        method: 'patch',
        data,
      });
    } catch (error: unknown) {
      throw error;
    }
  }

  // ── Lab Results (Orders and Reports) ─────────────────────────────────────────

  async searchLabOrders(
    params: Record<string, unknown>,
    config: EhrClientConfig,
  ): Promise<EhrResponse<ElationLabOrder[]>> {
    try {
      const conn = this.buildConnectionData(config, null);
      const baseUrl = this.getResolvedBaseUrl(conn);
      return await this.makeAuthenticatedRequest<ElationLabOrder[]>(config, {
        url: `${baseUrl}/lab_orders/`,
        method: 'get',
        params,
      });
    } catch (error: unknown) {
      throw error;
    }
  }

  async searchReports(params: Record<string, unknown>, config: EhrClientConfig): Promise<EhrResponse<ElationReport[]>> {
    try {
      const conn = this.buildConnectionData(config, null);
      const baseUrl = this.getResolvedBaseUrl(conn);
      return await this.makeAuthenticatedRequest<ElationReport[]>(config, {
        url: `${baseUrl}/reports/`,
        method: 'get',
        params,
      });
    } catch (error: unknown) {
      throw error;
    }
  }

  async getReport(reportId: string, config: EhrClientConfig): Promise<EhrResponse<ElationReport>> {
    try {
      const conn = this.buildConnectionData(config, null);
      const baseUrl = this.getResolvedBaseUrl(conn);
      return await this.makeAuthenticatedRequest<ElationReport>(config, {
        url: `${baseUrl}/reports/${reportId}`,
        method: 'get',
      });
    } catch (error: unknown) {
      throw error;
    }
  }
}

export const elation = new ElationService();

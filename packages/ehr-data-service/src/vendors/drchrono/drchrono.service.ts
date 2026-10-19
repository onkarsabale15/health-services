// drchrono.service.ts
// DrChrono EHR vendor service.
//
// DrChrono specifics:
//   - Token: connectionData.accessToken.access_token (nested)
//   - Cursor pagination using cursor param
//   - Proprietary REST API (no native FHIR endpoints)
//   - Encounters, Coverages, ServiceRequests are not supported

import { BaseEhrService, TokenResult } from '../../core';
import type { EhrResponse } from '../../core';
import type { ConnectionData } from '../../core';
import type { EhrClientConfig } from '../../core/interfaces/ehr-client-config.interface';
import { httpClient } from '@hs/infra';
import type {
  DrChronoCommunication,
  DrChronoLabResult,
  DrChronoOffice,
  DrChronoPaginatedResponse,
  DrChronoPatient,
  DrChronoTask,
  DrChronoTokenPayload,
} from './drchrono.types';

class DrChronoService extends BaseEhrService {
  readonly ehrName = 'drChrono';

  async getToken(payload: unknown): Promise<TokenResult> {
    try {
      const { clientId, clientSecret, code, grantType, redirectUri } = payload as DrChronoTokenPayload;
      const baseUrl = this.getResolvedExtraUrl(payload as any, 'tokenUrl');
      if (!baseUrl) {
        throw new Error('Token URL not configured for DrChrono');
      }
      const data = new URLSearchParams();
      data.append('grant_type', grantType);
      data.append('code', code);
      data.append('redirect_uri', redirectUri || process.env.REDIRECT_URI || '');
      data.append('client_id', clientId);
      if (clientSecret) {
        data.append('client_secret', clientSecret);
      }
      const response = await httpClient.request<any>({
        url: baseUrl,
        data,
        contentType: 'application/x-www-form-urlencoded',
        method: 'post',
      });
      if (response?.data?.error) {
        throw new Error(JSON.stringify({ code: 400, message: response?.data?.data }));
      }
      return {
        accessToken: response?.data?.access_token,
        expiresIn: response?.data?.expires_in - 30,
        refreshToken: response?.data?.refresh_token,
      };
    } catch (error: unknown) {
      throw this.handleAuthError(error);
    }
  }

  protected getBaseUrl(connectionData: ConnectionData): string {
    return this.getResolvedBaseUrl(connectionData);
  }

  // =========================================================================
  // Patients
  // =========================================================================

  /** Search patients via DrChrono REST API */
  async searchPatients(
    params: Record<string, unknown>,
    config: EhrClientConfig,
  ): Promise<EhrResponse<DrChronoPaginatedResponse<DrChronoPatient>>> {
    try {
      const conn = this.buildConnectionData(config, null);
      const response = await this.makeAuthenticatedRequest<DrChronoPaginatedResponse<DrChronoPatient>>(config, {
        url: `${this.getBaseUrl(conn)}/api/patients`,
        method: 'get',
        params,
      });
      return { statusCode: response.statusCode, data: response.data };
    } catch (error: unknown) {
      throw error;
    }
  }

  /** Get a single patient by ID via DrChrono REST API */
  async getPatient(patientId: string, config: EhrClientConfig): Promise<EhrResponse<DrChronoPatient>> {
    try {
      const conn = this.buildConnectionData(config, null);
      const response = await this.makeAuthenticatedRequest<DrChronoPatient>(config, {
        url: `${this.getBaseUrl(conn)}/api/patients/${patientId}`,
        method: 'get',
      });
      return { statusCode: response.statusCode, data: response.data };
    } catch (error: unknown) {
      throw error;
    }
  }

  /** Create a patient via DrChrono REST API */
  async createPatient(data: Record<string, unknown>, config: EhrClientConfig): Promise<EhrResponse<DrChronoPatient>> {
    try {
      const conn = this.buildConnectionData(config, null);
      const response = await this.makeAuthenticatedRequest<DrChronoPatient>(config, {
        url: `${this.getBaseUrl(conn)}/api/patients`,
        method: 'post',
        data,
      });
      return { statusCode: 201, data: response.data };
    } catch (error: unknown) {
      throw error;
    }
  }

  // =========================================================================
  // Allergies
  // =========================================================================

  /** Search allergies via DrChrono REST API */
  async searchAllergies(params: Record<string, unknown>, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const response = await this.makeAuthenticatedRequest(config, {
        url: `${this.getBaseUrl(conn)}/api/allergies`,
        method: 'get',
        params,
      });
      return { statusCode: response.statusCode, data: response.data };
    } catch (error: unknown) {
      throw error;
    }
  }

  /** Get a single allergy by ID via DrChrono REST API */
  async getAllergy(allergyId: string, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const response = await this.makeAuthenticatedRequest(config, {
        url: `${this.getBaseUrl(conn)}/api/allergies/${allergyId}`,
        method: 'get',
      });
      return { statusCode: response.statusCode, data: response.data };
    } catch (error: unknown) {
      throw error;
    }
  }

  /** Create an allergy via DrChrono REST API */
  async createAllergy(data: Record<string, unknown>, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const response = await this.makeAuthenticatedRequest(config, {
        url: `${this.getBaseUrl(conn)}/api/allergies`,
        method: 'post',
        data,
      });
      return { statusCode: 201, data: response.data };
    } catch (error: unknown) {
      throw error;
    }
  }

  // =========================================================================
  // Appointments
  // =========================================================================

  /** Search appointments via DrChrono REST API */
  async searchAppointments(params: Record<string, unknown>, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const response = await this.makeAuthenticatedRequest(config, {
        url: `${this.getBaseUrl(conn)}/api/appointments`,
        method: 'get',
        params,
      });
      return { statusCode: response.statusCode, data: response.data };
    } catch (error: unknown) {
      throw error;
    }
  }

  /** Get a single appointment by ID via DrChrono REST API */
  async getAppointment(appointmentId: string, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const response = await this.makeAuthenticatedRequest(config, {
        url: `${this.getBaseUrl(conn)}/api/appointments/${appointmentId}`,
        method: 'get',
      });
      return { statusCode: response.statusCode, data: response.data };
    } catch (error: unknown) {
      throw error;
    }
  }

  // =========================================================================
  // Doctors (Practitioners)
  // =========================================================================

  /** Search doctors via DrChrono REST API */
  async searchDoctors(params: Record<string, unknown>, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const response = await this.makeAuthenticatedRequest(config, {
        url: `${this.getBaseUrl(conn)}/api/doctors`,
        method: 'get',
        params,
      });
      return { statusCode: response.statusCode, data: response.data };
    } catch (error: unknown) {
      throw error;
    }
  }

  /** Get a single doctor by ID via DrChrono REST API */
  async getDoctor(doctorId: string, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const response = await this.makeAuthenticatedRequest(config, {
        url: `${this.getBaseUrl(conn)}/api/doctors/${doctorId}`,
        method: 'get',
      });
      return { statusCode: response.statusCode, data: response.data };
    } catch (error: unknown) {
      throw error;
    }
  }

  // =========================================================================
  // Problems (Conditions)
  // =========================================================================

  /** Search problems via DrChrono REST API */
  async searchProblems(params: Record<string, unknown>, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const response = await this.makeAuthenticatedRequest(config, {
        url: `${this.getBaseUrl(conn)}/api/problems`,
        method: 'get',
        params,
      });
      return { statusCode: response.statusCode, data: response.data };
    } catch (error: unknown) {
      throw error;
    }
  }

  /** Get a single problem by ID via DrChrono REST API */
  async getProblem(problemId: string, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const response = await this.makeAuthenticatedRequest(config, {
        url: `${this.getBaseUrl(conn)}/api/problems/${problemId}`,
        method: 'get',
      });
      return { statusCode: response.statusCode, data: response.data };
    } catch (error: unknown) {
      throw error;
    }
  }

  /** Create a problem via DrChrono REST API */
  async createProblem(data: Record<string, unknown>, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const response = await this.makeAuthenticatedRequest(config, {
        url: `${this.getBaseUrl(conn)}/api/problems`,
        method: 'post',
        data,
      });
      return { statusCode: 201, data: response.data };
    } catch (error: unknown) {
      throw error;
    }
  }

  // =========================================================================
  // Patient Communications
  // =========================================================================

  /** Search patient communications via DrChrono REST API */
  async searchPatientCommunications(
    params: Record<string, unknown>,
    config: EhrClientConfig,
  ): Promise<EhrResponse<DrChronoPaginatedResponse<DrChronoCommunication>>> {
    try {
      const conn = this.buildConnectionData(config, null);
      const response = await this.makeAuthenticatedRequest<DrChronoPaginatedResponse<DrChronoCommunication>>(config, {
        url: `${this.getBaseUrl(conn)}/api/patient_communications`,
        method: 'get',
        params,
      });
      return { statusCode: response.statusCode, data: response.data };
    } catch (error: unknown) {
      throw error;
    }
  }

  /** Get a single patient communication by ID via DrChrono REST API */
  async getPatientCommunication(
    communicationId: string,
    config: EhrClientConfig,
  ): Promise<EhrResponse<DrChronoCommunication>> {
    try {
      const conn = this.buildConnectionData(config, null);
      const response = await this.makeAuthenticatedRequest<DrChronoCommunication>(config, {
        url: `${this.getBaseUrl(conn)}/api/patient_communications/${communicationId}`,
        method: 'get',
      });
      return { statusCode: response.statusCode, data: response.data };
    } catch (error: unknown) {
      throw error;
    }
  }

  /** Create a patient communication via DrChrono REST API */
  async createPatientCommunication(
    data: Record<string, unknown>,
    config: EhrClientConfig,
  ): Promise<EhrResponse<DrChronoCommunication>> {
    try {
      const conn = this.buildConnectionData(config, null);
      const response = await this.makeAuthenticatedRequest<DrChronoCommunication>(config, {
        url: `${this.getBaseUrl(conn)}/api/patient_communications`,
        method: 'post',
        data,
      });
      return { statusCode: 201, data: response.data };
    } catch (error: unknown) {
      throw error;
    }
  }

  // =========================================================================
  // Medications
  // =========================================================================

  /** Search medications via DrChrono REST API */
  async searchMedications(params: Record<string, unknown>, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const response = await this.makeAuthenticatedRequest(config, {
        url: `${this.getBaseUrl(conn)}/api/medications`,
        method: 'get',
        params,
      });
      return { statusCode: response.statusCode, data: response.data };
    } catch (error: unknown) {
      throw error;
    }
  }

  /** Get a single medication by ID via DrChrono REST API */
  async getMedication(medicationId: string, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const response = await this.makeAuthenticatedRequest(config, {
        url: `${this.getBaseUrl(conn)}/api/medications/${medicationId}`,
        method: 'get',
      });
      return { statusCode: response.statusCode, data: response.data };
    } catch (error: unknown) {
      throw error;
    }
  }

  /** Create a medication via DrChrono REST API */
  async createMedication(data: Record<string, unknown>, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const response = await this.makeAuthenticatedRequest(config, {
        url: `${this.getBaseUrl(conn)}/api/medications`,
        method: 'post',
        data,
      });
      return { statusCode: 201, data: response.data };
    } catch (error: unknown) {
      throw error;
    }
  }

  // =========================================================================
  // Documents
  // =========================================================================

  /** Search documents via DrChrono REST API */
  async searchDocuments(params: Record<string, unknown>, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const response = await this.makeAuthenticatedRequest(config, {
        url: `${this.getBaseUrl(conn)}/api/documents`,
        method: 'get',
        params,
      });
      return { statusCode: response.statusCode, data: response.data };
    } catch (error: unknown) {
      throw error;
    }
  }

  /** Get a single document by ID via DrChrono REST API */
  async getDocument(documentId: string, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const response = await this.makeAuthenticatedRequest(config, {
        url: `${this.getBaseUrl(conn)}/api/documents/${documentId}`,
        method: 'get',
      });
      return { statusCode: response.statusCode, data: response.data };
    } catch (error: unknown) {
      throw error;
    }
  }

  // =========================================================================
  // Observations (via appointment verbose endpoint)
  // =========================================================================

  /** Get vitals/observations via DrChrono appointment verbose endpoint */
  async getAppointmentVitals(appointmentId: string, config: EhrClientConfig): Promise<EhrResponse> {
    try {
      const conn = this.buildConnectionData(config, null);
      const response = await this.makeAuthenticatedRequest(config, {
        url: `${this.getBaseUrl(conn)}/api/appointments/${appointmentId}`,
        method: 'get',
        params: { verbose: true },
      });
      return { statusCode: response.statusCode, data: response.data };
    } catch (error: unknown) {
      throw error;
    }
  }

  // =========================================================================
  // Lab Results
  // =========================================================================

  /** Search lab results via DrChrono REST API */
  async searchLabResults(
    params: Record<string, unknown>,
    config: EhrClientConfig,
  ): Promise<EhrResponse<DrChronoPaginatedResponse<DrChronoLabResult>>> {
    try {
      const conn = this.buildConnectionData(config, null);
      const response = await this.makeAuthenticatedRequest<DrChronoPaginatedResponse<DrChronoLabResult>>(config, {
        url: `${this.getBaseUrl(conn)}/api/lab_results`,
        method: 'get',
        params,
      });
      return { statusCode: response.statusCode, data: response.data };
    } catch (error: unknown) {
      throw error;
    }
  }

  /** Get a single lab result by ID via DrChrono REST API */
  async getLabResult(labResultId: string, config: EhrClientConfig): Promise<EhrResponse<DrChronoLabResult>> {
    try {
      const conn = this.buildConnectionData(config, null);
      const response = await this.makeAuthenticatedRequest<DrChronoLabResult>(config, {
        url: `${this.getBaseUrl(conn)}/api/lab_results/${labResultId}`,
        method: 'get',
      });
      return { statusCode: response.statusCode, data: response.data };
    } catch (error: unknown) {
      throw error;
    }
  }

  // =========================================================================
  // Offices
  // =========================================================================

  /** Get offices via DrChrono REST API */
  async getOffices(config: EhrClientConfig): Promise<EhrResponse<DrChronoPaginatedResponse<DrChronoOffice>>> {
    try {
      const conn = this.buildConnectionData(config, null);
      const response = await this.makeAuthenticatedRequest<DrChronoPaginatedResponse<DrChronoOffice>>(config, {
        url: `${this.getBaseUrl(conn)}/api/offices`,
        method: 'get',
      });
      return { statusCode: response.statusCode, data: response.data };
    } catch (error: unknown) {
      throw error;
    }
  }

  /** Get a single office by ID via DrChrono REST API */
  async getOffice(officeId: string, config: EhrClientConfig): Promise<EhrResponse<DrChronoOffice>> {
    try {
      const conn = this.buildConnectionData(config, null);
      const response = await this.makeAuthenticatedRequest<DrChronoOffice>(config, {
        url: `${this.getBaseUrl(conn)}/api/offices/${officeId}`,
        method: 'get',
      });
      return { statusCode: response.statusCode, data: response.data };
    } catch (error: unknown) {
      throw error;
    }
  }

  // =========================================================================
  // Tasks
  // =========================================================================

  /** Search tasks via DrChrono REST API */
  async searchTasks(
    config: EhrClientConfig,
    params: Record<string, unknown>,
  ): Promise<EhrResponse<DrChronoPaginatedResponse<DrChronoTask>>> {
    try {
      const conn = this.buildConnectionData(config, null);
      const response = await this.makeAuthenticatedRequest<DrChronoPaginatedResponse<DrChronoTask>>(config, {
        url: `${this.getBaseUrl(conn)}/api/tasks`,
        method: 'get',
        params,
      });
      return { statusCode: response.statusCode, data: response.data };
    } catch (error: unknown) {
      throw error;
    }
  }

  /** Get a single task by ID via DrChrono REST API */
  async getTask(taskId: string, config: EhrClientConfig): Promise<EhrResponse<DrChronoTask>> {
    try {
      const conn = this.buildConnectionData(config, null);
      const response = await this.makeAuthenticatedRequest<DrChronoTask>(config, {
        url: `${this.getBaseUrl(conn)}/api/tasks/${taskId}`,
        method: 'get',
      });
      return { statusCode: response.statusCode, data: response.data };
    } catch (error: unknown) {
      throw error;
    }
  }
}

export const drchrono = new DrChronoService();

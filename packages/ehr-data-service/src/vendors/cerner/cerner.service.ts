// cerner.service.ts
// Cerner EHR vendor service — raw API layer.
//
// Each method makes an authenticated HTTP call to the Cerner FHIR R4 API
// and returns the raw response. No param filtering or response transformation.

import { BaseEhrService, TokenResult, EhrResponse } from '../../core';
import type { ConnectionData } from '../../core';
import type { EhrClientConfig } from '../../core';
import { httpClient } from '@hs/infra';
import type { Bundle } from '@medplum/fhirtypes';
import type {
  CernerPatient,
  CernerAppointment,
  CernerEncounter,
  CernerCoverage,
  CernerCondition,
  CernerAllergy,
  CernerMedication,
  CernerObservation,
  CernerDocument,
  CernerPractitioner,
} from './cerner.types';

export class CernerService extends BaseEhrService {
  readonly ehrName = 'cerner';

  async getToken(payload: ConnectionData): Promise<TokenResult> {
    try {
      if (!payload?.tenant) {
        throw new Error(JSON.stringify({ code: 400, message: 'Please pass tenant in the payload' }));
      }
      const { grantType, clientId, clientSecret, scope } = payload;
      const data = new URLSearchParams();
      // getToken is the backend/system token exchange (SMART Backend Services),
      // which is always client_credentials — default it so a system app whose
      // config omits grantType still sends a valid grant_type (Cerner rejects a
      // blank one). An explicitly configured grantType still wins.
      data.append('grant_type', grantType || 'client_credentials');
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
      return { accessToken: response?.data?.access_token, expiresIn: response?.data?.expires_in - 30 };
    } catch (error: any) {
      throw this.handleAuthError(error);
    }
  }

  // Resolves the FHIR base URL for the tenant via centralized config.
  private getCernerBaseUrl(connectionData: ConnectionData): string {
    return this.getResolvedBaseUrl(connectionData);
  }

  // ---------------------------------------------------------------------------
  // Patient
  // ---------------------------------------------------------------------------

  /**
   * Search Cerner patients by demographics or identifier. Returns a FHIR R4
   * Bundle of matching Patient resources. Use this to find a patient when you
   * do NOT already have their Cerner Patient ID — e.g. by name + birthdate or
   * by MRN/identifier. To read one patient by a known ID use `cerner_getPatient`.
   * @mcptool
   * @mcpparams SearchPatientsParams
   */
  async searchPatients(
    config: EhrClientConfig,
    params: Record<string, string>,
  ): Promise<EhrResponse<Bundle<CernerPatient>>> {
    const conn = this.buildConnectionData(config, null);
    return this.makeAuthenticatedRequest<Bundle<CernerPatient>>(config, {
      url: `${this.getCernerBaseUrl(conn)}/Patient`,
      method: 'get',
      params,
    });
  }

  /**
   * Read a single Cerner Patient by its Cerner Patient ID. Returns the raw
   * FHIR R4 Patient — name, identifiers, birthDate, gender, address, telecom,
   * communication preferences. Use when you already have a Patient ID (e.g.
   * from `cerner_searchPatients`); for name/DOB/MRN lookup use that search.
   * @mcptool
   * @mcpparams GetPatientParams
   */
  async getPatient(config: EhrClientConfig, id: string): Promise<EhrResponse<CernerPatient>> {
    const conn = this.buildConnectionData(config, null);
    return this.makeAuthenticatedRequest<CernerPatient>(config, {
      url: `${this.getCernerBaseUrl(conn)}/Patient/${id}`,
      method: 'get',
    });
  }

  /**
   * Create a new Cerner Patient. Takes a full FHIR R4 Patient resource and
   * POSTs it. Returns the created Patient (with its assigned ID). Use only
   * when registering a patient the EHR doesn't already have — search first.
   * @mcptool
   * @mcpparams CreatePatientParams
   */
  async createPatient(config: EhrClientConfig, data: Record<string, any>): Promise<EhrResponse<CernerPatient>> {
    const conn = this.buildConnectionData(config, null);
    return this.makeAuthenticatedRequest<CernerPatient>(config, {
      url: `${this.getCernerBaseUrl(conn)}/Patient`,
      method: 'post',
      data,
    });
  }

  // ---------------------------------------------------------------------------
  // Appointment
  // ---------------------------------------------------------------------------

  /**
   * Search Cerner Appointments. Returns a FHIR R4 Bundle. Filter by patient,
   * practitioner, location, date range, or status. For one appointment by ID
   * use `cerner_getAppointment`.
   * @mcptool
   * @mcpparams SearchAppointmentsParams
   */
  async searchAppointments(
    config: EhrClientConfig,
    params: Record<string, any>,
  ): Promise<EhrResponse<Bundle<CernerAppointment>>> {
    const conn = this.buildConnectionData(config, null);
    return this.makeAuthenticatedRequest<Bundle<CernerAppointment>>(config, {
      url: `${this.getCernerBaseUrl(conn)}/Appointment`,
      method: 'get',
      params,
    });
  }

  /**
   * Read a single Cerner Appointment by its ID. Returns the raw FHIR R4
   * Appointment — status, start/end, participants (patient, practitioner,
   * location), appointment type, and reason. Use when you have an
   * Appointment ID; for a patient's schedule use an Appointment search.
   * @mcptool
   * @mcpparams GetAppointmentParams
   */
  async getAppointment(config: EhrClientConfig, id: string): Promise<EhrResponse<CernerAppointment>> {
    const conn = this.buildConnectionData(config, null);
    return this.makeAuthenticatedRequest<CernerAppointment>(config, {
      url: `${this.getCernerBaseUrl(conn)}/Appointment/${id}`,
      method: 'get',
    });
  }

  // ---------------------------------------------------------------------------
  // Encounter
  // ---------------------------------------------------------------------------

  /**
   * Search Cerner Encounters (visits). Returns a FHIR R4 Bundle. Filter by
   * patient, date range, status, or class. For one encounter by ID use
   * `cerner_getEncounter`.
   * @mcptool
   * @mcpparams SearchEncountersParams
   */
  async searchEncounters(
    config: EhrClientConfig,
    params: Record<string, any>,
  ): Promise<EhrResponse<Bundle<CernerEncounter>>> {
    const conn = this.buildConnectionData(config, null);
    return this.makeAuthenticatedRequest<Bundle<CernerEncounter>>(config, {
      url: `${this.getCernerBaseUrl(conn)}/Encounter`,
      method: 'get',
      params,
    });
  }

  /**
   * Read a single Cerner Encounter by its ID. Returns the raw FHIR R4
   * Encounter — class, status, period, type, participants, reason, and
   * the linked patient. Use when you have an Encounter ID (e.g. referenced
   * by a Condition or Observation).
   * @mcptool
   * @mcpparams GetEncounterParams
   */
  async getEncounter(config: EhrClientConfig, id: string): Promise<EhrResponse<CernerEncounter>> {
    const conn = this.buildConnectionData(config, null);
    return this.makeAuthenticatedRequest<CernerEncounter>(config, {
      url: `${this.getCernerBaseUrl(conn)}/Encounter/${id}`,
      method: 'get',
    });
  }

  // ---------------------------------------------------------------------------
  // Coverage
  // ---------------------------------------------------------------------------

  /**
   * Search Cerner Coverage (insurance) resources. Returns a FHIR R4 Bundle.
   * Filter by patient/beneficiary, payor, or status. For one coverage by ID
   * use `cerner_getCoverage`.
   * @mcptool
   * @mcpparams SearchCoveragesParams
   */
  async searchCoverages(
    config: EhrClientConfig,
    params: Record<string, any>,
  ): Promise<EhrResponse<Bundle<CernerCoverage>>> {
    const conn = this.buildConnectionData(config, null);
    return this.makeAuthenticatedRequest<Bundle<CernerCoverage>>(config, {
      url: `${this.getCernerBaseUrl(conn)}/Coverage`,
      method: 'get',
      params,
    });
  }

  /**
   * Read a single Cerner Coverage (insurance) resource by ID. Returns the raw
   * FHIR R4 Coverage — status, beneficiary, payor, subscriber, type, period.
   * @mcptool
   * @mcpparams GetCoverageParams
   */
  async getCoverage(config: EhrClientConfig, id: string): Promise<EhrResponse<CernerCoverage>> {
    const conn = this.buildConnectionData(config, null);
    return this.makeAuthenticatedRequest<CernerCoverage>(config, {
      url: `${this.getCernerBaseUrl(conn)}/Coverage/${id}`,
      method: 'get',
    });
  }

  /**
   * Create a Cerner Coverage (insurance) resource. Takes a full FHIR R4
   * Coverage and POSTs it. Returns the created Coverage with its ID.
   * @mcptool
   * @mcpparams CreateCoverageParams
   */
  async createCoverage(config: EhrClientConfig, data: Record<string, any>): Promise<EhrResponse<CernerCoverage>> {
    const conn = this.buildConnectionData(config, null);
    return this.makeAuthenticatedRequest<CernerCoverage>(config, {
      url: `${this.getCernerBaseUrl(conn)}/Coverage`,
      method: 'post',
      data,
    });
  }

  // ---------------------------------------------------------------------------
  // Condition
  // ---------------------------------------------------------------------------

  /**
   * Search Cerner Conditions (problems / diagnoses) for a patient. Returns a
   * FHIR R4 Bundle of Condition resources. Cerner requires the `patient`
   * parameter. Filter by `category` (problem-list-item vs encounter-diagnosis)
   * or `clinical-status`. To read one Condition by ID use `cerner_getCondition`.
   * @mcptool
   * @mcpparams SearchConditionsParams
   */
  async searchConditions(
    config: EhrClientConfig,
    params: Record<string, any>,
  ): Promise<EhrResponse<Bundle<CernerCondition>>> {
    const conn = this.buildConnectionData(config, null);
    return this.makeAuthenticatedRequest<Bundle<CernerCondition>>(config, {
      url: `${this.getCernerBaseUrl(conn)}/Condition`,
      method: 'get',
      params,
    });
  }

  /**
   * Read a single Cerner Condition by its ID. Returns the raw FHIR R4
   * Condition — clinicalStatus, verificationStatus, category, code, onset,
   * recordedDate, and note[]. Use when you have a Condition ID; for a
   * patient's problem list use `cerner_searchConditions`.
   * @mcptool
   * @mcpparams GetConditionParams
   */
  async getCondition(config: EhrClientConfig, id: string): Promise<EhrResponse<CernerCondition>> {
    const conn = this.buildConnectionData(config, null);
    return this.makeAuthenticatedRequest<CernerCondition>(config, {
      url: `${this.getCernerBaseUrl(conn)}/Condition/${id}`,
      method: 'get',
    });
  }

  /**
   * Create a Cerner Condition (problem / diagnosis). Takes a full FHIR R4
   * Condition and POSTs it. Cerner constraints: clinicalStatus must be active
   * /recurrence/relapse/inactive/remission/resolved (`refuted` and
   * `entered-in-error` are NOT reachable on create — record active then flip
   * via `cerner_updateCondition`). For `encounter-diagnosis` category,
   * clinicalStatus must be active and abatement/severity are rejected.
   * `note[]` IS accepted here but becomes immutable afterwards.
   * @mcptool
   * @mcpparams CreateConditionParams
   */
  async createCondition(config: EhrClientConfig, data: Record<string, any>): Promise<EhrResponse<CernerCondition>> {
    const conn = this.buildConnectionData(config, null);
    return this.makeAuthenticatedRequest<CernerCondition>(config, {
      url: `${this.getCernerBaseUrl(conn)}/Condition`,
      method: 'post',
      data,
    });
  }

  /**
   * Update a Cerner Condition (FHIR R4 PUT). Cerner REQUIRES `If-Match`
   * (`options.ifMatch` = `W/"<versionId>"` from the resource's
   * `meta.versionId`) — fetch via `cerner_getCondition` first. `code`,
   * `category`, and `note` are IMMUTABLE — Cerner returns 200 but silently
   * discards changes; send their existing values verbatim. Set
   * `clinicalStatus`/`verificationStatus` to change lifecycle (this is the
   * only way to reach `refuted` / `entered-in-error`).
   * @mcptool
   * @mcpparams UpdateConditionParams
   */
  async updateCondition(
    config: EhrClientConfig,
    id: string,
    data: Record<string, any>,
    options?: { ifMatch?: string },
  ): Promise<EhrResponse<CernerCondition>> {
    const conn = this.buildConnectionData(config, null);
    return this.makeAuthenticatedRequest<CernerCondition>(config, {
      url: `${this.getCernerBaseUrl(conn)}/Condition/${id}`,
      method: 'put',
      data,
      // Cerner Millennium requires If-Match for PUT — server compares against the
      // ETag returned by the most recent GET. Pass through verbatim.
      ...(options?.ifMatch ? { headers: { 'If-Match': options.ifMatch } } : {}),
    });
  }

  // ---------------------------------------------------------------------------
  // AllergyIntolerance
  // ---------------------------------------------------------------------------

  /**
   * Search Cerner AllergyIntolerance resources. Returns a FHIR R4 Bundle.
   * Filter by patient, clinical-status, or verification-status. For one
   * allergy by ID use `cerner_getAllergy`.
   * @mcptool
   * @mcpparams SearchAllergiesParams
   */
  async searchAllergies(
    config: EhrClientConfig,
    params: Record<string, any>,
  ): Promise<EhrResponse<Bundle<CernerAllergy>>> {
    const conn = this.buildConnectionData(config, null);
    return this.makeAuthenticatedRequest<Bundle<CernerAllergy>>(config, {
      url: `${this.getCernerBaseUrl(conn)}/AllergyIntolerance`,
      method: 'get',
      params,
    });
  }

  /**
   * Read a single Cerner AllergyIntolerance by its ID. Returns the raw FHIR
   * R4 AllergyIntolerance — clinicalStatus, verificationStatus, code, the
   * substance, criticality, and reaction[]. Use when you have an
   * AllergyIntolerance ID.
   * @mcptool
   * @mcpparams GetAllergyParams
   */
  async getAllergy(config: EhrClientConfig, id: string): Promise<EhrResponse<CernerAllergy>> {
    const conn = this.buildConnectionData(config, null);
    return this.makeAuthenticatedRequest<CernerAllergy>(config, {
      url: `${this.getCernerBaseUrl(conn)}/AllergyIntolerance/${id}`,
      method: 'get',
    });
  }

  /**
   * Create a Cerner AllergyIntolerance. Takes a full FHIR R4
   * AllergyIntolerance and POSTs it. Returns the created resource with its ID.
   * @mcptool
   * @mcpparams CreateAllergyParams
   */
  async createAllergy(config: EhrClientConfig, data: Record<string, any>): Promise<EhrResponse<CernerAllergy>> {
    const conn = this.buildConnectionData(config, null);
    return this.makeAuthenticatedRequest<CernerAllergy>(config, {
      url: `${this.getCernerBaseUrl(conn)}/AllergyIntolerance`,
      method: 'post',
      data,
    });
  }

  // ---------------------------------------------------------------------------
  // MedicationRequest
  // ---------------------------------------------------------------------------

  /**
   * Search Cerner MedicationRequest resources — a patient's medications/orders
   * on Cerner Millennium. Returns a FHIR R4 Bundle. Filter by patient, status,
   * intent, or encounter. For one by ID use `cerner_getMedicationRequest`.
   * @mcptool
   * @mcpparams SearchMedicationRequestsParams
   */
  async searchMedicationRequests(
    config: EhrClientConfig,
    params: Record<string, any>,
  ): Promise<EhrResponse<Bundle<any>>> {
    const conn = this.buildConnectionData(config, null);
    return this.makeAuthenticatedRequest<Bundle<any>>(config, {
      url: `${this.getCernerBaseUrl(conn)}/MedicationRequest`,
      method: 'get',
      params,
    });
  }

  /**
   * Read a single Cerner MedicationRequest by ID. Returns the raw FHIR R4
   * MedicationRequest — status, intent, medication, dosageInstruction,
   * requester, authoredOn.
   * @mcptool
   * @mcpparams GetMedicationRequestParams
   */
  async getMedicationRequest(config: EhrClientConfig, id: string): Promise<EhrResponse<any>> {
    const conn = this.buildConnectionData(config, null);
    return this.makeAuthenticatedRequest<any>(config, {
      url: `${this.getCernerBaseUrl(conn)}/MedicationRequest/${id}`,
      method: 'get',
    });
  }

  // ---------------------------------------------------------------------------
  // MedicationStatement
  // ---------------------------------------------------------------------------

  /**
   * Search Cerner MedicationStatement resources. Returns a FHIR R4 Bundle.
   * NOTE: Cerner Millennium generally does NOT support MedicationStatement —
   * prefer `cerner_searchMedicationRequests` for a patient's medications.
   * Exposed for completeness / non-Millennium tenants.
   * @mcptool
   * @mcpparams SearchMedicationStatementsParams
   */
  async searchMedicationStatements(
    config: EhrClientConfig,
    params: Record<string, any>,
  ): Promise<EhrResponse<Bundle<CernerMedication>>> {
    const conn = this.buildConnectionData(config, null);
    return this.makeAuthenticatedRequest<Bundle<CernerMedication>>(config, {
      url: `${this.getCernerBaseUrl(conn)}/MedicationStatement`,
      method: 'get',
      params,
    });
  }

  /**
   * Read a single Cerner MedicationStatement by ID. Returns the raw FHIR R4
   * MedicationStatement. NOTE: Cerner Millennium generally does not support
   * this resource — prefer `cerner_getMedicationRequest`.
   * @mcptool
   * @mcpparams GetMedicationStatementParams
   */
  async getMedicationStatement(config: EhrClientConfig, id: string): Promise<EhrResponse<CernerMedication>> {
    const conn = this.buildConnectionData(config, null);
    return this.makeAuthenticatedRequest<CernerMedication>(config, {
      url: `${this.getCernerBaseUrl(conn)}/MedicationStatement/${id}`,
      method: 'get',
    });
  }

  // ---------------------------------------------------------------------------
  // Observation
  // ---------------------------------------------------------------------------

  /**
   * Search Cerner Observations (vitals, labs, etc.). Returns a FHIR R4 Bundle.
   * Cerner commonly requires `category` (e.g. `vital-signs`, `laboratory`)
   * alongside `patient`. Filter also by code, date, status. For one by ID use
   * `cerner_getObservation`.
   * @mcptool
   * @mcpparams SearchObservationsParams
   */
  async searchObservations(
    config: EhrClientConfig,
    params: Record<string, any>,
  ): Promise<EhrResponse<Bundle<CernerObservation>>> {
    const conn = this.buildConnectionData(config, null);
    return this.makeAuthenticatedRequest<Bundle<CernerObservation>>(config, {
      url: `${this.getCernerBaseUrl(conn)}/Observation`,
      method: 'get',
      params,
    });
  }

  /**
   * Read a single Cerner Observation by its ID. Returns the raw FHIR R4
   * Observation — status, category, code, value[x], effective time,
   * reference ranges, and interpretation. Use when you have an Observation
   * ID (e.g. a lab result or vital sign).
   * @mcptool
   * @mcpparams GetObservationParams
   */
  async getObservation(config: EhrClientConfig, id: string): Promise<EhrResponse<CernerObservation>> {
    const conn = this.buildConnectionData(config, null);
    return this.makeAuthenticatedRequest<CernerObservation>(config, {
      url: `${this.getCernerBaseUrl(conn)}/Observation/${id}`,
      method: 'get',
    });
  }

  /**
   * Create a Cerner Observation. Takes a full FHIR R4 Observation and POSTs
   * it. Returns the created Observation with its ID.
   * @mcptool
   * @mcpparams CreateObservationParams
   */
  async createObservation(config: EhrClientConfig, data: Record<string, any>): Promise<EhrResponse<CernerObservation>> {
    const conn = this.buildConnectionData(config, null);
    return this.makeAuthenticatedRequest<CernerObservation>(config, {
      url: `${this.getCernerBaseUrl(conn)}/Observation`,
      method: 'post',
      data,
    });
  }

  // ---------------------------------------------------------------------------
  // DocumentReference
  // ---------------------------------------------------------------------------

  /**
   * Search Cerner DocumentReference resources (clinical notes/documents).
   * Returns a FHIR R4 Bundle. Filter by patient, type, category, date, status.
   * For one by ID use `cerner_getDocumentReference`.
   * @mcptool
   * @mcpparams SearchDocumentReferencesParams
   */
  async searchDocumentReferences(
    config: EhrClientConfig,
    params: Record<string, any>,
  ): Promise<EhrResponse<Bundle<CernerDocument>>> {
    const conn = this.buildConnectionData(config, null);
    return this.makeAuthenticatedRequest<Bundle<CernerDocument>>(config, {
      url: `${this.getCernerBaseUrl(conn)}/DocumentReference`,
      method: 'get',
      params,
    });
  }

  /**
   * Read a single Cerner DocumentReference by ID. Returns the raw FHIR R4
   * DocumentReference — status, type, category, subject, date, content
   * (attachment metadata + data/url).
   * @mcptool
   * @mcpparams GetDocumentReferenceParams
   */
  async getDocumentReference(config: EhrClientConfig, id: string): Promise<EhrResponse<CernerDocument>> {
    const conn = this.buildConnectionData(config, null);
    return this.makeAuthenticatedRequest<CernerDocument>(config, {
      url: `${this.getCernerBaseUrl(conn)}/DocumentReference/${id}`,
      method: 'get',
    });
  }

  /**
   * Create a Cerner DocumentReference (e.g. attach a clinical note). Takes a
   * full FHIR R4 DocumentReference and POSTs it. Returns the created resource.
   * @mcptool
   * @mcpparams CreateDocumentReferenceParams
   */
  async createDocumentReference(
    config: EhrClientConfig,
    data: Record<string, any>,
  ): Promise<EhrResponse<CernerDocument>> {
    const conn = this.buildConnectionData(config, null);
    return this.makeAuthenticatedRequest<CernerDocument>(config, {
      url: `${this.getCernerBaseUrl(conn)}/DocumentReference`,
      method: 'post',
      data,
    });
  }

  // ---------------------------------------------------------------------------
  // Practitioner
  // ---------------------------------------------------------------------------

  /**
   * Search Cerner Practitioners (providers). Returns a FHIR R4 Bundle. Not
   * patient-scoped — filter by identifier (NPI), name, family/given, or _id.
   * For one by ID use `cerner_getPractitioner`.
   * @mcptool
   * @mcpparams SearchPractitionersParams
   */
  async searchPractitioners(
    config: EhrClientConfig,
    params: Record<string, any>,
  ): Promise<EhrResponse<Bundle<CernerPractitioner>>> {
    const conn = this.buildConnectionData(config, null);
    return this.makeAuthenticatedRequest<Bundle<CernerPractitioner>>(config, {
      url: `${this.getCernerBaseUrl(conn)}/Practitioner`,
      method: 'get',
      params,
    });
  }

  /**
   * Read a single Cerner Practitioner by ID. Returns the raw FHIR R4
   * Practitioner — name, identifiers (NPI), qualification, telecom.
   * @mcptool
   * @mcpparams GetPractitionerParams
   */
  async getPractitioner(config: EhrClientConfig, id: string): Promise<EhrResponse<CernerPractitioner>> {
    const conn = this.buildConnectionData(config, null);
    return this.makeAuthenticatedRequest<CernerPractitioner>(config, {
      url: `${this.getCernerBaseUrl(conn)}/Practitioner/${id}`,
      method: 'get',
    });
  }

  // ---------------------------------------------------------------------------
  // Communication
  // ---------------------------------------------------------------------------

  /**
   * Search Cerner Communication resources. Returns a FHIR R4 Bundle. Filter by
   * patient, status, category, or encounter. For one by ID use
   * `cerner_getCommunication`.
   * @mcptool
   * @mcpparams SearchCommunicationsParams
   */
  async searchCommunications(config: EhrClientConfig, params: Record<string, any>): Promise<EhrResponse<Bundle<any>>> {
    const conn = this.buildConnectionData(config, null);
    return this.makeAuthenticatedRequest<Bundle<any>>(config, {
      url: `${this.getCernerBaseUrl(conn)}/Communication`,
      method: 'get',
      params,
    });
  }

  /**
   * Read a single Cerner Communication by ID. Returns the raw FHIR R4
   * Communication — status, category, subject, sender, recipient, payload.
   * @mcptool
   * @mcpparams GetCommunicationParams
   */
  async getCommunication(config: EhrClientConfig, id: string): Promise<EhrResponse<any>> {
    const conn = this.buildConnectionData(config, null);
    return this.makeAuthenticatedRequest<any>(config, {
      url: `${this.getCernerBaseUrl(conn)}/Communication/${id}`,
      method: 'get',
    });
  }

  /**
   * Create a Cerner Communication. Takes a full FHIR R4 Communication and
   * POSTs it. Returns the created resource with its ID.
   * @mcptool
   * @mcpparams CreateCommunicationParams
   */
  async createCommunication(config: EhrClientConfig, data: Record<string, any>): Promise<EhrResponse<any>> {
    const conn = this.buildConnectionData(config, null);
    return this.makeAuthenticatedRequest<any>(config, {
      url: `${this.getCernerBaseUrl(conn)}/Communication`,
      method: 'post',
      data,
    });
  }

  // ---------------------------------------------------------------------------
  // ServiceRequest
  // ---------------------------------------------------------------------------

  /**
   * Search Cerner ServiceRequest resources (orders/referrals). Returns a FHIR
   * R4 Bundle. Filter by patient, status, category, code, or encounter. For
   * one by ID use `cerner_getServiceRequest`.
   * @mcptool
   * @mcpparams SearchServiceRequestsParams
   */
  async searchServiceRequests(config: EhrClientConfig, params: Record<string, any>): Promise<EhrResponse<Bundle<any>>> {
    const conn = this.buildConnectionData(config, null);
    return this.makeAuthenticatedRequest<Bundle<any>>(config, {
      url: `${this.getCernerBaseUrl(conn)}/ServiceRequest`,
      method: 'get',
      params,
    });
  }

  /**
   * Read a single Cerner ServiceRequest by ID. Returns the raw FHIR R4
   * ServiceRequest — status, intent, category, code, subject, requester.
   * @mcptool
   * @mcpparams GetServiceRequestParams
   */
  async getServiceRequest(config: EhrClientConfig, id: string): Promise<EhrResponse<any>> {
    const conn = this.buildConnectionData(config, null);
    return this.makeAuthenticatedRequest<any>(config, {
      url: `${this.getCernerBaseUrl(conn)}/ServiceRequest/${id}`,
      method: 'get',
    });
  }
}

export const cerner = new CernerService();

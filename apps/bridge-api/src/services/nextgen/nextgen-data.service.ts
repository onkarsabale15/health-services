// nextgen-data.service.ts
// Bridge data service for NextGen — maps FHIR params, delegates to @hs/ehr-data-service,
// and transforms responses back to FHIR R4 via the NextGen mapper.
//
// NextGen has two API surfaces:
//   1. FHIR R4 endpoints — Patient, Encounter, Coverage, Condition, Practitioner,
//      AllergyIntolerance, Observation, ServiceRequest, MedicationStatement
//   2. Native REST API — Appointments, Alerts (Communication), SOAP Notes
//      (DocumentReference), Persons (Patient create), Insurances (Coverage create),
//      Problems (Condition create)
//
// FHIR-native endpoints return standard FHIR bundles, so response transformation
// is minimal. Native endpoints require full EHR→FHIR response mapping via nextgenUtils.

import { nextgen, toEhrConfig } from '@hs/ehr-data-service';
import type { SiteData } from '@hs/ehr-data-service';
import { logger } from '@hs/observability';

import type { IVendorDataService } from '../vendor-data-service.interface';
import { nextgenUtils, nextgenAppointmentLookup } from './nextgen.mapper';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// NextgenDataService
// ---------------------------------------------------------------------------

class NextgenDataService implements IVendorDataService {
  // =========================================================================
  // Patient
  // =========================================================================

  /** FHIR R4 Patient search — NextGen supports this natively via FHIR endpoint */
  async searchPatient(siteData: SiteData, params: Record<string, any>): Promise<any> {
    const config = toEhrConfig(siteData);
    const response = await nextgen.fhirPatientSearch(params, config);
    return response.data;
  }

  /** FHIR R4 Patient read by ID — natively supported */
  async getPatientById(siteData: SiteData, id: string): Promise<any> {
    const config = toEhrConfig(siteData);
    const response = await nextgen.getPatientById(id, config);
    return response.data;
  }

  /**
   * Create patient via NextGen native REST API (persons endpoint).
   * Maps incoming FHIR Patient body to NextGen person format before sending.
   */
  async createPatient(siteData: SiteData, body: any): Promise<any> {
    const config = toEhrConfig(siteData);
    const ehrBody = await nextgenUtils.convertPatientFhirToEhr(body);
    const response = await nextgen.nativePersonCreate(ehrBody, config);
    return response.data;
  }

  // =========================================================================
  // Appointment (NextGen native REST API — not FHIR)
  // =========================================================================

  /**
   * Search appointments via NextGen native REST API.
   * Maps FHIR search params (patient, date, _id) to NextGen native params
   * (personId, date, id), then converts response to FHIR Appointment Bundle.
   */
  async searchAppointment(siteData: SiteData, params: Record<string, any>): Promise<any> {
    const config = toEhrConfig(siteData);
    const nativeParams = nextgenAppointmentLookup(params);
    const response = await nextgen.nativeAppointmentSearch(nativeParams, config);
    return nextgenUtils.convertAppointmentEhrToFhir(response.data, true);
  }

  /**
   * Get single appointment by ID via NextGen native REST API.
   * Response is a single native appointment object — convert to FHIR Appointment.
   */
  async getAppointmentById(siteData: SiteData, id: string): Promise<any> {
    const config = toEhrConfig(siteData);
    const response = await nextgen.getAppointmentById(id, config);
    return nextgenUtils.convertAppointmentEhrToFhir(response.data, false);
  }

  // =========================================================================
  // Encounter (FHIR R4 — natively supported)
  // =========================================================================

  async searchEncounter(siteData: SiteData, params: Record<string, any>): Promise<any> {
    const config = toEhrConfig(siteData);
    const response = await nextgen.fhirEncounterSearch(params, config);
    return response.data;
  }

  async getEncounterById(siteData: SiteData, id: string): Promise<any> {
    const config = toEhrConfig(siteData);
    const response = await nextgen.getEncounterById(id, config);
    return response.data;
  }

  // =========================================================================
  // Coverage (FHIR R4 search + native create)
  // =========================================================================

  async searchCoverage(siteData: SiteData, params: Record<string, any>): Promise<any> {
    const config = toEhrConfig(siteData);
    const response = await nextgen.fhirCoverageSearch(params, config);
    return response.data;
  }

  async getCoverageById(siteData: SiteData, id: string): Promise<any> {
    const config = toEhrConfig(siteData);
    const response = await nextgen.getCoverageById(id, config);
    return response.data;
  }

  /**
   * Create coverage via NextGen native REST API (insurances endpoint).
   * Maps FHIR Coverage body to NextGen insurance format, extracts personId
   * from the beneficiary reference.
   */
  async createCoverage(siteData: SiteData, body: any): Promise<any> {
    const config = toEhrConfig(siteData);
    const personId = body?.beneficiary?.reference?.split('/')?.pop();
    if (!personId) {
      throw new Error('Coverage.beneficiary reference with Patient ID is required');
    }
    const ehrBody = await nextgenUtils.convertCoverageToEHR(body);
    const response = await nextgen.nativeInsuranceCreate(personId, ehrBody, config);
    return response.data;
  }

  // =========================================================================
  // Condition (FHIR R4 search + native create)
  // =========================================================================

  async searchCondition(siteData: SiteData, params: Record<string, any>): Promise<any> {
    const config = toEhrConfig(siteData);
    const response = await nextgen.fhirConditionSearch(params, config);
    return response.data;
  }

  async getConditionById(siteData: SiteData, id: string): Promise<any> {
    const config = toEhrConfig(siteData);
    const response = await nextgen.getConditionById(id, config);
    return response.data;
  }

  /**
   * Create condition via NextGen native REST API (problems endpoint).
   * Maps FHIR Condition to NextGen problem format. Optionally creates a
   * diagnosis on the encounter if an encounter reference is present.
   */
  async createCondition(siteData: SiteData, body: any): Promise<any> {
    const config = toEhrConfig(siteData);
    const personId = body?.subject?.reference?.split('/')?.pop();
    if (!personId) {
      throw new Error('Condition.subject reference with Patient ID is required');
    }

    const ehrBody = await nextgenUtils.convertConditionFhirToEHR(body);
    const encounterId = body?.encounter?.reference?.split('/')?.pop();

    // If encounter reference provided, create diagnosis on encounter + problem
    if (encounterId) {
      const [problemResponse, diagnosisResponse] = await Promise.all([
        nextgen.nativeProblemCreate(personId, ehrBody, config),
        nextgen.nativeDiagnosisCreate(personId, encounterId, ehrBody, config),
      ]);
      return {
        problem: problemResponse.data,
        diagnosis: diagnosisResponse.data,
      };
    }

    // No encounter — create problem only
    const response = await nextgen.nativeProblemCreate(personId, ehrBody, config);
    return response.data;
  }

  // =========================================================================
  // Practitioner (FHIR R4 — natively supported)
  // =========================================================================

  async searchPractitioner(siteData: SiteData, params: Record<string, any>): Promise<any> {
    const config = toEhrConfig(siteData);
    const response = await nextgen.fhirPractitionerSearch(params, config);
    return response.data;
  }

  async getPractitionerById(siteData: SiteData, id: string): Promise<any> {
    const config = toEhrConfig(siteData);
    const response = await nextgen.getPractitionerById(id, config);
    return response.data;
  }

  // =========================================================================
  // AllergyIntolerance (FHIR R4 search/read + native create)
  // =========================================================================

  async searchAllergy(siteData: SiteData, params: Record<string, any>): Promise<any> {
    const config = toEhrConfig(siteData);
    const response = await nextgen.fhirAllergySearch(params, config);
    return response.data;
  }

  async getAllergyById(siteData: SiteData, id: string): Promise<any> {
    const config = toEhrConfig(siteData);
    const response = await nextgen.getAllergyById(id, config);
    return response.data;
  }

  // =========================================================================
  // ServiceRequest (FHIR R4 — natively supported)
  // =========================================================================

  async searchServiceRequest(siteData: SiteData, params: Record<string, any>): Promise<any> {
    const config = toEhrConfig(siteData);
    const response = await nextgen.fhirServiceRequestSearch(params, config);
    return response.data;
  }

  async getServiceRequestById(siteData: SiteData, id: string): Promise<any> {
    const config = toEhrConfig(siteData);
    const response = await nextgen.getServiceRequestById(id, config);
    return response.data;
  }

  // =========================================================================
  // MedicationStatement (FHIR R4 — natively supported)
  // =========================================================================

  async searchMedicationStatement(siteData: SiteData, params: Record<string, any>): Promise<any> {
    const config = toEhrConfig(siteData);
    const response = await nextgen.fhirMedicationStatementSearch(params, config);
    return response.data;
  }

  async getMedicationStatementById(siteData: SiteData, id: string): Promise<any> {
    const config = toEhrConfig(siteData);
    const response = await nextgen.getMedicationStatementById(id, config);
    return response.data;
  }

  // =========================================================================
  // Communication / Alerts (NextGen native REST API)
  //
  // NextGen uses "alerts" as the Communication equivalent. The alert API
  // requires a personId for all operations. We map FHIR Communication
  // bodies to NextGen alert format and transform responses back to FHIR.
  // =========================================================================

  /**
   * Search communications (alerts) for a patient.
   * Requires `patient` param (mapped to personId for native alert search).
   * Transforms native alert response to FHIR Communication Bundle.
   */
  async searchCommunication(siteData: SiteData, params: Record<string, any>): Promise<any> {
    const config = toEhrConfig(siteData);
    const personId = params?.patient;
    if (!personId) {
      throw new Error('Communication search requires patient parameter');
    }
    const response = await nextgen.nativeAlertSearch(personId, config);
    return nextgenUtils.alertToFhirCommunication(response.data, true);
  }

  /**
   * Get a single communication by ID.
   * NextGen does not have a direct alert-by-ID endpoint, so we search
   * alerts for the person and filter. Falls back to returning the full list.
   */
  async getCommunicationById(siteData: SiteData, id: string): Promise<any> {
    logger.warn('NextGen getCommunicationById: no direct ID lookup, using alert search', { id });
    const config = toEhrConfig(siteData);
    const response = await nextgen.nativeAlertSearch(id, config);
    return nextgenUtils.alertToFhirCommunication(response.data, false);
  }

  /**
   * Create a communication (alert) via NextGen native REST API.
   * Maps FHIR Communication body to NextGen alert format.
   * Requires subject reference with Patient ID (used as personId).
   */
  async createCommunication(siteData: SiteData, body: any): Promise<any> {
    const config = toEhrConfig(siteData);
    const personId = body?.subject?.reference?.split('/')?.pop();
    if (!personId) {
      throw new Error('Communication.subject reference with Patient ID is required');
    }
    const alertBody = await nextgenUtils.communicationToAlert(body);
    const response = await nextgen.nativeAlertCreate(personId, alertBody, config);
    return response.data;
  }

  // =========================================================================
  // Observation (FHIR R4 — natively supported)
  // =========================================================================

  async searchObservation(siteData: SiteData, params: Record<string, any>): Promise<any> {
    const config = toEhrConfig(siteData);
    const response = await nextgen.fhirObservationSearch(params, config);
    return response.data;
  }

  async getObservationById(siteData: SiteData, id: string): Promise<any> {
    const config = toEhrConfig(siteData);
    const response = await nextgen.getObservationById(id, config);
    return response.data;
  }

  // =========================================================================
  // DocumentReference / SOAP Notes / Clinical Notes (NextGen native REST API)
  //
  // NextGen uses native SOAP notes and clinical notes endpoints.
  // - Search: if encounterId + personId provided → SOAP notes for encounter
  //           if only personId → clinical notes for person
  // - Create: maps FHIR DocumentReference to SOAP note body, creates on encounter
  // - Response: native notes → FHIR DocumentReference via mapper
  // =========================================================================

  /**
   * Search document references. Routes to SOAP notes (if encounterId present)
   * or clinical notes (if only personId present).
   * Transforms native response to FHIR DocumentReference format.
   */
  async searchDocumentReference(siteData: SiteData, params: Record<string, any>): Promise<any> {
    const config = toEhrConfig(siteData);
    const personId = params?.patient;
    const encounterId = params?.encounter;

    if (!personId) {
      throw new Error('DocumentReference search requires patient parameter');
    }

    // SOAP notes for a specific encounter
    if (encounterId) {
      const response = await nextgen.nativeSoapNoteSearch(personId, encounterId, config);
      const notes = response.data?.items ?? [response.data];
      const entries = await Promise.all(
        notes.filter(Boolean).map((note: any) => nextgenUtils.notesToFhir({ ...note, personId })),
      );
      return {
        resourceType: 'Bundle',
        type: 'searchset',
        total: entries.length,
        entry: entries.map((resource: any) => ({
          fullUrl: `${process.env.ENVIRONMENT}/api/fhir/r4/v1/DocumentReference/${resource.id}`,
          resource,
        })),
      };
    }

    // Clinical notes for the person
    const response = await nextgen.nativeClinicalNoteSearch(personId, config);
    const notes = response.data?.items ?? [response.data];
    const entries = await Promise.all(
      notes.filter(Boolean).map((note: any) => nextgenUtils.notesToFhir({ ...note, personId })),
    );
    return {
      resourceType: 'Bundle',
      type: 'searchset',
      total: entries.length,
      entry: entries.map((resource: any) => ({
        fullUrl: `${process.env.ENVIRONMENT}/api/fhir/r4/v1/DocumentReference/${resource.id}`,
        resource,
      })),
    };
  }

  /**
   * Get document reference by ID. NextGen does not have a direct clinical note
   * read by ID — falls back to clinical notes search for the given ID as personId.
   */
  async getDocumentReferenceById(siteData: SiteData, id: string): Promise<any> {
    logger.warn('NextGen getDocumentReferenceById: no direct ID endpoint, using clinical notes', { id });
    const config = toEhrConfig(siteData);
    const response = await nextgen.nativeClinicalNoteSearch(id, config);
    const notes = response.data?.items ?? [response.data];
    const firstNote = notes.find(Boolean);
    if (!firstNote) {
      return {
        resourceType: 'OperationOutcome',
        issue: [{ severity: 'error', code: 'not-found', details: { text: `DocumentReference/${id} not found` } }],
      };
    }
    return nextgenUtils.notesToFhir(firstNote);
  }

  /**
   * Create document reference (SOAP note) via NextGen native REST API.
   * Maps FHIR DocumentReference body to NextGen SOAP note format.
   * Requires subject (personId) and encounter reference.
   */
  async createDocumentReference(siteData: SiteData, body: any): Promise<any> {
    const config = toEhrConfig(siteData);
    const personId = body?.subject?.reference?.split('/')?.pop();
    const encounterId =
      body?.context?.encounter?.[0]?.reference?.split('/')?.pop() ??
      body?.context?.encounter?.reference?.split('/')?.pop();

    if (!personId || !encounterId) {
      throw new Error('DocumentReference creation requires subject (Patient) and context.encounter references');
    }

    const soapBody = await nextgenUtils.fhirDocumentReferenceToNotes(body);
    const response = await nextgen.nativeSoapNoteCreate(personId, encounterId, soapBody, config);
    return response.data;
  }

  // =========================================================================
  // Location — not supported by NextGen
  // =========================================================================

  async searchLocation(_siteData: SiteData, _params: Record<string, any>): Promise<any> {
    throw new Error('Location search is not supported by NextGen');
  }

  async getLocationById(_siteData: SiteData, _id: string): Promise<any> {
    throw new Error('Location read is not supported by NextGen');
  }

  // =========================================================================
  // Task — not supported by NextGen
  // =========================================================================

  async searchTask(_siteData: SiteData, _params: Record<string, any>): Promise<any> {
    throw new Error('Task search is not supported by NextGen');
  }

  async getTaskById(_siteData: SiteData, _id: string): Promise<any> {
    throw new Error('Task read is not supported by NextGen');
  }
}

export const nextgenDataService = new NextgenDataService();

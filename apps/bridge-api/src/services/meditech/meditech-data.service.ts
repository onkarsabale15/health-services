import { meditech, toEhrConfig } from '@hs/ehr-data-service';
import type { SiteData } from '@hs/ehr-data-service';
import type {
  Bundle,
  Patient,
  Appointment,
  Encounter,
  Coverage,
  Condition,
  Practitioner,
  AllergyIntolerance,
  ServiceRequest,
  MedicationStatement,
  Communication,
  Observation,
  DocumentReference,
  Location,
  Task,
} from '@medplum/fhirtypes';
import type { IVendorDataService, FhirSearchParams } from '../vendor-data-service.interface';

class MeditechDataService implements IVendorDataService {
  // ── Patient (R4) ─────────────────────────────────────────────────────────────

  async searchPatient(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<Patient>> {
    const response = await meditech.fhirPatientSearch(params, toEhrConfig(siteData));
    return response.data;
  }

  async getPatientById(siteData: SiteData, id: string): Promise<Patient> {
    const response = await meditech.getPatientById(id, toEhrConfig(siteData));
    return response.data;
  }

  // ── Appointment ──────────────────────────────────────────────────────────────

  async searchAppointment(_siteData: SiteData, _params: FhirSearchParams): Promise<Bundle<Appointment>> {
    throw new Error('MEDITECH does not support Appointment search');
  }

  async getAppointmentById(_siteData: SiteData, _id: string): Promise<Appointment> {
    throw new Error('MEDITECH does not support Appointment read');
  }

  // ── Encounter (R4) ───────────────────────────────────────────────────────────

  async searchEncounter(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<Encounter>> {
    const response = await meditech.fhirEncounterSearch(params, toEhrConfig(siteData));
    return response.data;
  }

  async getEncounterById(siteData: SiteData, id: string): Promise<Encounter> {
    const response = await meditech.getEncounterById(id, toEhrConfig(siteData));
    return response.data;
  }

  // ── Coverage (STU6) ──────────────────────────────────────────────────────────

  async searchCoverage(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<Coverage>> {
    const response = await meditech.stu6CoverageSearch(params, toEhrConfig(siteData));
    return response.data;
  }

  async getCoverageById(siteData: SiteData, id: string): Promise<Coverage> {
    const response = await meditech.getCoverageById(id, toEhrConfig(siteData));
    return response.data;
  }

  // ── Condition (R4) ───────────────────────────────────────────────────────────

  async searchCondition(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<Condition>> {
    const response = await meditech.fhirConditionSearch(params, toEhrConfig(siteData));
    return response.data;
  }

  async getConditionById(siteData: SiteData, id: string): Promise<Condition> {
    const response = await meditech.getConditionById(id, toEhrConfig(siteData));
    return response.data;
  }

  // ── Practitioner (R4) ────────────────────────────────────────────────────────

  async searchPractitioner(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<Practitioner>> {
    const response = await meditech.fhirPractitionerSearch(params, toEhrConfig(siteData));
    return response.data;
  }

  async getPractitionerById(siteData: SiteData, id: string): Promise<Practitioner> {
    const response = await meditech.getPractitionerById(id, toEhrConfig(siteData));
    return response.data;
  }

  // ── AllergyIntolerance (STU6) ────────────────────────────────────────────────

  async searchAllergy(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<AllergyIntolerance>> {
    const response = await meditech.stu6AllergySearch(params, toEhrConfig(siteData));
    return response.data;
  }

  async getAllergyById(siteData: SiteData, id: string): Promise<AllergyIntolerance> {
    const response = await meditech.getAllergyById(id, toEhrConfig(siteData));
    return response.data;
  }

  // ── ServiceRequest ───────────────────────────────────────────────────────────

  async searchServiceRequest(_siteData: SiteData, _params: FhirSearchParams): Promise<Bundle<ServiceRequest>> {
    throw new Error('MEDITECH does not support ServiceRequest search');
  }

  async getServiceRequestById(_siteData: SiteData, _id: string): Promise<ServiceRequest> {
    throw new Error('MEDITECH does not support ServiceRequest read');
  }

  // ── MedicationStatement (STU6 MedicationRequest) ─────────────────────────────

  async searchMedicationStatement(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<MedicationStatement>> {
    const response = await meditech.stu6MedicationRequestSearch(params, toEhrConfig(siteData));
    return response.data;
  }

  async getMedicationStatementById(siteData: SiteData, id: string): Promise<MedicationStatement> {
    const response = await meditech.getMedicationById(id, toEhrConfig(siteData));
    return response.data;
  }

  // ── Communication (STU6) ─────────────────────────────────────────────────────

  async searchCommunication(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<Communication>> {
    const response = await meditech.stu6CommunicationSearch(params, toEhrConfig(siteData));
    return response.data;
  }

  async getCommunicationById(siteData: SiteData, id: string): Promise<Communication> {
    const response = await meditech.getCommunicationById(id, toEhrConfig(siteData));
    return response.data;
  }

  // ── Observation (STU6) ───────────────────────────────────────────────────────

  async searchObservation(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<Observation>> {
    const response = await meditech.stu6ObservationSearch(params, toEhrConfig(siteData));
    return response.data;
  }

  async getObservationById(siteData: SiteData, id: string): Promise<Observation> {
    const response = await meditech.getObservationById(id, toEhrConfig(siteData));
    return response.data;
  }

  // ── DocumentReference (STU6) ─────────────────────────────────────────────────

  async searchDocumentReference(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<DocumentReference>> {
    const response = await meditech.stu6DocumentReferenceSearch(params, toEhrConfig(siteData));
    return response.data;
  }

  async getDocumentReferenceById(siteData: SiteData, id: string): Promise<DocumentReference> {
    const response = await meditech.getDocumentReferenceById(id, toEhrConfig(siteData));
    return response.data;
  }

  // ── Location ─────────────────────────────────────────────────────────────────

  async searchLocation(_siteData: SiteData, _params: FhirSearchParams): Promise<Bundle<Location>> {
    throw new Error('MEDITECH does not support Location search');
  }

  async getLocationById(_siteData: SiteData, _id: string): Promise<Location> {
    throw new Error('MEDITECH does not support Location read');
  }

  // ── Task ─────────────────────────────────────────────────────────────────────

  async searchTask(_siteData: SiteData, _params: FhirSearchParams): Promise<Bundle<Task>> {
    throw new Error('MEDITECH does not support Task search');
  }

  async getTaskById(_siteData: SiteData, _id: string): Promise<Task> {
    throw new Error('MEDITECH does not support Task read');
  }
}

export const meditechDataService = new MeditechDataService();

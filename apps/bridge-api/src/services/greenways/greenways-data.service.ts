import { greenways, toEhrConfig } from '@hs/ehr-data-service';
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

class GreenwaysDataService implements IVendorDataService {
  // ── Patient ──────────────────────────────────────────────────────────────────

  async searchPatient(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<Patient>> {
    const response = await greenways.fhirPatientSearch(params, toEhrConfig(siteData));
    return response.data;
  }

  async getPatientById(siteData: SiteData, id: string): Promise<Patient> {
    const response = await greenways.getPatientById(id, toEhrConfig(siteData));
    return response.data;
  }

  async createPatient(siteData: SiteData, body: Patient): Promise<Patient> {
    const response = await greenways.createPatient(body, toEhrConfig(siteData));
    return response.data;
  }

  // ── Appointment ──────────────────────────────────────────────────────────────

  async searchAppointment(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<Appointment>> {
    const response = await greenways.fhirAppointmentSearch(params, toEhrConfig(siteData));
    return response.data;
  }

  async getAppointmentById(siteData: SiteData, id: string): Promise<Appointment> {
    const response = await greenways.getAppointmentById(id, toEhrConfig(siteData));
    return response.data;
  }

  // ── Encounter ────────────────────────────────────────────────────────────────

  async searchEncounter(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<Encounter>> {
    const response = await greenways.fhirEncounterSearch(params, toEhrConfig(siteData));
    return response.data;
  }

  async getEncounterById(siteData: SiteData, id: string): Promise<Encounter> {
    const response = await greenways.getEncounterById(id, toEhrConfig(siteData));
    return response.data;
  }

  // ── Coverage ─────────────────────────────────────────────────────────────────

  async searchCoverage(_siteData: SiteData, _params: FhirSearchParams): Promise<Bundle<Coverage>> {
    throw new Error('Greenways does not support Coverage search');
  }

  async getCoverageById(_siteData: SiteData, _id: string): Promise<Coverage> {
    throw new Error('Greenways does not support Coverage read');
  }

  // ── Condition ────────────────────────────────────────────────────────────────

  async searchCondition(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<Condition>> {
    const response = await greenways.fhirConditionSearch(params, toEhrConfig(siteData));
    return response.data;
  }

  async getConditionById(siteData: SiteData, id: string): Promise<Condition> {
    const response = await greenways.getConditionById(id, toEhrConfig(siteData));
    return response.data;
  }

  async createCondition(siteData: SiteData, body: Condition): Promise<any> {
    const response = await greenways.createCondition(body, toEhrConfig(siteData));
    return response.data;
  }

  // ── Practitioner ─────────────────────────────────────────────────────────────

  async searchPractitioner(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<Practitioner>> {
    const response = await greenways.fhirPractitionerSearch(params, toEhrConfig(siteData));
    return response.data;
  }

  async getPractitionerById(siteData: SiteData, id: string): Promise<Practitioner> {
    const response = await greenways.getPractitionerById(id, toEhrConfig(siteData));
    return response.data;
  }

  // ── AllergyIntolerance ───────────────────────────────────────────────────────

  async searchAllergy(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<AllergyIntolerance>> {
    const response = await greenways.fhirAllergySearch(params, toEhrConfig(siteData));
    return response.data;
  }

  async getAllergyById(siteData: SiteData, id: string): Promise<AllergyIntolerance> {
    const response = await greenways.getAllergyById(id, toEhrConfig(siteData));
    return response.data;
  }

  async createAllergy(siteData: SiteData, body: AllergyIntolerance): Promise<any> {
    const response = await greenways.createAllergy(body, toEhrConfig(siteData));
    return response.data;
  }

  // ── ServiceRequest ───────────────────────────────────────────────────────────

  async searchServiceRequest(_siteData: SiteData, _params: FhirSearchParams): Promise<Bundle<ServiceRequest>> {
    throw new Error('Greenways does not support ServiceRequest search');
  }

  async getServiceRequestById(_siteData: SiteData, _id: string): Promise<ServiceRequest> {
    throw new Error('Greenways does not support ServiceRequest read');
  }

  // ── MedicationStatement ──────────────────────────────────────────────────────

  async searchMedicationStatement(
    _siteData: SiteData,
    _params: FhirSearchParams,
  ): Promise<Bundle<MedicationStatement>> {
    throw new Error('Greenways does not support MedicationStatement search');
  }

  async getMedicationStatementById(_siteData: SiteData, _id: string): Promise<MedicationStatement> {
    throw new Error('Greenways does not support MedicationStatement read');
  }

  // ── Communication ────────────────────────────────────────────────────────────

  async searchCommunication(_siteData: SiteData, _params: FhirSearchParams): Promise<Bundle<Communication>> {
    throw new Error('Greenways does not support Communication search');
  }

  async getCommunicationById(_siteData: SiteData, _id: string): Promise<Communication> {
    throw new Error('Greenways does not support Communication read');
  }

  // ── Observation ──────────────────────────────────────────────────────────────

  async searchObservation(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<Observation>> {
    const response = await greenways.fhirObservationSearch(params, toEhrConfig(siteData));
    return response.data;
  }

  async getObservationById(siteData: SiteData, id: string): Promise<Observation> {
    const response = await greenways.getObservationById(id, toEhrConfig(siteData));
    return response.data;
  }

  async createObservation(siteData: SiteData, body: Observation): Promise<any> {
    const response = await greenways.createObservation(body, toEhrConfig(siteData));
    return response.data;
  }

  // ── DocumentReference ────────────────────────────────────────────────────────

  async searchDocumentReference(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<DocumentReference>> {
    const response = await greenways.fhirDocumentReferenceSearch(params, toEhrConfig(siteData));
    return response.data;
  }

  async getDocumentReferenceById(siteData: SiteData, id: string): Promise<DocumentReference> {
    const response = await greenways.getDocumentReferenceById(id, toEhrConfig(siteData));
    return response.data;
  }

  async createDocumentReference(siteData: SiteData, body: DocumentReference): Promise<any> {
    const response = await greenways.createDocumentReference(body, toEhrConfig(siteData));
    return response.data;
  }

  // ── Location ─────────────────────────────────────────────────────────────────

  async searchLocation(_siteData: SiteData, _params: FhirSearchParams): Promise<Bundle<Location>> {
    throw new Error('Greenways does not support Location search');
  }

  async getLocationById(_siteData: SiteData, _id: string): Promise<Location> {
    throw new Error('Greenways does not support Location read');
  }

  // ── Task ────────────────────────────────────────────────────────────────────

  async searchTask(_siteData: SiteData, _params: FhirSearchParams): Promise<Bundle<Task>> {
    throw new Error('Greenways does not support Task search');
  }

  async getTaskById(_siteData: SiteData, _id: string): Promise<Task> {
    throw new Error('Greenways does not support Task read');
  }
}

export const greenwaysDataService = new GreenwaysDataService();

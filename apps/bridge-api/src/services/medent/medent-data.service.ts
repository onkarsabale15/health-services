import { medent, toEhrConfig } from '@hs/ehr-data-service';
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

class MedentDataService implements IVendorDataService {
  // ── Patient ──────────────────────────────────────────────────────────────────

  async searchPatient(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<Patient>> {
    const response = await medent.fhirPatientSearch(params, toEhrConfig(siteData));
    return response.data;
  }

  async getPatientById(siteData: SiteData, id: string): Promise<Patient> {
    const response = await medent.getPatientById(id, toEhrConfig(siteData));
    return response.data;
  }

  async createPatient(siteData: SiteData, body: Patient): Promise<Patient> {
    const response = await medent.createPatient(body, toEhrConfig(siteData));
    return response.data;
  }

  // ── Appointment ──────────────────────────────────────────────────────────────

  async searchAppointment(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<Appointment>> {
    const response = await medent.fhirAppointmentSearch(params, toEhrConfig(siteData));
    return response.data;
  }

  async getAppointmentById(siteData: SiteData, id: string): Promise<Appointment> {
    const response = await medent.getAppointmentById(id, toEhrConfig(siteData));
    return response.data;
  }

  // ── Encounter ────────────────────────────────────────────────────────────────

  async searchEncounter(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<Encounter>> {
    const response = await medent.fhirEncounterSearch(params, toEhrConfig(siteData));
    return response.data;
  }

  async getEncounterById(siteData: SiteData, id: string): Promise<Encounter> {
    const response = await medent.getEncounterById(id, toEhrConfig(siteData));
    return response.data;
  }

  // ── Coverage ─────────────────────────────────────────────────────────────────

  async searchCoverage(_siteData: SiteData, _params: FhirSearchParams): Promise<Bundle<Coverage>> {
    throw new Error('MEDENT does not support Coverage search');
  }

  async getCoverageById(_siteData: SiteData, _id: string): Promise<Coverage> {
    throw new Error('MEDENT does not support Coverage read');
  }

  // ── Condition ────────────────────────────────────────────────────────────────

  async searchCondition(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<Condition>> {
    const response = await medent.fhirConditionSearch(params, toEhrConfig(siteData));
    return response.data;
  }

  async getConditionById(siteData: SiteData, id: string): Promise<Condition> {
    const response = await medent.getConditionById(id, toEhrConfig(siteData));
    return response.data;
  }

  async createCondition(siteData: SiteData, body: Condition): Promise<any> {
    const response = await medent.createCondition(body, toEhrConfig(siteData));
    return response.data;
  }

  // ── Practitioner ─────────────────────────────────────────────────────────────

  async searchPractitioner(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<Practitioner>> {
    const response = await medent.fhirPractitionerSearch(params, toEhrConfig(siteData));
    return response.data;
  }

  async getPractitionerById(siteData: SiteData, id: string): Promise<Practitioner> {
    const response = await medent.getPractitionerById(id, toEhrConfig(siteData));
    return response.data;
  }

  // ── AllergyIntolerance ───────────────────────────────────────────────────────

  async searchAllergy(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<AllergyIntolerance>> {
    const response = await medent.fhirAllergySearch(params, toEhrConfig(siteData));
    return response.data;
  }

  async getAllergyById(siteData: SiteData, id: string): Promise<AllergyIntolerance> {
    const response = await medent.getAllergyById(id, toEhrConfig(siteData));
    return response.data;
  }

  async createAllergy(siteData: SiteData, body: AllergyIntolerance): Promise<any> {
    const response = await medent.createAllergy(body, toEhrConfig(siteData));
    return response.data;
  }

  // ── ServiceRequest ───────────────────────────────────────────────────────────

  async searchServiceRequest(_siteData: SiteData, _params: FhirSearchParams): Promise<Bundle<ServiceRequest>> {
    throw new Error('MEDENT does not support ServiceRequest search');
  }

  async getServiceRequestById(_siteData: SiteData, _id: string): Promise<ServiceRequest> {
    throw new Error('MEDENT does not support ServiceRequest read');
  }

  // ── MedicationStatement ──────────────────────────────────────────────────────

  async searchMedicationStatement(
    _siteData: SiteData,
    _params: FhirSearchParams,
  ): Promise<Bundle<MedicationStatement>> {
    throw new Error('MEDENT does not support MedicationStatement search');
  }

  async getMedicationStatementById(_siteData: SiteData, _id: string): Promise<MedicationStatement> {
    throw new Error('MEDENT does not support MedicationStatement read');
  }

  // ── Communication ────────────────────────────────────────────────────────────

  async searchCommunication(_siteData: SiteData, _params: FhirSearchParams): Promise<Bundle<Communication>> {
    throw new Error('MEDENT does not support Communication search');
  }

  async getCommunicationById(_siteData: SiteData, _id: string): Promise<Communication> {
    throw new Error('MEDENT does not support Communication read');
  }

  // ── Observation ──────────────────────────────────────────────────────────────

  async searchObservation(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<Observation>> {
    const response = await medent.fhirObservationSearch(params, toEhrConfig(siteData));
    return response.data;
  }

  async getObservationById(siteData: SiteData, id: string): Promise<Observation> {
    const response = await medent.getObservationById(id, toEhrConfig(siteData));
    return response.data;
  }

  async createObservation(siteData: SiteData, body: Observation): Promise<any> {
    const response = await medent.createObservation(body, toEhrConfig(siteData));
    return response.data;
  }

  // ── DocumentReference ────────────────────────────────────────────────────────

  async searchDocumentReference(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<DocumentReference>> {
    const response = await medent.fhirDocumentReferenceSearch(params, toEhrConfig(siteData));
    return response.data;
  }

  async getDocumentReferenceById(siteData: SiteData, id: string): Promise<DocumentReference> {
    const response = await medent.getDocumentReferenceById(id, toEhrConfig(siteData));
    return response.data;
  }

  async createDocumentReference(siteData: SiteData, body: DocumentReference): Promise<any> {
    const response = await medent.createDocumentReference(body, toEhrConfig(siteData));
    return response.data;
  }

  // ── Location ─────────────────────────────────────────────────────────────────

  async searchLocation(_siteData: SiteData, _params: FhirSearchParams): Promise<Bundle<Location>> {
    throw new Error('MEDENT does not support Location search');
  }

  async getLocationById(_siteData: SiteData, _id: string): Promise<Location> {
    throw new Error('MEDENT does not support Location read');
  }

  // ── Task ─────────────────────────────────────────────────────────────────────

  async searchTask(_siteData: SiteData, _params: FhirSearchParams): Promise<Bundle<Task>> {
    throw new Error('MEDENT does not support Task search');
  }

  async getTaskById(_siteData: SiteData, _id: string): Promise<Task> {
    throw new Error('MEDENT does not support Task read');
  }
}

export const medentDataService = new MedentDataService();

import { ecw, toEhrConfig } from '@hs/ehr-data-service';
import type { SiteData, EhrClientConfig } from '@hs/ehr-data-service';
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
import {
  transformBundle,
  buildTransactionBundle,
  constructEncounterEndpoint,
  ecwPatientSearch,
  ecwAllergySearch,
  ecwConditionSearch,
  ecwCoverageSearch,
  ecwPractitionerSearch,
  ecwObservationSearch,
  ecwDocumentReferenceSearch,
  ecwMedicationStatementSearch,
} from './eclinicalworks.mapper';

class EcwDataService implements IVendorDataService {
  // ── Patient ──────────────────────────────────────────────────────────────────

  async searchPatient(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<Patient>> {
    const config = toEhrConfig(siteData);
    const mapped = ecwPatientSearch(params);
    const response = await ecw.fhirPatientSearch(mapped, config);
    return transformBundle(response.data);
  }

  async getPatientById(siteData: SiteData, id: string): Promise<Patient> {
    const config = toEhrConfig(siteData);
    const response = await ecw.getPatientById(id, config);
    return response.data;
  }

  async createPatient(siteData: SiteData, body: Patient): Promise<Patient> {
    const config = toEhrConfig(siteData);
    const bundle = buildTransactionBundle(body);
    const response = await ecw.fhirTransactionCreate(bundle, config);
    return response.data;
  }

  // ── Appointment ──────────────────────────────────────────────────────────────

  async searchAppointment(_siteData: SiteData, _params: FhirSearchParams): Promise<Bundle<Appointment>> {
    throw new Error('Appointment search is not supported by eClinicalWorks');
  }

  async getAppointmentById(_siteData: SiteData, _id: string): Promise<Appointment> {
    throw new Error('Appointment read is not supported by eClinicalWorks');
  }

  // ── Encounter ────────────────────────────────────────────────────────────────

  async searchEncounter(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<Encounter>> {
    const config = toEhrConfig(siteData);
    const endpoint = constructEncounterEndpoint(params);
    const response = await ecw.fhirEncounterSearch(endpoint, config);
    return transformBundle(response.data);
  }

  async getEncounterById(siteData: SiteData, id: string): Promise<Encounter> {
    const config = toEhrConfig(siteData);
    const response = await ecw.getEncounterById(id, config);
    return response.data;
  }

  // ── Coverage ─────────────────────────────────────────────────────────────────

  async searchCoverage(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<Coverage>> {
    const config = toEhrConfig(siteData);
    const mapped = ecwCoverageSearch(params);
    const response = await ecw.fhirCoverageSearch(mapped, config);
    return transformBundle(response.data);
  }

  async getCoverageById(_siteData: SiteData, _id: string): Promise<Coverage> {
    throw new Error('Coverage read by ID is not supported by eClinicalWorks');
  }

  // ── Condition ────────────────────────────────────────────────────────────────

  async searchCondition(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<Condition>> {
    const config = toEhrConfig(siteData);
    const mapped = ecwConditionSearch(params);
    const response = await ecw.fhirConditionSearch(mapped, config);
    return transformBundle(response.data);
  }

  async getConditionById(siteData: SiteData, id: string): Promise<Condition> {
    const config = toEhrConfig(siteData);
    const response = await ecw.getConditionById(id, config);
    return response.data;
  }

  async createCondition(siteData: SiteData, body: Condition): Promise<Condition> {
    const config = toEhrConfig(siteData);
    const bundle = buildTransactionBundle(body);
    const response = await ecw.fhirTransactionCreate(bundle, config);
    return response.data;
  }

  // ── Practitioner ─────────────────────────────────────────────────────────────

  async searchPractitioner(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<Practitioner>> {
    const config = toEhrConfig(siteData);
    const mapped = ecwPractitionerSearch(params);
    const response = await ecw.fhirPractitionerSearch(mapped, config);
    return transformBundle(response.data);
  }

  async getPractitionerById(siteData: SiteData, id: string): Promise<Practitioner> {
    const config = toEhrConfig(siteData);
    const response = await ecw.getPractitionerById(id, config);
    return response.data;
  }

  // ── AllergyIntolerance ───────────────────────────────────────────────────────

  async searchAllergy(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<AllergyIntolerance>> {
    const config = toEhrConfig(siteData);
    const mapped = ecwAllergySearch(params);
    const response = await ecw.fhirAllergySearch(mapped, config);
    return transformBundle(response.data);
  }

  async getAllergyById(siteData: SiteData, id: string): Promise<AllergyIntolerance> {
    const config = toEhrConfig(siteData);
    const response = await ecw.getAllergyById(id, config);
    return response.data;
  }

  async createAllergy(siteData: SiteData, body: AllergyIntolerance): Promise<AllergyIntolerance> {
    const config = toEhrConfig(siteData);
    const bundle = buildTransactionBundle(body);
    const response = await ecw.fhirTransactionCreate(bundle, config);
    return response.data;
  }

  // ── ServiceRequest ───────────────────────────────────────────────────────────

  async searchServiceRequest(_siteData: SiteData, _params: FhirSearchParams): Promise<Bundle<ServiceRequest>> {
    throw new Error('ServiceRequest search is not supported by eClinicalWorks');
  }

  async getServiceRequestById(_siteData: SiteData, _id: string): Promise<ServiceRequest> {
    throw new Error('ServiceRequest read is not supported by eClinicalWorks');
  }

  // ── MedicationStatement ──────────────────────────────────────────────────────

  async searchMedicationStatement(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<MedicationStatement>> {
    const config = toEhrConfig(siteData);
    const mapped = ecwMedicationStatementSearch(params);
    const response = await ecw.fhirMedicationRequestSearch(mapped, config);
    return transformBundle(response.data);
  }

  async getMedicationStatementById(siteData: SiteData, id: string): Promise<MedicationStatement> {
    const config = toEhrConfig(siteData);
    const response = await ecw.getMedicationRequestById(id, config);
    return response.data;
  }

  // ── Communication ────────────────────────────────────────────────────────────

  async searchCommunication(_siteData: SiteData, _params: FhirSearchParams): Promise<Bundle<Communication>> {
    throw new Error('Communication search is not supported by eClinicalWorks');
  }

  async getCommunicationById(_siteData: SiteData, _id: string): Promise<Communication> {
    throw new Error('Communication read is not supported by eClinicalWorks');
  }

  // ── Observation ──────────────────────────────────────────────────────────────

  async searchObservation(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<Observation>> {
    const config = toEhrConfig(siteData);
    const mapped = ecwObservationSearch(params);
    const response = await ecw.fhirObservationSearch(mapped, config);
    return transformBundle(response.data);
  }

  async getObservationById(siteData: SiteData, id: string): Promise<Observation> {
    const config = toEhrConfig(siteData);
    const response = await ecw.getObservationById(id, config);
    return response.data;
  }

  // ── DocumentReference ────────────────────────────────────────────────────────

  async searchDocumentReference(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<DocumentReference>> {
    const config = toEhrConfig(siteData);
    const mapped = ecwDocumentReferenceSearch(params);
    const response = await ecw.fhirDocumentReferenceSearch(mapped, config);
    return transformBundle(response.data);
  }

  async getDocumentReferenceById(siteData: SiteData, id: string): Promise<DocumentReference> {
    const config = toEhrConfig(siteData);
    const response = await ecw.getDocumentReferenceById(id, config);
    return response.data;
  }

  // ── Location ─────────────────────────────────────────────────────────────────

  async searchLocation(_siteData: SiteData, _params: FhirSearchParams): Promise<Bundle<Location>> {
    throw new Error('Location search is not supported by eClinicalWorks');
  }

  async getLocationById(_siteData: SiteData, _id: string): Promise<Location> {
    throw new Error('Location read is not supported by eClinicalWorks');
  }

  // ── Task ────────────────────────────────────────────────────────────────────

  async searchTask(_siteData: SiteData, _params: FhirSearchParams): Promise<Bundle<Task>> {
    throw new Error('Task search is not supported by eClinicalWorks');
  }

  async getTaskById(_siteData: SiteData, _id: string): Promise<Task> {
    throw new Error('Task read is not supported by eClinicalWorks');
  }
}

export const ecwDataService = new EcwDataService();

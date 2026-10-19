import { epic, toEhrConfig } from '@hs/ehr-data-service';
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
  Resource,
} from '@medplum/fhirtypes';
import type { IVendorDataService, FhirSearchParams } from '../vendor-data-service.interface';
import { commonMapper } from '../common.mapper';
import { convertLinkToIb } from './epic.mapper';

class EpicDataService implements IVendorDataService {
  private async search<T extends Resource>(
    siteData: SiteData,
    params: FhirSearchParams,
    searchFn: (config: EhrClientConfig, params: Record<string, any>) => Promise<any>,
  ): Promise<Bundle<T>> {
    const config = toEhrConfig(siteData);
    const cleaned = commonMapper.mapSearchParams(params);
    const response = await searchFn(config, cleaned);
    return convertLinkToIb(response.data);
  }

  async searchPatient(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<Patient>> {
    return this.search<Patient>(siteData, params, epic.searchPatients.bind(epic));
  }

  async getPatientById(siteData: SiteData, id: string): Promise<Patient> {
    const response = await epic.getPatient(toEhrConfig(siteData), id);
    return response.data;
  }

  async createPatient(siteData: SiteData, body: Patient): Promise<Patient> {
    const response = await epic.createPatient(toEhrConfig(siteData), body);
    return response.data;
  }

  async searchAppointment(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<Appointment>> {
    return this.search<Appointment>(siteData, params, epic.searchAppointments.bind(epic));
  }

  async getAppointmentById(siteData: SiteData, id: string): Promise<Appointment> {
    const response = await epic.getAppointment(toEhrConfig(siteData), id);
    return response.data;
  }

  async searchEncounter(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<Encounter>> {
    return this.search<Encounter>(siteData, params, epic.searchEncounters.bind(epic));
  }

  async getEncounterById(siteData: SiteData, id: string): Promise<Encounter> {
    const response = await epic.getEncounter(toEhrConfig(siteData), id);
    return response.data;
  }

  async searchCoverage(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<Coverage>> {
    return this.search<Coverage>(siteData, params, epic.searchCoverages.bind(epic));
  }

  async getCoverageById(siteData: SiteData, id: string): Promise<Coverage> {
    const response = await epic.getCoverage(toEhrConfig(siteData), id);
    return response.data;
  }

  async searchCondition(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<Condition>> {
    return this.search<Condition>(siteData, params, epic.searchConditions.bind(epic));
  }

  async getConditionById(siteData: SiteData, id: string): Promise<Condition> {
    const response = await epic.getCondition(toEhrConfig(siteData), id);
    return response.data;
  }

  async createCondition(siteData: SiteData, body: Condition): Promise<Condition> {
    const response = await epic.createCondition(toEhrConfig(siteData), body);
    return response.data;
  }

  async searchPractitioner(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<Practitioner>> {
    return this.search<Practitioner>(siteData, params, epic.searchPractitioners.bind(epic));
  }

  async getPractitionerById(siteData: SiteData, id: string): Promise<Practitioner> {
    const response = await epic.getPractitioner(toEhrConfig(siteData), id);
    return response.data;
  }

  async searchAllergy(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<AllergyIntolerance>> {
    return this.search<AllergyIntolerance>(siteData, params, epic.searchAllergies.bind(epic));
  }

  async getAllergyById(siteData: SiteData, id: string): Promise<AllergyIntolerance> {
    const response = await epic.getAllergy(toEhrConfig(siteData), id);
    return response.data;
  }

  async createAllergy(siteData: SiteData, body: AllergyIntolerance): Promise<AllergyIntolerance> {
    const response = await epic.createAllergy(toEhrConfig(siteData), body);
    return response.data;
  }

  async searchServiceRequest(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<ServiceRequest>> {
    return this.search<ServiceRequest>(siteData, params, epic.searchServiceRequests.bind(epic));
  }

  async getServiceRequestById(siteData: SiteData, id: string): Promise<ServiceRequest> {
    const response = await epic.getServiceRequest(toEhrConfig(siteData), id);
    return response.data;
  }

  async searchMedicationStatement(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<MedicationStatement>> {
    return this.search<MedicationStatement>(siteData, params, epic.searchMedicationStatements.bind(epic));
  }

  async getMedicationStatementById(siteData: SiteData, id: string): Promise<MedicationStatement> {
    const response = await epic.getMedicationStatement(toEhrConfig(siteData), id);
    return response.data;
  }

  async searchCommunication(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<Communication>> {
    return this.search<Communication>(siteData, params, epic.searchCommunications.bind(epic));
  }

  async getCommunicationById(siteData: SiteData, id: string): Promise<Communication> {
    const response = await epic.getCommunication(toEhrConfig(siteData), id);
    return response.data;
  }

  async createCommunication(siteData: SiteData, body: Communication): Promise<Communication> {
    const response = await epic.createCommunication(toEhrConfig(siteData), body);
    return response.data;
  }

  async searchObservation(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<Observation>> {
    return this.search<Observation>(siteData, params, epic.searchObservations.bind(epic));
  }

  async getObservationById(siteData: SiteData, id: string): Promise<Observation> {
    const response = await epic.getObservation(toEhrConfig(siteData), id);
    return response.data;
  }

  async createObservation(siteData: SiteData, body: Observation): Promise<Observation> {
    const response = await epic.createObservation(toEhrConfig(siteData), body);
    return response.data;
  }

  async searchDocumentReference(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<DocumentReference>> {
    return this.search<DocumentReference>(siteData, params, epic.searchDocumentReferences.bind(epic));
  }

  async getDocumentReferenceById(siteData: SiteData, id: string): Promise<DocumentReference> {
    const response = await epic.getDocumentReference(toEhrConfig(siteData), id);
    return response.data;
  }

  async createDocumentReference(siteData: SiteData, body: DocumentReference): Promise<DocumentReference> {
    const response = await epic.createDocumentReference(toEhrConfig(siteData), body);
    return response.data;
  }

  async searchLocation(_siteData: SiteData, _params: FhirSearchParams): Promise<Bundle<Location>> {
    throw new Error('Location search is not supported by Epic');
  }

  async getLocationById(_siteData: SiteData, _id: string): Promise<Location> {
    throw new Error('Location read is not supported by Epic');
  }

  async searchTask(_siteData: SiteData, _params: FhirSearchParams): Promise<Bundle<Task>> {
    throw new Error('Task search is not supported by Epic');
  }

  async getTaskById(_siteData: SiteData, _id: string): Promise<Task> {
    throw new Error('Task read is not supported by Epic');
  }
}

export const epicDataService = new EpicDataService();

import {
  drchrono,
  type DrChronoPatient,
  type DrChronoAppointment,
  type DrChronoDoctor,
  type DrChronoProblem,
  type DrChronoAllergy,
  type DrChronoMedication,
  type DrChronoCommunication,
  type DrChronoLabResult,
  type DrChronoTask,
  type DrChronoOffice,
  type DrChronoPaginatedResponse,
} from '@hs/ehr-data-service';
import { toEhrConfig } from '@hs/ehr-data-service';
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
import {
  searchParams as mapSearchParams,
  convertPatientEhrToFhir,
  convertPatientFhirToEhr,
  convertAppointmentEhrToFhir,
  convertDateRange,
  convertPractitionerEhrToFhir,
  convertConditionEhrToFhir,
  conditionBodyBuilder,
  convertAllergyEhrToFhir,
  saveAllergy,
  fhirMedicationStatement,
  saveMedication,
  fhirCommunication,
  saveCommunication,
  fhirDocumentReference,
  fhirObservation,
  fhirLocation,
  fhirTask,
} from './drchrono.mapper';

class DrchronoDataService implements IVendorDataService {
  // ── Patient ──────────────────────────────────────────────────────────────────

  async searchPatient(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<Patient>> {
    const mapped = mapSearchParams(params);
    const response = await drchrono.searchPatients(mapped, toEhrConfig(siteData));
    return convertPatientEhrToFhir(
      response.data as DrChronoPaginatedResponse<DrChronoPatient>,
      true,
    ) as Bundle<Patient>;
  }

  async getPatientById(siteData: SiteData, id: string): Promise<Patient> {
    const response = await drchrono.getPatient(id, toEhrConfig(siteData));
    return convertPatientEhrToFhir(response.data as DrChronoPatient, false) as Patient;
  }

  async createPatient(siteData: SiteData, body: Patient): Promise<Patient> {
    const ehrBody = convertPatientFhirToEhr(body);
    const response = await drchrono.createPatient(ehrBody, toEhrConfig(siteData));
    return convertPatientEhrToFhir(response.data as DrChronoPatient, false) as Patient;
  }

  // ── Appointment ──────────────────────────────────────────────────────────────

  async searchAppointment(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<Appointment>> {
    const mapped = mapSearchParams(params);
    if (params?.date && typeof params.date === 'string') {
      mapped.date_range = convertDateRange(params.date);
    }
    const response = await drchrono.searchAppointments(mapped, toEhrConfig(siteData));
    return convertAppointmentEhrToFhir(
      response.data as DrChronoPaginatedResponse<DrChronoAppointment>,
      undefined,
      true,
    ) as Promise<Bundle<Appointment>>;
  }

  async getAppointmentById(siteData: SiteData, id: string): Promise<Appointment> {
    const response = await drchrono.getAppointment(id, toEhrConfig(siteData));
    return convertAppointmentEhrToFhir(response.data as DrChronoAppointment, undefined, false) as Promise<Appointment>;
  }

  // ── Encounter ────────────────────────────────────────────────────────────────

  async searchEncounter(_siteData: SiteData, _params: FhirSearchParams): Promise<Bundle<Encounter>> {
    throw new Error('DrChrono does not support Encounter search');
  }

  async getEncounterById(_siteData: SiteData, _id: string): Promise<Encounter> {
    throw new Error('DrChrono does not support Encounter read');
  }

  // ── Coverage ─────────────────────────────────────────────────────────────────

  async searchCoverage(_siteData: SiteData, _params: FhirSearchParams): Promise<Bundle<Coverage>> {
    throw new Error('DrChrono does not support Coverage search');
  }

  async getCoverageById(_siteData: SiteData, _id: string): Promise<Coverage> {
    throw new Error('DrChrono does not support Coverage read');
  }

  // ── Condition ────────────────────────────────────────────────────────────────

  async searchCondition(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<Condition>> {
    const mapped = mapSearchParams(params);
    const response = await drchrono.searchProblems(mapped, toEhrConfig(siteData));
    return convertConditionEhrToFhir(response.data as DrChronoPaginatedResponse<DrChronoProblem>) as Promise<
      Bundle<Condition>
    >;
  }

  async getConditionById(siteData: SiteData, id: string): Promise<Condition> {
    const response = await drchrono.getProblem(id, toEhrConfig(siteData));
    return convertConditionEhrToFhir(response.data as DrChronoProblem) as Promise<Condition>;
  }

  async createCondition(siteData: SiteData, body: Condition): Promise<any> {
    const ehrBody = conditionBodyBuilder(body);
    const response = await drchrono.createProblem(ehrBody, toEhrConfig(siteData));
    return convertConditionEhrToFhir(response.data as DrChronoProblem);
  }

  // ── Practitioner ─────────────────────────────────────────────────────────────

  async searchPractitioner(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<Practitioner>> {
    const mapped = mapSearchParams(params);
    const response = await drchrono.searchDoctors(mapped, toEhrConfig(siteData));
    return convertPractitionerEhrToFhir(response.data?.results ?? [], true) as Bundle<Practitioner>;
  }

  async getPractitionerById(siteData: SiteData, id: string): Promise<Practitioner> {
    const response = await drchrono.getDoctor(id, toEhrConfig(siteData));
    return convertPractitionerEhrToFhir([response.data as DrChronoDoctor], false) as Practitioner;
  }

  // ── AllergyIntolerance ───────────────────────────────────────────────────────

  async searchAllergy(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<AllergyIntolerance>> {
    const mapped = mapSearchParams(params);
    const response = await drchrono.searchAllergies(mapped, toEhrConfig(siteData));
    return convertAllergyEhrToFhir(response.data as DrChronoPaginatedResponse<DrChronoAllergy>, true) as Promise<
      Bundle<AllergyIntolerance>
    >;
  }

  async getAllergyById(siteData: SiteData, id: string): Promise<AllergyIntolerance> {
    const response = await drchrono.getAllergy(id, toEhrConfig(siteData));
    return convertAllergyEhrToFhir(response.data as DrChronoAllergy, false) as Promise<AllergyIntolerance>;
  }

  async createAllergy(siteData: SiteData, body: AllergyIntolerance): Promise<any> {
    const ehrBody = saveAllergy(body);
    const response = await drchrono.createAllergy(ehrBody, toEhrConfig(siteData));
    return convertAllergyEhrToFhir(response.data as DrChronoAllergy, false);
  }

  // ── ServiceRequest ───────────────────────────────────────────────────────────

  async searchServiceRequest(_siteData: SiteData, _params: FhirSearchParams): Promise<Bundle<ServiceRequest>> {
    throw new Error('DrChrono does not support ServiceRequest search');
  }

  async getServiceRequestById(_siteData: SiteData, _id: string): Promise<ServiceRequest> {
    throw new Error('DrChrono does not support ServiceRequest read');
  }

  // ── MedicationStatement ──────────────────────────────────────────────────────

  async searchMedicationStatement(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<MedicationStatement>> {
    const mapped = mapSearchParams(params);
    const response = await drchrono.searchMedications(mapped, toEhrConfig(siteData));
    return fhirMedicationStatement(
      response.data as DrChronoPaginatedResponse<DrChronoMedication>,
      true,
    ) as Bundle<MedicationStatement>;
  }

  async getMedicationStatementById(siteData: SiteData, id: string): Promise<MedicationStatement> {
    const response = await drchrono.getMedication(id, toEhrConfig(siteData));
    return fhirMedicationStatement(response.data as DrChronoMedication, false) as MedicationStatement;
  }

  async createMedicationStatement(siteData: SiteData, body: MedicationStatement): Promise<any> {
    const ehrBody = saveMedication(body);
    const response = await drchrono.createMedication(ehrBody, toEhrConfig(siteData));
    return fhirMedicationStatement(response.data as DrChronoMedication, false);
  }

  // ── Communication ───────────────────────────────────────────────────────────

  async searchCommunication(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<Communication>> {
    const mapped = mapSearchParams(params);
    const response = await drchrono.searchPatientCommunications(mapped, toEhrConfig(siteData));
    return fhirCommunication(
      response.data as DrChronoPaginatedResponse<DrChronoCommunication>,
      true,
    ) as Bundle<Communication>;
  }

  async getCommunicationById(siteData: SiteData, id: string): Promise<Communication> {
    const response = await drchrono.getPatientCommunication(id, toEhrConfig(siteData));
    return fhirCommunication(response.data as DrChronoCommunication, false) as Communication;
  }

  async createCommunication(siteData: SiteData, body: Communication): Promise<any> {
    const ehrBody = saveCommunication(body);
    const response = await drchrono.createPatientCommunication(ehrBody, toEhrConfig(siteData));
    return fhirCommunication(response.data as DrChronoCommunication, false);
  }

  // ── Observation ──────────────────────────────────────────────────────────────

  async searchObservation(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<Observation>> {
    const mapped = mapSearchParams(params);
    const response = await drchrono.searchLabResults(mapped, toEhrConfig(siteData));
    return fhirObservation(response.data as DrChronoPaginatedResponse<DrChronoLabResult>, true) as Bundle<Observation>;
  }

  async getObservationById(siteData: SiteData, id: string): Promise<Observation> {
    const response = await drchrono.getLabResult(id, toEhrConfig(siteData));
    return fhirObservation(response.data as DrChronoLabResult, false) as Observation;
  }

  // ── DocumentReference ────────────────────────────────────────────────────────

  async searchDocumentReference(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<DocumentReference>> {
    const mapped = mapSearchParams(params);
    const response = await drchrono.searchDocuments(mapped, toEhrConfig(siteData));
    return fhirDocumentReference(response.data, true) as Bundle<DocumentReference>;
  }

  async getDocumentReferenceById(siteData: SiteData, id: string): Promise<DocumentReference> {
    const response = await drchrono.getDocument(id, toEhrConfig(siteData));
    return fhirDocumentReference(response.data, false) as DocumentReference;
  }

  // ── Location ────────────────────────────────────────────────────────────────

  async searchLocation(siteData: SiteData, _params: FhirSearchParams): Promise<Bundle<Location>> {
    const response = await drchrono.getOffices(toEhrConfig(siteData));
    return fhirLocation(response.data as DrChronoPaginatedResponse<DrChronoOffice>, true) as Bundle<Location>;
  }

  async getLocationById(siteData: SiteData, id: string): Promise<Location> {
    const response = await drchrono.getOffice(id, toEhrConfig(siteData));
    return fhirLocation(response.data as DrChronoOffice, false) as Location;
  }

  // ── Task ────────────────────────────────────────────────────────────────────

  async searchTask(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<Task>> {
    const response = await drchrono.searchTasks(toEhrConfig(siteData), mapSearchParams(params));
    return fhirTask(response.data as DrChronoPaginatedResponse<DrChronoTask>, true) as Bundle<Task>;
  }

  async getTaskById(siteData: SiteData, id: string): Promise<Task> {
    const response = await drchrono.getTask(id, toEhrConfig(siteData));
    return fhirTask(response.data as DrChronoTask, false) as Task;
  }
}

export const drchronoDataService = new DrchronoDataService();

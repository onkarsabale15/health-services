// elation-data.service.ts
// Bridge data service for Elation EMR — maps FHIR params/responses via elation.mapper.ts
// and delegates raw API calls to @hs/ehr-data-service.

import type { IVendorDataService, FhirSearchParams } from '../vendor-data-service.interface';
import {
  elation,
  toEhrConfig,
  type SiteData,
  type ElationPatient,
  type ElationAppointment,
  type ElationReport,
} from '@hs/ehr-data-service';
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
import {
  getDates,
  convertPatientsToBundle,
  convertAppointmentsToBundle,
  convertInsuranceToCoverage,
  convertToCommunicationFhir,
  convertReportsToBundle,
} from './elation.mapper';

class ElationDataService implements IVendorDataService {
  // ── Patient ──────────────────────────────────────────────────────────────────

  async searchPatient(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<Patient>> {
    const elationParams: Record<string, any> = { ...params };
    if (params?.date && typeof params.date === 'string') {
      const dates = getDates(params.date);
      if (dates.from_date) elationParams.from_date = dates.from_date;
      if (dates.to_date) elationParams.to_date = dates.to_date;
      delete elationParams.date;
    }
    const response = await elation.searchPatients(elationParams, toEhrConfig(siteData));
    return convertPatientsToBundle(response.data as ElationPatient[], true) as Bundle<Patient>;
  }

  async getPatientById(siteData: SiteData, id: string): Promise<Patient> {
    const response = await elation.getPatient(id, toEhrConfig(siteData));
    return convertPatientsToBundle(response.data as ElationPatient, false) as Patient;
  }

  async createPatient(siteData: SiteData, body: Patient): Promise<Patient> {
    const response = await elation.createPatient(body, toEhrConfig(siteData));
    return convertPatientsToBundle(response.data as ElationPatient, false) as Patient;
  }

  // ── Appointment ──────────────────────────────────────────────────────────────

  async searchAppointment(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<Appointment>> {
    const elationParams: Record<string, any> = { ...params };
    if (params?.date && typeof params.date === 'string') {
      const dates = getDates(params.date);
      if (dates.from_date) elationParams.from_date = dates.from_date;
      if (dates.to_date) elationParams.to_date = dates.to_date;
      delete elationParams.date;
    }
    const response = await elation.searchAppointments(elationParams, toEhrConfig(siteData));
    return convertAppointmentsToBundle(response.data as ElationAppointment[], true) as Bundle<Appointment>;
  }

  async getAppointmentById(siteData: SiteData, id: string): Promise<Appointment> {
    const response = await elation.getAppointment(id, toEhrConfig(siteData));
    return convertAppointmentsToBundle(response.data as ElationAppointment, false) as Appointment;
  }

  // ── Encounter ────────────────────────────────────────────────────────────────

  async searchEncounter(_siteData: SiteData, _params: FhirSearchParams): Promise<Bundle<Encounter>> {
    throw new Error('Elation does not support Encounter search');
  }

  async getEncounterById(_siteData: SiteData, _id: string): Promise<Encounter> {
    throw new Error('Elation does not support Encounter read');
  }

  // ── Coverage ─────────────────────────────────────────────────────────────────

  async searchCoverage(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<Coverage>> {
    const patientId = params?.patient as string;
    if (!patientId) throw new Error('Coverage search requires a patient parameter');
    const response = await elation.getPatient(patientId, toEhrConfig(siteData));
    const patient = response.data as ElationPatient;
    const entries = (patient.insurances ?? []).map((ins) => ({
      resource: convertInsuranceToCoverage(ins, String(patient.id)),
    }));
    return {
      resourceType: 'Bundle',
      type: 'searchset',
      total: entries.length,
      entry: entries,
    } as Bundle<Coverage>;
  }

  async getCoverageById(_siteData: SiteData, _id: string): Promise<Coverage> {
    throw new Error('Elation does not support Coverage read by ID');
  }

  // ── Condition ────────────────────────────────────────────────────────────────

  async searchCondition(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<Condition>> {
    throw new Error('Condition search not implemented for Elation');
  }

  async getConditionById(_siteData: SiteData, _id: string): Promise<Condition> {
    throw new Error('Condition read not implemented for Elation');
  }

  // ── Practitioner ─────────────────────────────────────────────────────────────

  async searchPractitioner(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<Practitioner>> {
    throw new Error('Practitioner search not implemented for Elation');
  }

  async getPractitionerById(_siteData: SiteData, _id: string): Promise<Practitioner> {
    throw new Error('Practitioner read not implemented for Elation');
  }

  // ── AllergyIntolerance ───────────────────────────────────────────────────────

  async searchAllergy(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<AllergyIntolerance>> {
    throw new Error('Allergy search not implemented for Elation');
  }

  async getAllergyById(_siteData: SiteData, _id: string): Promise<AllergyIntolerance> {
    throw new Error('Allergy read not implemented for Elation');
  }

  // ── ServiceRequest ───────────────────────────────────────────────────────────

  async searchServiceRequest(_siteData: SiteData, _params: FhirSearchParams): Promise<Bundle<ServiceRequest>> {
    throw new Error('ServiceRequest search not implemented for Elation');
  }

  async getServiceRequestById(_siteData: SiteData, _id: string): Promise<ServiceRequest> {
    throw new Error('ServiceRequest read not implemented for Elation');
  }

  // ── MedicationStatement ──────────────────────────────────────────────────────

  async searchMedicationStatement(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<MedicationStatement>> {
    throw new Error('MedicationStatement search not implemented for Elation');
  }

  async getMedicationStatementById(_siteData: SiteData, _id: string): Promise<MedicationStatement> {
    throw new Error('MedicationStatement read not implemented for Elation');
  }

  // ── Communication ────────────────────────────────────────────────────────────

  async searchCommunication(_siteData: SiteData, _params: FhirSearchParams): Promise<Bundle<Communication>> {
    throw new Error('Communication search not supported for Elation');
  }

  async getCommunicationById(siteData: SiteData, id: string): Promise<Communication> {
    const response = await elation.getPatient(id, toEhrConfig(siteData));
    return convertToCommunicationFhir(response.data as ElationPatient);
  }

  async createCommunication(siteData: SiteData, body: Communication): Promise<any> {
    const patientId = body?.subject?.reference?.split('/')?.pop() as string;
    const notes = body?.payload?.[0]?.contentString ?? '';
    const response = await elation.patchPatientNotes(patientId, { notes }, toEhrConfig(siteData));
    return convertToCommunicationFhir(response.data);
  }

  // ── Observation ──────────────────────────────────────────────────────────────

  async searchObservation(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<Observation>> {
    const elationParams: Record<string, any> = { ...params };
    if (params?.date && typeof params.date === 'string') {
      const dates = getDates(params.date);
      if (dates.from_date) elationParams.from_date = dates.from_date;
      if (dates.to_date) elationParams.to_date = dates.to_date;
      delete elationParams.date;
    }
    const response = await elation.searchReports(elationParams, toEhrConfig(siteData));
    return convertReportsToBundle(response.data as ElationReport[], true) as Bundle<Observation>;
  }

  async getObservationById(siteData: SiteData, id: string): Promise<Observation> {
    const response = await elation.getReport(id, toEhrConfig(siteData));
    return convertReportsToBundle(response.data as ElationReport, false) as Observation;
  }

  // ── DocumentReference ────────────────────────────────────────────────────────

  async searchDocumentReference(_siteData: SiteData, _params: FhirSearchParams): Promise<Bundle<DocumentReference>> {
    throw new Error('DocumentReference search not implemented for Elation');
  }

  async getDocumentReferenceById(_siteData: SiteData, _id: string): Promise<DocumentReference> {
    throw new Error('DocumentReference read not implemented for Elation');
  }

  // ── Location ─────────────────────────────────────────────────────────────────

  async searchLocation(_siteData: SiteData, _params: FhirSearchParams): Promise<Bundle<Location>> {
    throw new Error('Location search not implemented for Elation');
  }

  async getLocationById(_siteData: SiteData, id: string): Promise<Location> {
    throw new Error('Location read not implemented for Elation');
  }

  // ── Task ─────────────────────────────────────────────────────────────────────

  async searchTask(_siteData: SiteData, _params: FhirSearchParams): Promise<Bundle<Task>> {
    throw new Error('Task search not implemented for Elation');
  }

  async getTaskById(_siteData: SiteData, _id: string): Promise<Task> {
    throw new Error('Task read not implemented for Elation');
  }
}

export const elationDataService = new ElationDataService();

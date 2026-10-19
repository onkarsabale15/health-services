// cerner-data.service.ts
// Bridge service layer for Cerner — implements IVendorDataService.
//
// Maps FHIR search params to Cerner-supported params, delegates raw API calls
// to @hs/ehr-data-service, and rewrites EHR pagination/fullUrl links in responses.
// Cerner is FHIR-native so response transformation is mostly link rewriting.

import { cerner, toEhrConfig } from '@hs/ehr-data-service';
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
  MedicationRequest,
  Communication,
  Observation,
  DocumentReference,
} from '@medplum/fhirtypes';

import type { IVendorDataService, FhirSearchParams, WriteOptions } from '../vendor-data-service.interface';
import {
  convertEhrLinks,
  cernerPatientSearch,
  cernerAllergySearch,
  cernerConditionSearch,
  cernerAppointmentSearch,
  cernerEncounterSearch,
  cernerCoverageSearch,
  cernerPractitionerSearch,
  cernerObservationSearch,
  cernerServiceRequestSearch,
  cernerCommunicationSearch,
  cernerDocumentReferenceSearch,
} from './cerner.mapper';

class CernerDataService implements IVendorDataService {
  // ---------------------------------------------------------------------------
  // Patient
  // ---------------------------------------------------------------------------

  async searchPatient(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<Patient>> {
    const config = toEhrConfig(siteData);
    const mapped = cernerPatientSearch(params);
    const response = await cerner.searchPatients(config, mapped);
    return convertEhrLinks(response.data);
  }

  async getPatientById(siteData: SiteData, id: string): Promise<Patient> {
    const config = toEhrConfig(siteData);
    const response = await cerner.getPatient(config, id);
    return response.data;
  }

  async createPatient(siteData: SiteData, body: Patient): Promise<Patient> {
    const config = toEhrConfig(siteData);
    const response = await cerner.createPatient(config, body);
    return response.data;
  }

  // ---------------------------------------------------------------------------
  // Appointment
  // ---------------------------------------------------------------------------

  async searchAppointment(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<Appointment>> {
    const config = toEhrConfig(siteData);
    const mapped = cernerAppointmentSearch(params);
    const response = await cerner.searchAppointments(config, mapped);
    return convertEhrLinks(response.data);
  }

  async getAppointmentById(siteData: SiteData, id: string): Promise<Appointment> {
    const config = toEhrConfig(siteData);
    const response = await cerner.getAppointment(config, id);
    return response.data;
  }

  // ---------------------------------------------------------------------------
  // Encounter
  // ---------------------------------------------------------------------------

  async searchEncounter(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<Encounter>> {
    const config = toEhrConfig(siteData);
    const mapped = cernerEncounterSearch(params);
    const response = await cerner.searchEncounters(config, mapped);
    return convertEhrLinks(response.data);
  }

  async getEncounterById(siteData: SiteData, id: string): Promise<Encounter> {
    const config = toEhrConfig(siteData);
    const response = await cerner.getEncounter(config, id);
    return response.data;
  }

  // ---------------------------------------------------------------------------
  // Coverage
  // ---------------------------------------------------------------------------

  async searchCoverage(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<Coverage>> {
    const config = toEhrConfig(siteData);
    const mapped = cernerCoverageSearch(params);
    const response = await cerner.searchCoverages(config, mapped);
    return convertEhrLinks(response.data);
  }

  async getCoverageById(siteData: SiteData, id: string): Promise<Coverage> {
    const config = toEhrConfig(siteData);
    const response = await cerner.getCoverage(config, id);
    return response.data;
  }

  async createCoverage(siteData: SiteData, body: Coverage): Promise<Coverage> {
    const config = toEhrConfig(siteData);
    const response = await cerner.createCoverage(config, body);
    return response.data;
  }

  // ---------------------------------------------------------------------------
  // Condition
  // ---------------------------------------------------------------------------

  async searchCondition(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<Condition>> {
    const config = toEhrConfig(siteData);
    const mapped = cernerConditionSearch(params);
    const response = await cerner.searchConditions(config, mapped);
    return convertEhrLinks(response.data);
  }

  async getConditionById(siteData: SiteData, id: string): Promise<Condition> {
    const config = toEhrConfig(siteData);
    const response = await cerner.getCondition(config, id);
    return response.data;
  }

  async createCondition(siteData: SiteData, body: Condition): Promise<Condition> {
    const config = toEhrConfig(siteData);
    const response = await cerner.createCondition(config, body);
    return response.data;
  }

  async updateCondition(siteData: SiteData, id: string, body: Condition, options?: WriteOptions): Promise<Condition> {
    const config = toEhrConfig(siteData);
    const response = await cerner.updateCondition(config, id, body, options);
    return response.data;
  }

  // ---------------------------------------------------------------------------
  // Practitioner
  // ---------------------------------------------------------------------------

  async searchPractitioner(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<Practitioner>> {
    const config = toEhrConfig(siteData);
    const mapped = cernerPractitionerSearch(params);
    const response = await cerner.searchPractitioners(config, mapped);
    return convertEhrLinks(response.data);
  }

  async getPractitionerById(siteData: SiteData, id: string): Promise<Practitioner> {
    const config = toEhrConfig(siteData);
    const response = await cerner.getPractitioner(config, id);
    return response.data;
  }

  // ---------------------------------------------------------------------------
  // AllergyIntolerance
  // ---------------------------------------------------------------------------

  async searchAllergy(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<AllergyIntolerance>> {
    const config = toEhrConfig(siteData);
    const mapped = cernerAllergySearch(params);
    const response = await cerner.searchAllergies(config, mapped);
    return convertEhrLinks(response.data);
  }

  async getAllergyById(siteData: SiteData, id: string): Promise<AllergyIntolerance> {
    const config = toEhrConfig(siteData);
    const response = await cerner.getAllergy(config, id);
    return response.data;
  }

  async createAllergy(siteData: SiteData, body: AllergyIntolerance): Promise<AllergyIntolerance> {
    const config = toEhrConfig(siteData);
    const response = await cerner.createAllergy(config, body);
    return response.data;
  }

  // ---------------------------------------------------------------------------
  // ServiceRequest
  // ---------------------------------------------------------------------------

  async searchServiceRequest(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<ServiceRequest>> {
    const config = toEhrConfig(siteData);
    const mapped = cernerServiceRequestSearch(params);
    const response = await cerner.searchServiceRequests(config, mapped);
    return convertEhrLinks(response.data);
  }

  async getServiceRequestById(siteData: SiteData, id: string): Promise<ServiceRequest> {
    const config = toEhrConfig(siteData);
    const response = await cerner.getServiceRequest(config, id);
    return response.data;
  }

  // ---------------------------------------------------------------------------
  // MedicationStatement — not supported by Cerner R4 API
  // ---------------------------------------------------------------------------

  async searchMedicationStatement(_siteData: SiteData, _params: FhirSearchParams): Promise<Bundle<any>> {
    throw new Error('MedicationStatement search is not supported by Cerner');
  }

  async getMedicationStatementById(_siteData: SiteData, _id: string): Promise<any> {
    throw new Error('MedicationStatement read is not supported by Cerner');
  }

  // ---------------------------------------------------------------------------
  // MedicationRequest — Cerner's supported medication resource
  // ---------------------------------------------------------------------------

  async searchMedicationRequest(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<MedicationRequest>> {
    const config = toEhrConfig(siteData);
    const mapped: Record<string, any> = {
      patient: params.patient,
      ...(params.status && { status: params.status }),
      ...(params['_count'] && { _count: params['_count'] }),
    };
    const response = await cerner.searchMedicationRequests(config, mapped);
    return convertEhrLinks(response.data);
  }

  async getMedicationRequestById(siteData: SiteData, id: string): Promise<MedicationRequest> {
    const config = toEhrConfig(siteData);
    const response = await cerner.getMedicationRequest(config, id);
    return response.data;
  }

  // ---------------------------------------------------------------------------
  // Communication
  // ---------------------------------------------------------------------------

  async searchCommunication(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<Communication>> {
    const config = toEhrConfig(siteData);
    const mapped = cernerCommunicationSearch(params);
    const response = await cerner.searchCommunications(config, mapped);
    return convertEhrLinks(response.data);
  }

  async getCommunicationById(siteData: SiteData, id: string): Promise<Communication> {
    const config = toEhrConfig(siteData);
    const response = await cerner.getCommunication(config, id);
    return response.data;
  }

  async createCommunication(siteData: SiteData, body: Communication): Promise<Communication> {
    const config = toEhrConfig(siteData);
    const response = await cerner.createCommunication(config, body);
    return response.data;
  }

  // ---------------------------------------------------------------------------
  // Observation
  // ---------------------------------------------------------------------------

  async searchObservation(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<Observation>> {
    const config = toEhrConfig(siteData);
    const mapped = cernerObservationSearch(params);
    const response = await cerner.searchObservations(config, mapped);
    return convertEhrLinks(response.data);
  }

  async getObservationById(siteData: SiteData, id: string): Promise<Observation> {
    const config = toEhrConfig(siteData);
    const response = await cerner.getObservation(config, id);
    return response.data;
  }

  async createObservation(siteData: SiteData, body: Observation): Promise<Observation> {
    const config = toEhrConfig(siteData);
    const response = await cerner.createObservation(config, body);
    return response.data;
  }

  // ---------------------------------------------------------------------------
  // DocumentReference
  // ---------------------------------------------------------------------------

  async searchDocumentReference(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<DocumentReference>> {
    const config = toEhrConfig(siteData);
    const mapped = cernerDocumentReferenceSearch(params);
    const response = await cerner.searchDocumentReferences(config, mapped);
    return convertEhrLinks(response.data);
  }

  async getDocumentReferenceById(siteData: SiteData, id: string): Promise<DocumentReference> {
    const config = toEhrConfig(siteData);
    const response = await cerner.getDocumentReference(config, id);
    return response.data;
  }

  async createDocumentReference(siteData: SiteData, body: DocumentReference): Promise<DocumentReference> {
    const config = toEhrConfig(siteData);
    const response = await cerner.createDocumentReference(config, body);
    return response.data;
  }

  // ---------------------------------------------------------------------------
  // Location — not supported by Cerner R4 API
  // ---------------------------------------------------------------------------

  async searchLocation(_siteData: SiteData, _params: FhirSearchParams): Promise<Bundle<any>> {
    throw new Error('Location search is not supported by Cerner');
  }

  async getLocationById(_siteData: SiteData, _id: string): Promise<any> {
    throw new Error('Location read is not supported by Cerner');
  }

  // ---------------------------------------------------------------------------
  // Task — not supported by Cerner R4 API
  // ---------------------------------------------------------------------------

  async searchTask(_siteData: SiteData, _params: FhirSearchParams): Promise<Bundle<any>> {
    throw new Error('Task search is not supported by Cerner');
  }

  async getTaskById(_siteData: SiteData, _id: string): Promise<any> {
    throw new Error('Task read is not supported by Cerner');
  }
}

export const cernerDataService = new CernerDataService();

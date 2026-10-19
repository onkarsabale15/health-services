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
  MedicationRequest,
  Communication,
  Observation,
  DocumentReference,
  Location,
  Task,
} from '@medplum/fhirtypes';
import type { SiteData } from '@hs/ehr-data-service';

/**
 * Common interface for bridge vendor data services.
 *
 * Each vendor implements this interface for standardized FHIR routing
 * from controllers. Methods handle mapping (FHIR ↔ vendor format)
 * and delegate raw API calls to @hs/ehr-data-service.
 */
export type FhirSearchParams = Record<string, string | number | boolean | string[] | undefined>;

/** Per-write options that callers can forward to the EHR (concurrency, etc.). */
export interface WriteOptions {
  /** Verbatim If-Match value from the inbound request — opaque to bridge, the EHR enforces format. */
  ifMatch?: string;
}

export interface IVendorDataService {
  // Patient
  searchPatient(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<Patient>>;
  getPatientById(siteData: SiteData, id: string, query?: Record<string, string>): Promise<Patient>;
  createPatient?(siteData: SiteData, body: Patient): Promise<Patient>;

  // Appointment
  searchAppointment(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<Appointment>>;
  getAppointmentById(siteData: SiteData, id: string): Promise<Appointment>;
  createAppointment?(siteData: SiteData, body: Appointment): Promise<Appointment>;

  // Encounter
  searchEncounter(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<Encounter>>;
  getEncounterById(siteData: SiteData, id: string): Promise<Encounter>;
  createEncounter?(siteData: SiteData, body: Encounter): Promise<Encounter>;
  updateEncounter?(siteData: SiteData, id: string, body: Encounter, options?: WriteOptions): Promise<any>;

  // Coverage
  searchCoverage(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<Coverage>>;
  getCoverageById(siteData: SiteData, id: string): Promise<Coverage>;
  createCoverage?(siteData: SiteData, body: Coverage): Promise<Coverage>;

  // Condition
  searchCondition(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<Condition>>;
  getConditionById(siteData: SiteData, id: string): Promise<Condition>;
  createCondition?(siteData: SiteData, body: Condition): Promise<any>;
  updateCondition?(siteData: SiteData, id: string, body: Condition, options?: WriteOptions): Promise<any>;

  // Practitioner
  searchPractitioner(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<Practitioner>>;
  getPractitionerById(siteData: SiteData, id: string): Promise<Practitioner>;

  // AllergyIntolerance
  searchAllergy(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<AllergyIntolerance>>;
  getAllergyById(siteData: SiteData, id: string): Promise<AllergyIntolerance>;
  createAllergy?(siteData: SiteData, body: AllergyIntolerance): Promise<any>;

  // ServiceRequest
  searchServiceRequest(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<ServiceRequest>>;
  getServiceRequestById(siteData: SiteData, id: string): Promise<ServiceRequest>;
  createServiceRequest?(siteData: SiteData, body: ServiceRequest): Promise<any>;

  // MedicationStatement
  searchMedicationStatement(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<MedicationStatement>>;
  getMedicationStatementById(siteData: SiteData, id: string): Promise<MedicationStatement>;
  createMedicationStatement?(siteData: SiteData, body: MedicationStatement): Promise<any>;

  // MedicationRequest
  searchMedicationRequest?(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<MedicationRequest>>;
  getMedicationRequestById?(siteData: SiteData, id: string): Promise<MedicationRequest>;

  // Communication
  searchCommunication(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<Communication>>;
  getCommunicationById(siteData: SiteData, id: string): Promise<Communication>;
  createCommunication?(siteData: SiteData, body: Communication): Promise<any>;

  // Observation
  searchObservation(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<Observation>>;
  getObservationById(siteData: SiteData, id: string): Promise<Observation>;
  createObservation?(siteData: SiteData, body: Observation): Promise<any>;

  // DocumentReference
  searchDocumentReference(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<DocumentReference>>;
  getDocumentReferenceById(siteData: SiteData, id: string): Promise<DocumentReference | any>;
  createDocumentReference?(siteData: SiteData, body: DocumentReference): Promise<any>;

  // Location
  searchLocation(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<Location>>;
  getLocationById(siteData: SiteData, id: string): Promise<Location>;

  // Task
  searchTask(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<Task>>;
  getTaskById(siteData: SiteData, id: string): Promise<Task>;
  createTask?(siteData: SiteData, body: Task): Promise<any>;
  updateTask?(siteData: SiteData, id: string, body: Task): Promise<any>;
}

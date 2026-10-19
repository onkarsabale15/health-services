import type { operations } from '../generated/api-types';

/** All FHIR R4 resource types available in the Bridge API */
export type FhirResourceType =
  | 'Patient'
  | 'Appointment'
  | 'Encounter'
  | 'Coverage'
  | 'Condition'
  | 'Practitioner'
  | 'AllergyIntolerance'
  | 'ServiceRequest'
  | 'MedicationStatement'
  | 'MedicationRequest'
  | 'Communication'
  | 'Observation'
  | 'DocumentReference'
  | 'Location'
  | 'Task';

/** Extract query parameters from an operation type */
type QueryOf<T> = T extends { parameters: { query?: infer Q } } ? Q : Record<string, string>;

/** Map resource type to its search parameters (auto-derived from generated types) */
export type SearchParamsFor<R extends FhirResourceType> = R extends 'Patient'
  ? QueryOf<operations['PatientController_getAllPatients']>
  : R extends 'Appointment'
    ? QueryOf<operations['AppointmentController_getAllAppointments']>
    : R extends 'Encounter'
      ? QueryOf<operations['EncounterController_getAllEncounters']>
      : R extends 'Coverage'
        ? QueryOf<operations['CoverageController_getAllCoverages']>
        : R extends 'Condition'
          ? QueryOf<operations['ConditionController_getAllConditions']>
          : R extends 'Practitioner'
            ? QueryOf<operations['PractitionerController_getAllPractitioners']>
            : R extends 'AllergyIntolerance'
              ? QueryOf<operations['AllergyIntoleranceController_getAllAllergies']>
              : R extends 'ServiceRequest'
                ? QueryOf<operations['ServiceRequestController_getAllServiceRequests']>
                : R extends 'MedicationStatement'
                  ? QueryOf<operations['MedicationStatementController_getAllMedicationStatements']>
                  : R extends 'Communication'
                    ? QueryOf<operations['CommunicationController_getAllCommunications']>
                    : R extends 'Observation'
                      ? QueryOf<operations['ObservationController_getAllObservations']>
                      : R extends 'DocumentReference'
                        ? QueryOf<operations['DocumentReferenceController_getAllDocumentReferences']>
                        : R extends 'Location'
                          ? QueryOf<operations['LocationController_getAllLocations']>
                          : R extends 'Task'
                            ? QueryOf<operations['TaskController_getAllTasks']>
                            : Record<string, string>;

/** Configuration for the Bridge SDK client */
export interface BridgeClientConfig {
  /** Bridge API base URL (e.g., 'http://localhost:3000/api') */
  baseUrl: string;
  /** Injected auth strategy — returns a Bearer token. DIP: each consumer provides its own auth. */
  getToken: () => Promise<string>;
}

/** FHIR Bundle response from search operations */
export interface FhirBundle {
  resourceType: 'Bundle';
  type: string;
  total?: number;
  link?: Array<{ relation: string; url: string }>;
  entry?: Array<{ resource?: Record<string, unknown>; search?: { mode?: string } }>;
  [key: string]: unknown;
}

/** Single FHIR resource response */
export interface FhirResource {
  resourceType: string;
  id?: string;
  [key: string]: unknown;
}

/** Connection response from bridge-api */
export interface ConnectionResponse {
  connectionId: string;
  ehrName: string;
  expiresIn: number;
  patient?: string;
  encounter?: string;
  [key: string]: unknown;
}

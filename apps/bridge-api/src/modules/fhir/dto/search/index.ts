export { BaseFhirSearchParams } from './base-search.dto';
export { PatientSearchParams } from './patient-search.dto';
export { AllergyIntoleranceSearchParams } from './allergy-intolerance-search.dto';
export { AppointmentSearchParams } from './appointment-search.dto';
export { ConditionSearchParams } from './condition-search.dto';
export { CoverageSearchParams } from './coverage-search.dto';
export { CommunicationSearchParams } from './communication-search.dto';
export { DocumentReferenceSearchParams } from './document-reference-search.dto';
export { EncounterSearchParams } from './encounter-search.dto';
export { LocationSearchParams } from './location-search.dto';
export { MedicationStatementSearchParams } from './medication-statement-search.dto';
export { MedicationRequestSearchParams } from './medication-request-search.dto';
export { ObservationSearchParams } from './observation-search.dto';
export { PractitionerSearchParams } from './practitioner-search.dto';
export { ServiceRequestSearchParams } from './service-request-search.dto';
export { TaskSearchParams } from './task-search.dto';

// Backward compatibility — alias for code that imports the old generic class
export { BaseFhirSearchParams as FhirSearchParams } from './base-search.dto';

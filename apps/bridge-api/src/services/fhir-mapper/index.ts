// ─── Base ─────────────────────────────────────────────────────────────────────
export { BaseResource } from './BaseResource';

// ─── Types ───────────────────────────────────────────────────────────────────
export * from './fhir-mapper.types';

// ─── Utils ───────────────────────────────────────────────────────────────────
export { CodeableConcept } from './utils/CodeableConcept';
export { HumanName } from './utils/HumanName';
export { Address } from './utils/Address';
export type { AddressData } from './utils/Address';
export { ContactPoint } from './utils/ContactPoint';
export { Identifier } from './utils/Identifier';
export type { IdentifierData } from './utils/Identifier';
export { Reference } from './utils/Reference';
export { Period } from './utils/Period';
export { Extension } from './utils/Extension';
export { Qualification } from './utils/Qualification';
export type { QualificationEntry } from './utils/Qualification';
export { Quantity } from './utils/Quantity';
export { Dosage } from './utils/Dosage';
export { ParameterItem } from './utils/Parameter';

// ─── Resources ───────────────────────────────────────────────────────────────
export { Patient } from './resources/Patient';
export type { PatientCommunication } from './resources/Patient';
export { Practitioner } from './resources/Practitioner';
export { Coverage } from './resources/Coverage';
export { Encounter } from './resources/Encounter';
export { Appointment } from './resources/Appointment';
export { AllergyIntolerance } from './resources/AllergyIntolerance';
export type { AllergyReaction } from './resources/AllergyIntolerance';
export { MedicationStatement } from './resources/MedicationStatement';
export { Observation } from './resources/Observation';
export type { ObservationComponent } from './resources/Observation';
export { DocumentReference } from './resources/DocumentReference';
export { Condition } from './resources/Condition';
export { Parameters } from './resources/Parameters';

import type {
  Patient,
  Bundle,
  Appointment,
  Encounter,
  Coverage,
  Condition,
  AllergyIntolerance,
  MedicationStatement,
  Observation,
  DocumentReference,
  Practitioner,
} from '@medplum/fhirtypes';

/** Type aliases for Cerner proprietary extensions (if any) */
export type CernerPatient = Patient;
export type CernerAppointment = Appointment;
export type CernerEncounter = Encounter;
export type CernerCoverage = Coverage;
export type CernerCondition = Condition;
export type CernerAllergy = AllergyIntolerance;
export type CernerMedication = MedicationStatement;
export type CernerObservation = Observation;
export type CernerDocument = DocumentReference;
export type CernerPractitioner = Practitioner;

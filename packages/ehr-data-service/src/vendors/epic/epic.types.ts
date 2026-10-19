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

/** Type aliases for Epic proprietary extensions (if any) */
export type EpicPatient = Patient;
export type EpicAppointment = Appointment;
export type EpicEncounter = Encounter;
export type EpicCoverage = Coverage;
export type EpicCondition = Condition;
export type EpicAllergy = AllergyIntolerance;
export type EpicMedication = MedicationStatement;
export type EpicObservation = Observation;
export type EpicDocument = DocumentReference;
export type EpicPractitioner = Practitioner;

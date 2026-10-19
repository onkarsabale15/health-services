// ─── FHIR primitive types ────────────────────────────────────────────────────

export type FhirDate = string; // YYYY-MM-DD
export type FhirDateTime = string; // YYYY-MM-DDThh:mm:ss[Z|+hh:mm]
export type FhirInstant = string; // YYYY-MM-DDThh:mm:ss.sss[Z|+hh:mm]
export type FhirUri = string;

// ─── Coding ──────────────────────────────────────────────────────────────────

export interface CodingEntry {
  system?: string;
  version?: string;
  code?: string;
  display?: string;
  userSelected?: boolean;
}

// ─── Address ─────────────────────────────────────────────────────────────────

export type AddressUse = 'home' | 'work' | 'temp' | 'old' | 'billing';
export type AddressType = 'postal' | 'physical' | 'both';

export interface AddressProps {
  use?: AddressUse;
  type?: AddressType;
  text?: string;
  line?: string[];
  city?: string;
  district?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

// ─── HumanName ───────────────────────────────────────────────────────────────

export type NameUse = 'usual' | 'official' | 'temp' | 'nickname' | 'anonymous' | 'old' | 'maiden';

export interface HumanNameProps {
  use?: NameUse;
  text?: string;
  family?: string;
  given?: string[];
  prefix?: string[];
  suffix?: string[];
}

// ─── ContactPoint ────────────────────────────────────────────────────────────

export type ContactPointSystem = 'phone' | 'fax' | 'email' | 'pager' | 'url' | 'sms' | 'other';
export type ContactPointUse = 'home' | 'work' | 'temp' | 'old' | 'mobile';

export interface ContactPointProps {
  system?: ContactPointSystem;
  value?: string;
  use?: ContactPointUse;
}

// ─── Identifier ──────────────────────────────────────────────────────────────

export type IdentifierUse = 'usual' | 'official' | 'temp' | 'secondary' | 'old';

export interface IdentifierProps {
  use?: IdentifierUse;
  type?: import('./utils/CodeableConcept').CodeableConcept;
  system?: string;
  value?: string;
}

// ─── Extension ───────────────────────────────────────────────────────────────

export interface ExtensionProps {
  url: string;
  valueString?: string;
  valueBoolean?: boolean;
  valueReference?: import('./utils/Reference').Reference;
}

// ─── Period ──────────────────────────────────────────────────────────────────

export interface PeriodData {
  start?: FhirDateTime | null;
  end?: FhirDateTime | null;
}

// ─── Reference ───────────────────────────────────────────────────────────────

export type ReferenceResourceType =
  | 'Patient'
  | 'Practitioner'
  | 'PractitionerRole'
  | 'RelatedPerson'
  | 'Organization'
  | 'Location'
  | 'Device'
  | 'Medication'
  | 'Substance'
  | 'MedicationStatement'
  | 'MedicationRequest'
  | 'Observation'
  | 'Condition'
  | 'Procedure'
  | 'Encounter'
  | 'EpisodeOfCare'
  | 'CarePlan'
  | 'ServiceRequest'
  | 'DiagnosticReport'
  | 'Appointment';

export interface ReferenceProps {
  reference: string;
  display?: string;
}

// ─── Meta ────────────────────────────────────────────────────────────────────

export interface MetaParams {
  versionId?: string;
  lastUpdated?: string;
  [key: string]: unknown;
}

// ─── Text (Narrative) ────────────────────────────────────────────────────────

export type NarrativeStatus = 'generated' | 'extensions' | 'additional' | 'empty';

export interface TextParams {
  status: NarrativeStatus;
  div: string;
}

// ─── Note ────────────────────────────────────────────────────────────────────

export interface NoteParams {
  authorReference?: import('./utils/Reference').Reference;
  authorString?: string;
  time?: Date | string;
  text: string;
}

// ─── Participant ─────────────────────────────────────────────────────────────

export interface ParticipantParams {
  type?: import('./utils/CodeableConcept').CodeableConcept[];
  period?: import('./utils/Period').Period;
  individual?: import('./utils/Reference').Reference;
  actor?: import('./utils/Reference').Reference;
}

// ─── Location (Encounter) ────────────────────────────────────────────────────

export interface EncounterLocationParams {
  location?: import('./utils/Reference').Reference;
  period?: import('./utils/Period').Period;
  status?: string;
  physicalType?: string;
}

// ─── Contact (Patient) ───────────────────────────────────────────────────────

export interface ContactParams {
  relationship: import('./utils/CodeableConcept').CodeableConcept[];
  name: import('./utils/HumanName').HumanName;
  telecom?: import('./utils/ContactPoint').ContactPoint[];
  address?: import('./utils/Address').Address;
  period?: import('./utils/Period').Period;
}

// ─── Qualification ───────────────────────────────────────────────────────────

export interface QualificationParams {
  code?: import('./utils/CodeableConcept').CodeableConcept;
  identifier?: import('./utils/Identifier').Identifier[];
}

// ─── Quantity ────────────────────────────────────────────────────────────────

export interface QuantityProps {
  value?: number;
  unit?: string;
  system?: string;
  code?: string;
}

// ─── Dosage ──────────────────────────────────────────────────────────────────

export interface DoseAndRate {
  doseQuantity?: import('./utils/Quantity').Quantity;
}

// ─── Parameter ───────────────────────────────────────────────────────────────

export interface ParameterProps {
  name?: string;
  valueString?: string;
  valueCodeableConcept?: import('./utils/CodeableConcept').CodeableConcept;
}

// ─── Content (DocumentReference) ─────────────────────────────────────────────

export interface AttachmentProps {
  contentType?: string;
  language?: string;
  data?: unknown;
  url?: string;
  title?: string;
}

export interface ContentProps {
  attachment?: AttachmentProps;
  format?: CodingEntry;
}

// ─── Allowed resource types ──────────────────────────────────────────────────

export type ResourceType =
  | 'Patient'
  | 'Coverage'
  | 'Condition'
  | 'AllergyIntolerance'
  | 'Observation'
  | 'DocumentReference'
  | 'MedicationStatement'
  | 'Appointment'
  | 'Encounter'
  | 'Practitioner'
  | 'OperationOutcome'
  | 'Parameters';

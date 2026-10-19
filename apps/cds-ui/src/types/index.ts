// ── CDS Card (AI output) ─────────────────────────────────────

export interface FhirCoding {
  system: string;
  code: string;
  display: string;
}

// ── FHIR resource result from write endpoints ───────────────

export interface FhirResourceResult {
  resourceType: string;
  id?: string;
  [key: string]: unknown;
}

// ── Terminology result ──────────────────────────────────────
//
// SNOMED + ICD-10 results come from the bridge terminology API via cds-app
// in a system-agnostic shape. LOINC + RxNorm still come straight from
// cds-app's local code tables with their legacy per-system fields until
// bridge providers are added for those systems.

export type TerminologySystem = 'snomed' | 'icd10' | 'loinc' | 'rxnorm';

/** Core concept returned by bridge terminology search/lookup. */
export interface TerminologyConcept {
  system: TerminologySystem;
  systemUri: string;
  code: string;
  display: string | null;
}

/** A concept with its cross-mapped counterparts in other code systems. */
export interface TerminologyConceptWithMappings extends TerminologyConcept {
  mappings: TerminologyConcept[];
}

// ── Clinical write request shapes ───────────────────────────
//
// Lean DTOs the frontend sends to cds-app. The backend assembles full
// FHIR resource bodies from these — the frontend never touches FHIR
// URIs or HL7 code values.

/** Must stay in sync with cds-app ConditionStateValue. */
export type ConditionStateValue =
  | 'active-confirmed'
  | 'active-provisional'
  | 'recurrence'
  | 'remission'
  | 'resolved'
  | 'inactive'
  | 'refuted'
  | 'entered-in-error';

export type ConditionSeverityLevel = 'mild' | 'moderate' | 'severe';

export interface ConditionRequest {
  concept: TerminologyConceptWithMappings;
  state: ConditionStateValue;
  /**
   * FHIR Condition category — driven by the EHR's capability profile. The
   * UI populates this from `capabilities.categories` and never sets it
   * blindly; defaults to `problem-list-item` server-side if omitted.
   */
  category?: 'problem-list-item' | 'encounter-diagnosis' | 'health-concern';
  severity?: ConditionSeverityLevel;
  abatementDate?: string;
  note?: string;
}

/** Legacy LOINC/RxNorm shape — cds-app local code tables. */
export interface LocalTerminologyCode {
  id: string;
  code?: string;
  rxcui?: string;
  description?: string;
  longName?: string;
  shortName?: string;
  component?: string;
  category?: string;
  semanticTag?: string;
  classType?: string;
  tty?: string;
  name?: string;
}

export interface CdsCard {
  category:
    | 'pcp-suggestion'
    | 'allergy-caution'
    | 'drug-interaction'
    | 'missing-screening'
    | 'care-gap'
    | 'patient-safety';
  severity: 'critical' | 'warning' | 'info';
  summary: string;
  detail: string;
  suggestions: string[];
  references?: string[];
  relatedResources?: { resourceType: string; id: string }[];
  coding?: FhirCoding;
}

// ── Care Plan (persisted) ────────────────────────────────────

export interface CarePlan {
  id: string;
  applicationId: string;
  siteId: string | null;
  patientFhirId: string;
  encounterFhirId: string | null;
  ehrName: string;
  title: string;
  status: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'REVOKED';
  cards: CdsCard[];
  providerName: string | null;
  providerFhirId: string | null;
  patientName: string | null;
  encounterType: string | null;
  encounterDate: string | null;
  version: number;
  parentId: string | null;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── Analysis (polling) ───────────────────────────────────────

export interface AnalysisResponse {
  sessionId: string;
  status: 'pending' | 'analyzing' | 'complete' | 'error';
  patientId: string;
  encounterId?: string;
  ehrName: string;
  error?: string;
  cards?: CdsCard[];
  createdAt: string;
}

// ── Clinical Data (mapped from FHIR — lightweight) ──────────

export interface PatientSummary {
  id: string;
  fullName: string;
  firstName: string;
  lastName: string;
  gender: string;
  birthDate: string;
  age: number;
  mrn: string;
  phone?: string;
  address?: string;
  language?: string;
  maritalStatus?: string;
  race?: string;
  ethnicity?: string;
}

export interface EncounterSummary {
  id: string;
  status: string;
  type: string;
  reasonForVisit: string;
  startDate?: string;
  endDate?: string;
  department?: string;
  provider?: string;
  /** Linked appointment id, derived server-side from Encounter.appointment[0]. */
  appointmentId?: string;
}

export interface AppointmentSummary {
  id: string;
  status: string;
  type: string;
  startDate?: string;
  endDate?: string;
  provider?: string;
  location?: string;
  reasonForVisit?: string;
}

export interface ConditionCoding {
  system: string;
  code: string;
  display?: string;
}

export interface ConditionSummary {
  id: string;
  name: string;
  /** Primary coding's `code` — used by writeback flows that target one system. */
  icdCode: string;
  /** Primary coding's `system` URI. */
  codeSystem: string;
  /** Every coding the EHR returned. UI shows all; writeback still uses the primary. */
  codings: ConditionCoding[];
  clinicalStatus: string;
  verificationStatus: string;
  /** Combined (clinical, verification) → canonical CDS state. Derived once at map time. */
  stateValue: ConditionStateValue;
  severity?: string;
  /** Normalized severity enum derived from `severity` (`null` when unrecognized/missing). */
  severityLevel: ConditionSeverityLevel | null;
  onsetDate?: string;
  category: string;
  recordedDate?: string;
  lastUpdated?: string;
  notes: string[];
}

export interface AllergySummary {
  id: string;
  substance: string;
  code?: string;
  /** active / inactive / resolved — drives the active vs inactive split in the detail modal. */
  clinicalStatus: string;
  criticality: string;
  type: string;
  reactions: { manifestation: string; severity: string }[];
  onsetDate?: string;
  recordedDate?: string;
  lastUpdated?: string;
  notes: string[];
}

export interface MedicationSummary {
  id: string;
  name: string;
  code?: string;
  status: string;
  dosage: string;
  route?: string;
  frequency?: string;
  startDate?: string;
  recordedDate?: string;
  lastUpdated?: string;
  notes: string[];
}

export interface VitalSummary {
  id: string;
  name: string;
  code: string;
  value: string;
  unit: string;
  numericValue?: number;
  interpretation?: string;
  isAbnormal: boolean;
  date: string;
  issuedDate?: string;
  lastUpdated?: string;
  notes: string[];
}

export interface ClinicalData {
  patient: PatientSummary | null;
  encounter: EncounterSummary | null;
  conditions: ConditionSummary[];
  allergies: AllergySummary[];
  medications: MedicationSummary[];
  vitals: VitalSummary[];
}

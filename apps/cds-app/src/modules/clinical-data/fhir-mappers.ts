/**
 * FHIR-to-UI mappers.
 *
 * Transforms raw FHIR R4 resources into lightweight, UI-friendly and
 * AI-analysis-friendly structures. Raw FHIR bundles can be 50-200KB;
 * these mappers extract only clinically relevant fields, reducing
 * payload size and LLM token usage by ~90%.
 *
 * Strict typing: every mapper consumes a typed FHIR resource from
 * `@medplum/fhirtypes` rather than `any`. Bridge returns loose
 * `Record<string, unknown>` payloads; the controllers/providers cast
 * at the boundary, and from here on the resource is typed.
 */

import type {
  AllergyIntolerance,
  AllergyIntoleranceReaction,
  Appointment,
  AppointmentParticipant,
  Bundle,
  BundleEntry,
  Coding,
  Condition,
  Dosage,
  Encounter,
  Extension,
  HumanName,
  Identifier,
  MedicationRequest,
  MedicationStatement,
  Observation,
  ObservationComponent,
  Patient,
  Practitioner,
  Resource,
} from '@medplum/fhirtypes';
import type { ConditionStateValue } from '../providers/capabilities/capability.types';
import type { SeverityLevel } from '../clinical-write/constants/fhir-codings';

// ── Mapped Types (UI + AI friendly) ─────────────────────────

export interface PractitionerSummary {
  id: string;
  fullName: string;
  npi?: string;
  specialty?: string;
  /** First qualifying coding's display — convenience field for UI labels. */
  qualification?: string;
  /**
   * Full raw qualification array from the FHIR Practitioner resource.
   * Surfaced here (not mapped further) so cds-app can derive the session's
   * `providerRole` from authoritative codes/displays. UI components MUST
   * NOT branch on these — they're an internal hydration signal.
   */
  qualifications?: Array<{
    code?: {
      coding?: Array<{ system?: string; code?: string; display?: string }>;
      text?: string;
    };
  }>;
  email?: string;
  phone?: string;
}

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
  /**
   * The appointment this encounter was scheduled from, if any. Derived
   * from `Encounter.appointment[0].reference` and stripped to the bare
   * id. The FE patient page chains `useAppointment(encounter.data?.appointmentId)`
   * to render appointment details alongside the encounter — patient
   * meta itself doesn't carry this because SMART launch tokens don't.
   */
  appointmentId?: string;
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
  /** Free-form severity from the EHR (e.g. "Moderate"). Use `severityLevel` for matching. */
  severity?: string;
  /** Normalized severity enum derived from `severity` (`null` when unrecognized/missing). */
  severityLevel: SeverityLevel | null;
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

export interface ClinicalDataMapped {
  patient: PatientSummary | null;
  encounter: EncounterSummary | null;
  conditions: ConditionSummary[];
  allergies: AllergySummary[];
  medications: MedicationSummary[];
  vitals: VitalSummary[];
}

// ── Resource shape that bridge hands us ──────────────────────
//
// Bridge returns loose `Record<string, unknown>` for FHIR payloads. Mappers
// accept that and cast to the appropriate FHIR resource type at the entry —
// this preserves runtime safety (every field is checked with optional
// chaining) while giving callers proper compile-time types.

type RawResource = Record<string, unknown>;

// ── Shared helpers ──────────────────────────────────────────

interface WithNotes {
  note?: Array<{ text?: string }>;
}

function extractNotes(resource: WithNotes | RawResource | null | undefined): string[] {
  const note = (resource as WithNotes | undefined)?.note;
  if (!Array.isArray(note)) return [];
  return note.map((n) => n?.text).filter((t): t is string => typeof t === 'string' && t.trim().length > 0);
}

function extractLastUpdated(resource: Resource | RawResource | null | undefined): string | undefined {
  return (resource as Resource | undefined)?.meta?.lastUpdated?.slice(0, 10) || undefined;
}

// ── Mappers ──────────────────────────────────────────────────

function calcAge(birthDate: string): number {
  return Math.floor((Date.now() - new Date(birthDate).getTime()) / 31557600000);
}

export function mapPatient(resource: RawResource | null | undefined): PatientSummary | null {
  if (!resource) return null;
  const patient = resource as unknown as Patient;
  const name: HumanName = patient.name?.[0] ?? {};
  const given = name.given?.join(' ') ?? '';
  const family = name.family ?? '';

  const mrnIdentifier: Identifier | undefined = patient.identifier?.find((id) => id.type?.coding?.[0]?.code === 'MR');
  const mrn = mrnIdentifier?.value ?? patient.id ?? '';

  const phone = patient.telecom?.find((t) => t.system === 'phone')?.value;
  const addr = patient.address?.[0];
  const address = addr
    ? [addr.line?.join(', '), addr.city, addr.state, addr.postalCode].filter(Boolean).join(', ')
    : undefined;

  const raceExt: Extension | undefined = patient.extension?.find((e) => e.url?.includes('us-core-race'));
  const race = raceExt?.extension?.find((e) => e.url === 'text')?.valueString;

  const ethnicityExt: Extension | undefined = patient.extension?.find((e) => e.url?.includes('us-core-ethnicity'));
  const ethnicity = ethnicityExt?.extension?.find((e) => e.url === 'text')?.valueString;

  return {
    id: patient.id ?? '',
    fullName: `${given} ${family}`.trim() || 'Unknown',
    firstName: given,
    lastName: family,
    gender: patient.gender ?? 'unknown',
    birthDate: patient.birthDate ?? '',
    age: patient.birthDate ? calcAge(patient.birthDate) : 0,
    mrn,
    phone,
    address,
    language: patient.communication?.[0]?.language?.text ?? patient.communication?.[0]?.language?.coding?.[0]?.display,
    maritalStatus: patient.maritalStatus?.text ?? patient.maritalStatus?.coding?.[0]?.display,
    race,
    ethnicity,
  };
}

export function mapEncounter(resource: RawResource | null | undefined): EncounterSummary | null {
  if (!resource) return null;
  const encounter = resource as unknown as Encounter;

  // Encounter.appointment is `Reference[]` per FHIR R4. Cerner populates a
  // single entry whose `reference` is `Appointment/<id>` — strip to the id
  // so the FE doesn't need to know about FHIR reference syntax.
  const appointmentRef = encounter.appointment?.[0]?.reference;
  const appointmentId = appointmentRef?.startsWith('Appointment/')
    ? appointmentRef.slice('Appointment/'.length)
    : appointmentRef;

  return {
    id: encounter.id ?? '',
    status: encounter.status ?? 'unknown',
    type: encounter.type?.[0]?.text ?? encounter.type?.[0]?.coding?.[0]?.display ?? 'Visit',
    reasonForVisit: encounter.reasonCode?.[0]?.text ?? encounter.reasonCode?.[0]?.coding?.[0]?.display ?? '',
    startDate: encounter.period?.start,
    endDate: encounter.period?.end,
    department:
      encounter.location?.[0]?.location?.display ??
      encounter.serviceType?.text ??
      encounter.serviceType?.coding?.[0]?.display,
    provider: encounter.participant?.[0]?.individual?.display,
    appointmentId,
  };
}

export function mapAppointment(resource: RawResource | null | undefined): AppointmentSummary | null {
  if (!resource) return null;
  const appointment = resource as unknown as Appointment;
  const participants: AppointmentParticipant[] = appointment.participant ?? [];

  return {
    id: appointment.id ?? '',
    status: appointment.status ?? 'unknown',
    type:
      appointment.appointmentType?.text ??
      appointment.appointmentType?.coding?.[0]?.display ??
      appointment.serviceType?.[0]?.text ??
      appointment.serviceType?.[0]?.coding?.[0]?.display ??
      'Appointment',
    startDate: appointment.start,
    endDate: appointment.end,
    provider: participants.find((p) => p.actor?.reference?.startsWith('Practitioner'))?.actor?.display,
    location: participants.find((p) => p.actor?.reference?.startsWith('Location'))?.actor?.display,
    reasonForVisit: appointment.reasonCode?.[0]?.text ?? appointment.reasonCode?.[0]?.coding?.[0]?.display ?? '',
  };
}

export function mapPractitioner(resource: RawResource | null | undefined): PractitionerSummary | null {
  if (!resource) return null;
  const practitioner = resource as unknown as Practitioner;
  const officialName: HumanName | undefined =
    practitioner.name?.find((n) => n.use === 'official') ?? practitioner.name?.[0];
  const given = officialName?.given?.join(' ') ?? '';
  const family = officialName?.family ?? '';
  const prefix = officialName?.prefix?.join(' ') ?? '';
  const suffix = officialName?.suffix?.join(' ') ?? '';
  const fullName = [prefix, given, family, suffix].filter(Boolean).join(' ').trim();

  const npiId: Identifier | undefined = practitioner.identifier?.find(
    (id) => id.system === 'http://hl7.org/fhir/sid/us-npi' || id.type?.coding?.some((c) => c.code === 'NPI') === true,
  );

  const qual = practitioner.qualification?.find((q) => (q.code?.coding?.length ?? 0) > 0);
  const specialtyExt: Extension | undefined = practitioner.extension?.find(
    (e) => e.url?.includes('specialty') || e.url?.includes('practitioner-specialty'),
  );

  return {
    id: practitioner.id ?? '',
    fullName: fullName || 'Unknown',
    npi: npiId?.value,
    specialty:
      specialtyExt?.valueCodeableConcept?.text ??
      specialtyExt?.valueCodeableConcept?.coding?.[0]?.display ??
      qual?.code?.text,
    qualification: qual?.code?.coding?.[0]?.display,
    qualifications: practitioner.qualification,
    email: practitioner.telecom?.find((t) => t.system === 'email')?.value,
    phone: practitioner.telecom?.find((t) => t.system === 'phone')?.value,
  };
}

export function mapCondition(resource: RawResource | null | undefined): ConditionSummary {
  const condition = (resource ?? {}) as unknown as Condition;
  // Prefer a SNOMED or ICD-10 coding as the primary one — the update flow
  // writes back via the same coding, and bridge's validator only accepts
  // those systems. Fall back to the first coding if neither is present.
  const allCodings = condition.code?.coding ?? [];
  const coding = pickPrimaryConditionCoding(allCodings) ?? {};
  const codings: ConditionCoding[] = allCodings
    .filter((c) => c.system && c.code)
    .map((c) => ({ system: c.system!, code: c.code!, display: c.display }));

  const clinicalStatus = condition.clinicalStatus?.coding?.[0]?.code ?? 'active';
  const verificationStatus = condition.verificationStatus?.coding?.[0]?.code ?? 'confirmed';
  const severity = condition.severity?.text ?? condition.severity?.coding?.[0]?.display;

  return {
    id: condition.id ?? '',
    name: condition.code?.text ?? coding.display ?? 'Unknown Condition',
    icdCode: coding.code ?? '',
    codeSystem: coding.system ?? '',
    codings,
    clinicalStatus,
    verificationStatus,
    stateValue: deriveConditionState(clinicalStatus, verificationStatus),
    severity,
    severityLevel: normalizeSeverity(severity),
    onsetDate: condition.onsetDateTime?.slice(0, 10) ?? condition.onsetPeriod?.start?.slice(0, 10),
    category: condition.category?.[0]?.coding?.[0]?.code ?? 'encounter-diagnosis',
    recordedDate: condition.recordedDate?.slice(0, 10),
    lastUpdated: extractLastUpdated(condition),
    notes: extractNotes(condition),
  };
}

/**
 * Pure inverse of `CONDITION_STATE_FHIR` (in clinical-write/constants/
 * condition-state.model). `entered-in-error` wins regardless of clinicalStatus
 * because con-5 means clinicalStatus may legitimately be absent for that state.
 * Otherwise we match the (clinical, verification) pair exactly; unmatched pairs
 * default to `active-confirmed` (same fallback the FE picker used).
 */
const CONDITION_STATE_INVERSE: ReadonlyArray<{
  clinical: string;
  verification: string;
  state: ConditionStateValue;
}> = [
  { clinical: 'active', verification: 'confirmed', state: 'active-confirmed' },
  { clinical: 'active', verification: 'provisional', state: 'active-provisional' },
  { clinical: 'recurrence', verification: 'confirmed', state: 'recurrence' },
  { clinical: 'remission', verification: 'confirmed', state: 'remission' },
  { clinical: 'resolved', verification: 'confirmed', state: 'resolved' },
  { clinical: 'inactive', verification: 'confirmed', state: 'inactive' },
  { clinical: 'inactive', verification: 'refuted', state: 'refuted' },
];

function deriveConditionState(clinical: string, verification: string): ConditionStateValue {
  if (verification === 'entered-in-error') return 'entered-in-error';
  const match = CONDITION_STATE_INVERSE.find((e) => e.clinical === clinical && e.verification === verification);
  return match?.state ?? 'active-confirmed';
}

function normalizeSeverity(display: string | undefined): SeverityLevel | null {
  if (!display) return null;
  const normalized = display.trim().toLowerCase();
  if (normalized === 'mild' || normalized === 'moderate' || normalized === 'severe') return normalized;
  return null;
}

/**
 * Return the coding entry that should drive the Condition's primary
 * display and write-back. Preference order:
 *   1. SNOMED CT
 *   2. ICD-10 / ICD-10-CM
 *   3. First coding in the list (whatever it is)
 * Ensures update flows always get a writeable system URI instead of
 * falling back to a vendor-specific or non-standard coding.
 */
function pickPrimaryConditionCoding(codings: Coding[] | undefined): Coding | undefined {
  if (!codings || codings.length === 0) return undefined;
  const snomed = codings.find((c) => c.system?.includes('snomed'));
  if (snomed) return snomed;
  const icd = codings.find((c) => c.system?.includes('icd-10'));
  if (icd) return icd;
  return codings[0];
}

export function mapAllergy(resource: RawResource | null | undefined): AllergySummary {
  const allergy = (resource ?? {}) as unknown as AllergyIntolerance;
  const reactions = (allergy.reaction ?? []).map((r: AllergyIntoleranceReaction) => ({
    manifestation: r.manifestation?.[0]?.text ?? r.manifestation?.[0]?.coding?.[0]?.display ?? 'Unknown',
    severity: r.severity ?? 'unknown',
  }));

  return {
    id: allergy.id ?? '',
    substance: allergy.code?.text ?? allergy.code?.coding?.[0]?.display ?? 'Unknown Allergen',
    code: allergy.code?.coding?.[0]?.code,
    clinicalStatus: allergy.clinicalStatus?.coding?.[0]?.code ?? allergy.clinicalStatus?.text ?? 'active',
    criticality: allergy.criticality ?? 'unknown',
    type: allergy.type ?? 'allergy',
    reactions,
    onsetDate: allergy.onsetDateTime?.slice(0, 10),
    recordedDate: allergy.recordedDate?.slice(0, 10),
    lastUpdated: extractLastUpdated(allergy),
    notes: extractNotes(allergy),
  };
}

/**
 * Maps both MedicationStatement and MedicationRequest to a unified MedicationSummary.
 * MedicationRequest uses dosageInstruction instead of dosage, and authoredOn instead of effectivePeriod.
 *
 * The two FHIR resource types have conflicting `resourceType` literals so an
 * intersection is `never`; we instead model the merged shape as a union of
 * Partial views over both, which keeps every field optional and lets us pick
 * whichever the EHR populated.
 */
type MedicationLike = Partial<MedicationStatement> & Partial<MedicationRequest>;

export function mapMedication(resource: RawResource | null | undefined): MedicationSummary {
  const med = (resource ?? {}) as unknown as MedicationLike;
  const dosage: Dosage = med.dosageInstruction?.[0] ?? med.dosage?.[0] ?? {};
  const dose = dosage.doseAndRate?.[0]?.doseQuantity;
  const repeat = dosage.timing?.repeat;

  return {
    id: med.id ?? '',
    name:
      med.medicationCodeableConcept?.text ??
      med.medicationCodeableConcept?.coding?.[0]?.display ??
      med.medicationReference?.display ??
      'Unknown Medication',
    code: med.medicationCodeableConcept?.coding?.[0]?.code,
    status: med.status ?? 'active',
    dosage:
      dosage.text ??
      [
        dose?.value,
        dose?.unit,
        dosage.timing?.code?.text ??
          (repeat?.frequency ? `${repeat.frequency}x/${repeat.period} ${repeat.periodUnit}` : ''),
      ]
        .filter(Boolean)
        .join(' ') ??
      '',
    route: dosage.route?.text ?? dosage.route?.coding?.[0]?.display,
    frequency: dosage.timing?.code?.text ?? dosage.timing?.code?.coding?.[0]?.display,
    startDate:
      med.authoredOn?.slice(0, 10) ?? med.effectivePeriod?.start?.slice(0, 10) ?? med.effectiveDateTime?.slice(0, 10),
    recordedDate: med.dateAsserted?.slice(0, 10) ?? med.authoredOn?.slice(0, 10),
    lastUpdated: extractLastUpdated(med),
    notes: extractNotes(med),
  };
}

export function mapVital(resource: RawResource | null | undefined): VitalSummary {
  const observation = (resource ?? {}) as unknown as Observation;
  const coding: Coding = observation.code?.coding?.[0] ?? {};
  const interp: Coding | undefined = observation.interpretation?.[0]?.coding?.[0];

  // Handle component-based vitals (e.g., Blood Pressure has systolic/diastolic)
  let value = '';
  let unit = '';
  let numericValue: number | undefined;

  if (observation.component?.length) {
    const components: ObservationComponent[] = observation.component;
    const parts = components.map((c) => `${c.valueQuantity?.value ?? ''}`);
    value = parts.join('/');
    unit = components[0]?.valueQuantity?.unit ?? 'mmHg';
    numericValue = components[0]?.valueQuantity?.value;
  } else if (observation.valueQuantity) {
    value = String(observation.valueQuantity.value ?? '');
    unit = observation.valueQuantity.unit ?? '';
    numericValue = observation.valueQuantity.value;
  } else if (observation.valueString) {
    value = observation.valueString;
  }

  const isAbnormal =
    interp?.code === 'H' ||
    interp?.code === 'HH' ||
    interp?.code === 'L' ||
    interp?.code === 'LL' ||
    interp?.code === 'A';

  return {
    id: observation.id ?? '',
    name: observation.code?.text ?? coding.display ?? 'Vital Sign',
    code: coding.code ?? '',
    value,
    unit,
    numericValue,
    interpretation: interp?.display ?? interp?.code,
    isAbnormal,
    date: observation.effectiveDateTime?.slice(0, 10) ?? '',
    issuedDate: observation.issued?.slice(0, 10),
    lastUpdated: extractLastUpdated(observation),
    notes: extractNotes(observation),
  };
}

// ── Bundle Extractor ─────────────────────────────────────────

function extractResources(bundle: Bundle | RawResource | null | undefined): RawResource[] {
  const entry: BundleEntry[] | undefined = (bundle as Bundle | undefined)?.entry;
  if (!Array.isArray(entry)) return [];
  return entry.map((e) => e?.resource).filter((r): r is RawResource & Resource => Boolean(r)) as RawResource[];
}

// ── Active Status Filters ────────────────────────────────────
// FHIR resources use different fields/values to indicate active status.
// Only return clinically active items — inactive/resolved/entered-in-error are excluded.

export function isActiveCondition(resource: RawResource): boolean {
  const r = resource as unknown as Condition;
  const status = r.clinicalStatus?.coding?.[0]?.code;
  return !status || status === 'active' || status === 'recurrence' || status === 'relapse';
}

export function isActiveAllergy(resource: RawResource): boolean {
  const r = resource as unknown as AllergyIntolerance;
  const clinical = r.clinicalStatus?.coding?.[0]?.code;
  const verification = r.verificationStatus?.coding?.[0]?.code;
  if (verification === 'entered-in-error') return false;
  return !clinical || clinical === 'active';
}

export function isActiveMedication(resource: RawResource): boolean {
  const r = resource as unknown as MedicationLike;
  const status = r.status as string | undefined;
  return !status || status === 'active' || status === 'intended' || status === 'unknown';
}

export function isActiveObservation(resource: RawResource): boolean {
  const r = resource as unknown as Observation;
  const status = r.status;
  return !status || status === 'final' || status === 'amended' || status === 'corrected' || status === 'preliminary';
}

/**
 * Transform raw FHIR data into mapped clinical data.
 * Filters to active-only resources and reduces payload by ~90%.
 */
export function mapClinicalData(raw: {
  patientBundle: Bundle | RawResource | null | undefined;
  encounter: RawResource | null | undefined;
  conditionBundle: Bundle | RawResource | null | undefined;
  allergyBundle: Bundle | RawResource | null | undefined;
  medBundle: Bundle | RawResource | null | undefined;
  vitalBundle: Bundle | RawResource | null | undefined;
}): ClinicalDataMapped {
  const patients = extractResources(raw.patientBundle);
  const conditions = extractResources(raw.conditionBundle).filter(isActiveCondition);
  const allergies = extractResources(raw.allergyBundle).filter(isActiveAllergy);
  const medications = extractResources(raw.medBundle).filter(isActiveMedication);
  const vitals = extractResources(raw.vitalBundle).filter(isActiveObservation);

  return {
    patient: patients.length > 0 ? mapPatient(patients[0]) : null,
    encounter: raw.encounter ? mapEncounter(raw.encounter) : null,
    conditions: conditions.map(mapCondition),
    allergies: allergies.map(mapAllergy),
    medications: medications.map(mapMedication),
    vitals: vitals.map(mapVital),
  };
}

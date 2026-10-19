/**
 * Tool input shapes for Cerner `@mcptool` methods. These exist ONLY to
 * drive schema generation (`scripts/gen-tools.ts` → JSON Schema → Ajv) —
 * each property's JSDoc becomes the LLM-facing field description. Property
 * names MUST match the corresponding service method's post-`config`
 * parameter names; the codegen asserts this and hard-fails on mismatch.
 *
 * The service method signatures are NOT changed — these interfaces are the
 * schema source, not the runtime parameter types.
 *
 * **Cerner is a FHIR R4 EHR**, so write bodies are raw FHIR resources and
 * search params are FHIR search parameters. The tool layer is dumb (no
 * mapping); the MCP client constructs the FHIR payload. `search*` and
 * `create*` interfaces document the common fields + carry an index
 * signature so any additional FHIR field/parameter passes through.
 */

// ── Patient ──────────────────────────────────────────────────────────────────

/** Inputs for `cerner_getPatient`. */
export interface GetPatientParams {
  /** Cerner Patient resource ID — opaque string, e.g. from a prior search. */
  id: string;
}

/**
 * Inputs for `cerner_searchPatients`. Passed through to Cerner's FHIR R4
 * `GET /Patient` as query parameters. Standard FHIR search parameters are
 * documented below; any additional Cerner-supported parameter may also be
 * supplied (string-valued).
 */
export interface SearchPatientsParams {
  /** Logical id of the Patient resource (`_id`). */
  _id?: string;
  /** Family (last) name. */
  family?: string;
  /** Given (first) name. */
  given?: string;
  /** Any part of the name. */
  name?: string;
  /** Birth date, ISO 8601 (`YYYY-MM-DD`). */
  birthdate?: string;
  /** Administrative gender: `male` | `female` | `other` | `unknown`. */
  gender?: string;
  /** Patient identifier, `system|value` (e.g. an MRN). */
  identifier?: string;
  /** Max results to return (`_count`). */
  _count?: string;
  /** Additional Cerner-supported FHIR search parameter. */
  [param: string]: string | undefined;
}

/**
 * Inputs for `cerner_createPatient`. The full FHIR R4 Patient resource to
 * POST. Key fields documented below; any other FHIR Patient field passes
 * through.
 */
export interface CreatePatientParams {
  /** Must be `"Patient"`. */
  resourceType: 'Patient';
  /** HumanName[] — family/given/use. */
  name?: unknown;
  /** Identifier[] — MRN and other identifiers (system|value). */
  identifier?: unknown;
  /** `male` | `female` | `other` | `unknown`. */
  gender?: string;
  /** Birth date, ISO 8601 (`YYYY-MM-DD`). */
  birthDate?: string;
  /** ContactPoint[] — phone/email. */
  telecom?: unknown;
  /** Address[]. */
  address?: unknown;
  /** Any other FHIR Patient field. */
  [field: string]: unknown;
}

// ── Appointment ────────────────────────────────────────────────────────────

/** Inputs for `cerner_getAppointment`. */
export interface GetAppointmentParams {
  /** Cerner Appointment resource ID. */
  id: string;
}

/**
 * Inputs for `cerner_searchAppointments`. Passed through to Cerner's FHIR R4
 * `GET /Appointment` as query parameters.
 */
export interface SearchAppointmentsParams {
  /** Patient resource ID whose appointments to return. */
  patient?: string;
  /** Practitioner resource ID. */
  practitioner?: string;
  /** Location resource ID. */
  location?: string;
  /** Appointment date / range, FHIR date param (e.g. `ge2026-01-01`). */
  date?: string;
  /** Status, e.g. `booked` | `arrived` | `fulfilled` | `cancelled`. */
  status?: string;
  /** Max results to return (`_count`). */
  _count?: string;
  /** Additional Cerner-supported FHIR search parameter. */
  [param: string]: string | undefined;
}

// ── Encounter ────────────────────────────────────────────────────────────────

/** Inputs for `cerner_getEncounter`. */
export interface GetEncounterParams {
  /** Cerner Encounter resource ID. */
  id: string;
}

/**
 * Inputs for `cerner_searchEncounters`. Passed through to Cerner's FHIR R4
 * `GET /Encounter` as query parameters.
 */
export interface SearchEncountersParams {
  /** Patient resource ID whose encounters to return. */
  patient?: string;
  /** Encounter date / range, FHIR date param. */
  date?: string;
  /** Status, e.g. `planned` | `arrived` | `in-progress` | `finished`. */
  status?: string;
  /** Encounter class (e.g. `AMB`, `IMP`, `EMER`). */
  class?: string;
  /** Max results to return (`_count`). */
  _count?: string;
  /** Additional Cerner-supported FHIR search parameter. */
  [param: string]: string | undefined;
}

// ── Coverage ─────────────────────────────────────────────────────────────────

/** Inputs for `cerner_getCoverage`. */
export interface GetCoverageParams {
  /** Cerner Coverage resource ID. */
  id: string;
}

/**
 * Inputs for `cerner_searchCoverages`. Passed through to Cerner's FHIR R4
 * `GET /Coverage` as query parameters.
 */
export interface SearchCoveragesParams {
  /** Patient resource ID (the covered party). */
  patient?: string;
  /** Beneficiary resource ID. */
  beneficiary?: string;
  /** Payor organization resource ID. */
  payor?: string;
  /** Status, e.g. `active` | `cancelled` | `draft`. */
  status?: string;
  /** Max results to return (`_count`). */
  _count?: string;
  /** Additional Cerner-supported FHIR search parameter. */
  [param: string]: string | undefined;
}

/**
 * Inputs for `cerner_createCoverage`. The full FHIR R4 Coverage resource to
 * POST.
 */
export interface CreateCoverageParams {
  /** Must be `"Coverage"`. */
  resourceType: 'Coverage';
  /** `active` | `cancelled` | `draft` | `entered-in-error`. */
  status?: string;
  /** Reference to the covered Patient (`{ reference: "Patient/<id>" }`). */
  beneficiary?: unknown;
  /** Reference[] to the payor organization(s). */
  payor?: unknown;
  /** Subscriber's member ID. */
  subscriberId?: string;
  /** Coverage type CodeableConcept. */
  type?: unknown;
  /** Any other FHIR Coverage field. */
  [field: string]: unknown;
}

// ── Condition ────────────────────────────────────────────────────────────────

/** Inputs for `cerner_getCondition`. */
export interface GetConditionParams {
  /** Cerner Condition resource ID. */
  id: string;
}

/**
 * Inputs for `cerner_searchConditions`. Passed through to Cerner's FHIR R4
 * `GET /Condition` as query parameters. `patient` is effectively required
 * by Cerner for Condition search.
 */
export interface SearchConditionsParams {
  /** Patient resource ID whose Conditions to return (Cerner requires this). */
  patient?: string;
  /** Encounter resource ID to scope the search. */
  encounter?: string;
  /** Condition category, e.g. `problem-list-item` or `encounter-diagnosis`. */
  category?: string;
  /** Clinical status, e.g. `active` | `inactive` | `resolved`. */
  'clinical-status'?: string;
  /** Max results to return (`_count`). */
  _count?: string;
  /** Additional Cerner-supported FHIR search parameter. */
  [param: string]: string | undefined;
}

/**
 * Inputs for `cerner_createCondition`. The full FHIR R4 Condition resource
 * to POST. Cerner constraints (enforce client-side): clinicalStatus must be
 * one of active/recurrence/relapse/inactive/remission/resolved;
 * `verificationStatus` of `refuted`/`entered-in-error` is NOT reachable on
 * create (record active, then flip via update). For `encounter-diagnosis`
 * category, clinicalStatus must be active and `abatement*`/`severity` are
 * rejected. `note[]` IS accepted on create (but is immutable afterwards).
 */
export interface CreateConditionParams {
  /** Must be `"Condition"`. */
  resourceType: 'Condition';
  /** clinicalStatus CodeableConcept (system http://terminology.hl7.org/CodeSystem/condition-clinical). */
  clinicalStatus?: unknown;
  /** verificationStatus CodeableConcept (confirmed/provisional/…). */
  verificationStatus?: unknown;
  /** category[] CodeableConcept — problem-list-item | encounter-diagnosis. */
  category?: unknown;
  /** code CodeableConcept — the diagnosis/problem (ICD-10 / SNOMED). */
  code?: unknown;
  /** subject Reference — `{ reference: "Patient/<id>" }`. */
  subject?: unknown;
  /** onsetDateTime, ISO 8601. */
  onsetDateTime?: string;
  /** note[] Annotation — clinical note. Accepted on create; immutable on update. */
  note?: unknown;
  /** Any other FHIR Condition field. */
  [field: string]: unknown;
}

/**
 * Inputs for `cerner_updateCondition` (FHIR R4 PUT `/Condition/{id}`).
 *
 * Cerner requires `If-Match: W/"<versionId>"` (pass via `options.ifMatch`)
 * for optimistic concurrency — fetch the Condition first (`cerner_getCondition`)
 * and read `meta.versionId`. `code`, `category`, and `note` are IMMUTABLE on
 * update — Cerner returns 200 but silently discards changes to them; send the
 * existing values verbatim. To change a Condition's lifecycle, set
 * `clinicalStatus`/`verificationStatus` (this is how you reach `refuted` /
 * `entered-in-error`, which create cannot set).
 */
export interface UpdateConditionParams {
  /** Cerner Condition resource ID to update. */
  id: string;
  /** The full FHIR R4 Condition body to PUT (typically the fetched resource with edits applied). */
  data: unknown;
  /** Write options. */
  options?: {
    /** Concurrency token — `W/"<versionId>"` from the resource's `meta.versionId`. Required by Cerner. */
    ifMatch?: string;
  };
}

// ── AllergyIntolerance ───────────────────────────────────────────────────────

/** Inputs for `cerner_getAllergy`. */
export interface GetAllergyParams {
  /** Cerner AllergyIntolerance resource ID. */
  id: string;
}

/**
 * Inputs for `cerner_searchAllergies`. Passed through to Cerner's FHIR R4
 * `GET /AllergyIntolerance` as query parameters.
 */
export interface SearchAllergiesParams {
  /** Patient resource ID whose allergies to return. */
  patient?: string;
  /** Clinical status, e.g. `active` | `inactive` | `resolved`. */
  'clinical-status'?: string;
  /** Verification status, e.g. `confirmed` | `unconfirmed`. */
  'verification-status'?: string;
  /** Max results to return (`_count`). */
  _count?: string;
  /** Additional Cerner-supported FHIR search parameter. */
  [param: string]: string | undefined;
}

/**
 * Inputs for `cerner_createAllergy`. The full FHIR R4 AllergyIntolerance
 * resource to POST.
 */
export interface CreateAllergyParams {
  /** Must be `"AllergyIntolerance"`. */
  resourceType: 'AllergyIntolerance';
  /** clinicalStatus CodeableConcept (active/inactive/resolved). */
  clinicalStatus?: unknown;
  /** verificationStatus CodeableConcept (confirmed/unconfirmed/…). */
  verificationStatus?: unknown;
  /** code CodeableConcept — the allergen/substance. */
  code?: unknown;
  /** patient Reference — `{ reference: "Patient/<id>" }`. */
  patient?: unknown;
  /** `low` | `high` | `unable-to-assess`. */
  criticality?: string;
  /** reaction[] — manifestation + severity. */
  reaction?: unknown;
  /** Any other FHIR AllergyIntolerance field. */
  [field: string]: unknown;
}

// ── MedicationRequest ────────────────────────────────────────────────────────

/** Inputs for `cerner_getMedicationRequest`. */
export interface GetMedicationRequestParams {
  /** Cerner MedicationRequest resource ID. */
  id: string;
}

/**
 * Inputs for `cerner_searchMedicationRequests`. Passed through to Cerner's
 * FHIR R4 `GET /MedicationRequest` as query parameters. Cerner Millennium
 * exposes active medications via MedicationRequest (NOT MedicationStatement).
 */
export interface SearchMedicationRequestsParams {
  /** Patient resource ID whose medication requests to return. */
  patient?: string;
  /** Status, e.g. `active` | `completed` | `stopped` | `on-hold`. */
  status?: string;
  /** Intent, e.g. `order` | `plan`. */
  intent?: string;
  /** Encounter resource ID to scope the search. */
  encounter?: string;
  /** Max results to return (`_count`). */
  _count?: string;
  /** Additional Cerner-supported FHIR search parameter. */
  [param: string]: string | undefined;
}

// ── MedicationStatement ──────────────────────────────────────────────────────

/** Inputs for `cerner_getMedicationStatement`. */
export interface GetMedicationStatementParams {
  /** Cerner MedicationStatement resource ID. */
  id: string;
}

/**
 * Inputs for `cerner_searchMedicationStatements`. Passed through to Cerner's
 * FHIR R4 `GET /MedicationStatement`. NOTE: Cerner Millennium does not
 * generally support MedicationStatement — prefer `cerner_searchMedicationRequests`
 * for a patient's medications. Exposed for completeness / non-Millennium tenants.
 */
export interface SearchMedicationStatementsParams {
  /** Patient resource ID. */
  patient?: string;
  /** Status, e.g. `active` | `completed` | `intended`. */
  status?: string;
  /** Max results to return (`_count`). */
  _count?: string;
  /** Additional Cerner-supported FHIR search parameter. */
  [param: string]: string | undefined;
}

// ── Observation ──────────────────────────────────────────────────────────────

/** Inputs for `cerner_getObservation`. */
export interface GetObservationParams {
  /** Cerner Observation resource ID. */
  id: string;
}

/**
 * Inputs for `cerner_searchObservations`. Passed through to Cerner's FHIR R4
 * `GET /Observation` as query parameters. `category` (e.g. `vital-signs`,
 * `laboratory`) is commonly required by Cerner alongside `patient`.
 */
export interface SearchObservationsParams {
  /** Patient resource ID whose observations to return. */
  patient?: string;
  /** Category, e.g. `vital-signs` | `laboratory` | `social-history`. */
  category?: string;
  /** Observation code (LOINC), `system|code` or bare code. */
  code?: string;
  /** Observation date / range, FHIR date param. */
  date?: string;
  /** Status, e.g. `final` | `preliminary` | `amended`. */
  status?: string;
  /** Max results to return (`_count`). */
  _count?: string;
  /** Additional Cerner-supported FHIR search parameter. */
  [param: string]: string | undefined;
}

/**
 * Inputs for `cerner_createObservation`. The full FHIR R4 Observation
 * resource to POST.
 */
export interface CreateObservationParams {
  /** Must be `"Observation"`. */
  resourceType: 'Observation';
  /** `registered` | `preliminary` | `final` | `amended`. */
  status?: string;
  /** category[] CodeableConcept — vital-signs | laboratory | … */
  category?: unknown;
  /** code CodeableConcept — what was measured (LOINC). */
  code?: unknown;
  /** subject Reference — `{ reference: "Patient/<id>" }`. */
  subject?: unknown;
  /** effectiveDateTime, ISO 8601. */
  effectiveDateTime?: string;
  /** valueQuantity (or other value[x]) — the measurement. */
  valueQuantity?: unknown;
  /** Any other FHIR Observation field (e.g. valueCodeableConcept, component). */
  [field: string]: unknown;
}

// ── DocumentReference ────────────────────────────────────────────────────────

/** Inputs for `cerner_getDocumentReference`. */
export interface GetDocumentReferenceParams {
  /** Cerner DocumentReference resource ID. */
  id: string;
}

/**
 * Inputs for `cerner_searchDocumentReferences`. Passed through to Cerner's
 * FHIR R4 `GET /DocumentReference` as query parameters.
 */
export interface SearchDocumentReferencesParams {
  /** Patient resource ID whose documents to return. */
  patient?: string;
  /** Document type CodeableConcept code (LOINC). */
  type?: string;
  /** Document category. */
  category?: string;
  /** Document date / range, FHIR date param. */
  date?: string;
  /** Status, e.g. `current` | `superseded`. */
  status?: string;
  /** Max results to return (`_count`). */
  _count?: string;
  /** Additional Cerner-supported FHIR search parameter. */
  [param: string]: string | undefined;
}

/**
 * Inputs for `cerner_createDocumentReference`. The full FHIR R4
 * DocumentReference resource to POST (e.g. a clinical note attachment).
 */
export interface CreateDocumentReferenceParams {
  /** Must be `"DocumentReference"`. */
  resourceType: 'DocumentReference';
  /** `current` | `superseded` | `entered-in-error`. */
  status?: string;
  /** type CodeableConcept (LOINC document type). */
  type?: unknown;
  /** category[] CodeableConcept. */
  category?: unknown;
  /** subject Reference — `{ reference: "Patient/<id>" }`. */
  subject?: unknown;
  /** content[] — attachment(s): `{ attachment: { contentType, data|url } }`. */
  content?: unknown;
  /** Any other FHIR DocumentReference field. */
  [field: string]: unknown;
}

// ── Practitioner ─────────────────────────────────────────────────────────────

/** Inputs for `cerner_getPractitioner`. */
export interface GetPractitionerParams {
  /** Cerner Practitioner resource ID. */
  id: string;
}

/**
 * Inputs for `cerner_searchPractitioners`. Passed through to Cerner's FHIR R4
 * `GET /Practitioner` as query parameters. Not patient-scoped.
 */
export interface SearchPractitionersParams {
  /** Logical id of the Practitioner resource (`_id`). */
  _id?: string;
  /** Practitioner identifier (e.g. NPI), `system|value`. */
  identifier?: string;
  /** Any part of the name. */
  name?: string;
  /** Family (last) name. */
  family?: string;
  /** Given (first) name. */
  given?: string;
  /** Max results to return (`_count`). */
  _count?: string;
  /** Additional Cerner-supported FHIR search parameter. */
  [param: string]: string | undefined;
}

// ── Communication ────────────────────────────────────────────────────────────

/** Inputs for `cerner_getCommunication`. */
export interface GetCommunicationParams {
  /** Cerner Communication resource ID. */
  id: string;
}

/**
 * Inputs for `cerner_searchCommunications`. Passed through to Cerner's FHIR R4
 * `GET /Communication` as query parameters.
 */
export interface SearchCommunicationsParams {
  /** Patient resource ID (the subject). */
  patient?: string;
  /** Status, e.g. `completed` | `in-progress`. */
  status?: string;
  /** Category. */
  category?: string;
  /** Encounter resource ID to scope the search. */
  encounter?: string;
  /** Max results to return (`_count`). */
  _count?: string;
  /** Additional Cerner-supported FHIR search parameter. */
  [param: string]: string | undefined;
}

/**
 * Inputs for `cerner_createCommunication`. The full FHIR R4 Communication
 * resource to POST.
 */
export interface CreateCommunicationParams {
  /** Must be `"Communication"`. */
  resourceType: 'Communication';
  /** `completed` | `in-progress` | `preparation`. */
  status?: string;
  /** category[] CodeableConcept. */
  category?: unknown;
  /** subject Reference — `{ reference: "Patient/<id>" }`. */
  subject?: unknown;
  /** payload[] — the message content. */
  payload?: unknown;
  /** sender Reference. */
  sender?: unknown;
  /** recipient[] Reference. */
  recipient?: unknown;
  /** Any other FHIR Communication field. */
  [field: string]: unknown;
}

// ── ServiceRequest ───────────────────────────────────────────────────────────

/** Inputs for `cerner_getServiceRequest`. */
export interface GetServiceRequestParams {
  /** Cerner ServiceRequest resource ID. */
  id: string;
}

/**
 * Inputs for `cerner_searchServiceRequests`. Passed through to Cerner's FHIR
 * R4 `GET /ServiceRequest` as query parameters.
 */
export interface SearchServiceRequestsParams {
  /** Patient resource ID whose service requests to return. */
  patient?: string;
  /** Status, e.g. `active` | `completed` | `revoked`. */
  status?: string;
  /** Category. */
  category?: string;
  /** Order code (LOINC/SNOMED), `system|code` or bare code. */
  code?: string;
  /** Encounter resource ID to scope the search. */
  encounter?: string;
  /** Max results to return (`_count`). */
  _count?: string;
  /** Additional Cerner-supported FHIR search parameter. */
  [param: string]: string | undefined;
}

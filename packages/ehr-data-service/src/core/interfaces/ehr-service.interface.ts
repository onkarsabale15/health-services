import type {
  Bundle,
  Patient,
  Encounter,
  Appointment,
  Coverage,
  Condition,
  Practitioner,
  AllergyIntolerance,
  ServiceRequest,
  MedicationStatement,
  Communication,
  Observation,
  DocumentReference,
  Location,
  Task,
} from '@medplum/fhirtypes';
import type { EhrClientConfig } from './ehr-client-config.interface';

/** Standard response envelope returned by all EHR vendor service methods. */
export interface EhrResponse<T = any> {
  statusCode: number;
  data: T;
  headers?: Record<string, string>;
}

export interface TokenResult {
  accessToken: string;
  expiresIn: number;
  refreshToken?: string;
  [key: string]: unknown;
}

/**
 * JSON Web Key (JWK) structure as per RFC 7517.
 * Supports both Public and Private keys for RSA and EC.
 */
export interface JwkKey {
  kty: 'RSA' | 'EC' | 'oct';
  use?: 'sig' | 'enc';
  key_ops?: string[];
  alg?: string;
  kid?: string;
  x5u?: string;
  x5c?: string[];
  x5t?: string;
  'x5t#S256'?: string;

  // RSA Public
  n?: string;
  e?: string;

  // RSA Private
  d?: string;
  p?: string;
  q?: string;
  dp?: string;
  dq?: string;
  qi?: string;

  // EC Public
  crv?: string;
  x?: string;
  y?: string;

  [key: string]: unknown;
}

/**
 * Public JWK — used for verifying signatures or encrypting data.
 * Should NOT contain private parameters (d, p, q, etc.).
 */
export type PublicJwk = Omit<JwkKey, 'd' | 'p' | 'q' | 'dp' | 'dq' | 'qi'>;

/**
 * Private JWK — used for signing or decrypting data.
 * Contains private parameters.
 */
export type PrivateJwk = JwkKey;

export interface JwkSet {
  keys: JwkKey[];
}

/** Specifically a set of public keys, often served at a /.well-known/jwks.json endpoint */
export interface PublicJwkSet {
  keys: PublicJwk[];
}

/** Specifically a set of private keys, used internally for signing JWT assertions */
export interface PrivateJwkSet {
  keys: PrivateJwk[];
}

export interface IEhrService {
  readonly ehrName: string;

  // Auth
  getToken(payload: unknown, secrets?: unknown): Promise<TokenResult>;

  // Patient
  getAllPatients(params: Record<string, unknown>, config: EhrClientConfig): Promise<EhrResponse<Bundle<Patient>>>;
  getPatientById(id: string, config: EhrClientConfig, query?: Record<string, unknown>): Promise<EhrResponse<Patient>>;
  createPatient(data: unknown, config: EhrClientConfig): Promise<EhrResponse<unknown>>;

  // Appointment
  getAllAppointments(
    params: Record<string, unknown>,
    config: EhrClientConfig,
  ): Promise<EhrResponse<Bundle<Appointment>>>;
  getAppointmentById(id: string, config: EhrClientConfig): Promise<EhrResponse<Appointment>>;

  // Encounter
  getAllEncounters(params: Record<string, unknown>, config: EhrClientConfig): Promise<EhrResponse<Bundle<Encounter>>>;
  getEncounterById(id: string, config: EhrClientConfig): Promise<EhrResponse<Encounter>>;
  updateEncounter(id: string, data: unknown, config: EhrClientConfig): Promise<EhrResponse<unknown>>;

  // Coverage
  getAllCoverages(params: Record<string, unknown>, config: EhrClientConfig): Promise<EhrResponse<Bundle<Coverage>>>;
  getCoverageById(id: string, config: EhrClientConfig): Promise<EhrResponse<Coverage>>;
  createCoverage(data: unknown, config: EhrClientConfig): Promise<EhrResponse<unknown>>;

  // Condition
  getAllConditions(params: Record<string, unknown>, config: EhrClientConfig): Promise<EhrResponse<Bundle<Condition>>>;
  getConditionById(id: string, config: EhrClientConfig): Promise<EhrResponse<Condition>>;
  createCondition(data: unknown, config: EhrClientConfig): Promise<EhrResponse<unknown>>;
  updateCondition(id: string, data: unknown, config: EhrClientConfig): Promise<EhrResponse<unknown>>;

  // Practitioner
  getAllPractitioners(
    params: Record<string, unknown>,
    config: EhrClientConfig,
  ): Promise<EhrResponse<Bundle<Practitioner>>>;
  getPractitionerById(id: string, config: EhrClientConfig): Promise<EhrResponse<Practitioner>>;

  // AllergyIntolerance
  getAllAllergies(
    params: Record<string, unknown>,
    config: EhrClientConfig,
  ): Promise<EhrResponse<Bundle<AllergyIntolerance>>>;
  getAllergyById(id: string, config: EhrClientConfig): Promise<EhrResponse<AllergyIntolerance>>;
  createAllergy(data: unknown, config: EhrClientConfig): Promise<EhrResponse<unknown>>;

  // ServiceRequest
  getAllServiceRequests(
    params: Record<string, unknown>,
    config: EhrClientConfig,
  ): Promise<EhrResponse<Bundle<ServiceRequest>>>;
  getServiceRequestById(id: string, config: EhrClientConfig): Promise<EhrResponse<ServiceRequest>>;
  createServiceRequest(data: unknown, config: EhrClientConfig): Promise<EhrResponse<unknown>>;

  // MedicationStatement
  getAllMedicationStatements(
    params: Record<string, unknown>,
    config: EhrClientConfig,
  ): Promise<EhrResponse<Bundle<MedicationStatement>>>;
  getMedicationStatementById(id: string, config: EhrClientConfig): Promise<EhrResponse<MedicationStatement>>;
  createMedicationStatement(data: unknown, config: EhrClientConfig): Promise<EhrResponse<unknown>>;

  // Communication
  getAllCommunications(
    params: Record<string, unknown>,
    config: EhrClientConfig,
  ): Promise<EhrResponse<Bundle<Communication>>>;
  getCommunicationById(id: string, config: EhrClientConfig): Promise<EhrResponse<Communication>>;
  createCommunication(data: unknown, config: EhrClientConfig): Promise<EhrResponse<unknown>>;

  // Observation
  getAllObservations(
    params: Record<string, unknown>,
    config: EhrClientConfig,
  ): Promise<EhrResponse<Bundle<Observation>>>;
  getObservationById(id: string, config: EhrClientConfig): Promise<EhrResponse<Observation>>;
  createObservation(data: unknown, config: EhrClientConfig): Promise<EhrResponse<unknown>>;

  // DocumentReference
  getAllDocumentReferences(
    params: Record<string, unknown>,
    config: EhrClientConfig,
  ): Promise<EhrResponse<Bundle<DocumentReference>>>;
  getDocumentReferenceById(id: string, config: EhrClientConfig): Promise<EhrResponse<DocumentReference>>;
  createDocumentReference(data: unknown, config: EhrClientConfig): Promise<EhrResponse<unknown>>;

  // Location
  getAllLocations(params: Record<string, unknown>, config: EhrClientConfig): Promise<EhrResponse<Bundle<Location>>>;
  getLocationById(id: string, config: EhrClientConfig): Promise<EhrResponse<Location>>;

  // Task
  getAllTasks(params: Record<string, unknown>, config: EhrClientConfig): Promise<EhrResponse<Bundle<Task>>>;
  getTaskById(id: string, config: EhrClientConfig): Promise<EhrResponse<Task>>;
  createTask(data: unknown, config: EhrClientConfig): Promise<EhrResponse<unknown>>;
  updateTask(id: string, data: unknown, config: EhrClientConfig): Promise<EhrResponse<unknown>>;
}

/** Standard DrChrono paginated response envelope */
export interface DrChronoPaginatedResponse<T> {
  count?: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

/** Proprietary DrChrono patient record */
export interface DrChronoPatient {
  id: number;
  chart_id: string;
  first_name: string;
  last_name: string;
  middle_name?: string;
  gender: 'Male' | 'Female' | 'Other' | 'Unknown';
  date_of_birth: string;
  email?: string;
  cell_phone?: string;
  home_phone?: string;
  office_phone?: string;
  doctor: number;
  primary_care_physician?: number;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  social_security_number?: string;
  preferred_language?: string;
  preferred_language_code?: string;
  updated_at: string;
  [key: string]: unknown;
}

/** Proprietary DrChrono appointment record */
export interface DrChronoAppointment {
  id: number;
  doctor: number;
  patient: number;
  office: number;
  scheduled_time: string;
  duration?: number; // in minutes
  status: string;
  reason?: string;
  notes?: string;
  updated_at: string;
  icd9_codes?: string[];
  icd10_codes?: string[];
  [key: string]: unknown;
}

/** Proprietary DrChrono doctor (practitioner) record */
export interface DrChronoDoctor {
  id: number;
  first_name: string;
  last_name: string;
  specialty?: string;
  office_phone?: string;
  cell_phone?: string;
  email?: string;
  npi_number?: number;
  country?: string;
  is_account_suspended: boolean;
  [key: string]: unknown;
}

/** Proprietary DrChrono problem (condition) record */
export interface DrChronoProblem {
  id: number;
  patient: number;
  doctor: number;
  icd_code: string;
  icd_version: 9 | 10;
  name: string;
  description: string;
  status: 'active' | 'inactive';
  date_diagnosis?: string;
  date_onset?: string;
  date_changed?: string;
  notes?: string;
  info_url?: string;
  [key: string]: unknown;
}

/** Proprietary DrChrono allergy record */
export interface DrChronoAllergy {
  id: number;
  patient: number;
  doctor: number;
  description: string;
  rxnorm?: string;
  status?: string;
  notes?: string;
  reaction?: string;
  [key: string]: unknown;
}

/** Proprietary DrChrono medication record */
export interface DrChronoMedication {
  id: number;
  patient: number;
  doctor: number;
  name: string;
  ndc?: string;
  rxnorm?: string;
  dosage_quantity?: string;
  dosage_units?: string;
  route?: string;
  frequency?: string;
  date_prescribed?: string;
  date_started_taking?: string;
  date_stopped_taking?: string;
  status: 'active' | 'inactive';
  notes?: string;
  [key: string]: unknown;
}

/** Proprietary DrChrono office record */
export interface DrChronoOffice {
  id: number;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  phone_number?: string;
  [key: string]: unknown;
}

/** Proprietary DrChrono patient communication (message) record */
export interface DrChronoCommunication {
  id: number;
  doctor: number;
  patient: number;
  type: string;
  timestamp: string;
  author: number;
  message: string;
  archived: boolean;
  [key: string]: unknown;
}

/** Proprietary DrChrono task record */
export interface DrChronoTask {
  id: number;
  title: string;
  status: number;
  priority: string;
  assignee_user?: number;
  assignee_group?: number;
  assigned_by: number;
  category?: number;
  due_date?: string;
  archived: boolean;
  notes?: unknown[];
  associated_items?: unknown[];
  [key: string]: unknown;
}

/** Proprietary DrChrono lab result record */
export interface DrChronoLabResult {
  id: number;
  patient: number;
  lab_order: string;
  test_name: string;
  result_value: string;
  result_unit: string;
  [key: string]: unknown;
}

/** Payload for DrChrono getToken */
export interface DrChronoTokenPayload {
  clientId: string;
  clientSecret: string;
  code: string;
  grantType: 'authorization_code' | 'refresh_token';
  redirectUri?: string;
  scope?: string;
}

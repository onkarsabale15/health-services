/** Proprietary Elation patient record */
export interface ElationPatient {
  id: number;
  first_name: string;
  middle_name?: string;
  last_name: string;
  actual_name?: string;
  suffix?: string;
  dob: string;
  gender_identity?: string;
  patient_status?: { status: string };
  ssn?: string;
  last_modified: string;
  address?: {
    address_line1?: string;
    address_line2?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
  phones?: Array<{ phone: string; phone_type: string }>;
  emails?: Array<{ email: string; email_type: string }>;
  emergency_contact?: {
    first_name?: string;
    last_name?: string;
    phone?: string;
    relationship?: string;
  };
  insurances?: Array<{
    id: number;
    rank?: 'primary' | 'secondary' | 'tertiary';
    carrier?: { id: number; name: string };
    member_id?: string;
    group_id?: string;
    plan?: string;
    expiry_date?: string;
    is_active?: boolean;
  }>;
  [key: string]: unknown;
}

/** Proprietary Elation appointment record */
export interface ElationAppointment {
  id: number;
  patient: number;
  physician: number;
  practice: number;
  reason?: string;
  time: string;
  duration: number;
  status: string;
  telehealth_details?: {
    url?: string;
  };
  [key: string]: unknown;
}

/** Proprietary Elation lab order record */
export interface ElationLabOrder {
  id: number;
  patient: number;
  physician: number;
  practice: number;
  tests: unknown[];
  status: string;
  [key: string]: unknown;
}

/** Proprietary Elation report (often used for lab results) record */
export interface ElationReport {
  id: number;
  patient: number;
  category: string;
  content: string;
  chart_date: string;
  practice: number;
  physician: number;
  [key: string]: unknown;
}

/** Payload for Elation getToken */
export interface ElationTokenPayload {
  clientId: string;
  clientSecret: string;
  grantType: 'client_credentials';
}

export interface AthenaInsurance {
  insuranceid: string | number;
  eligibilitystatus?: string;
  insuranceplandisplayname?: string;
  insurancepolicyholder?: string;
  insurancepackagepayerid?: string;
  insuredidnumber?: string;
  insurancepayername?: string;
  insuranceidnumber?: string;
  relationshiptoinsured?: string;
  created?: string;
  expirationdate?: string;
  insurancetype?: string;
  insuranceplanname?: string;
  insurancepolicyholderdob?: string;
  insurancepolicyholdersex?: string;
  [key: string]: unknown;
}

/** Proprietary Athena patient record */
export interface AthenaPatient {
  patientid: string | number;
  firstname: string;
  lastname: string;
  dob: string;
  sex: string;
  status: string;
  address1?: string;
  city?: string;
  state?: string;
  zip?: string;
  homephone?: string;
  mobilephone?: string;
  workphone?: string;
  email?: string;
  departmentid?: string | number;
  lastupdated?: string;
  confidentialitycode?: string;
  countrycode?: string;
  primaryproviderid?: string | number;
  maritalstatus?: string;
  customfields?: Array<{ customfieldid: string; customfieldvalue: string }>;
  insurances?: AthenaInsurance[];
  [key: string]: unknown;
}

/** Proprietary Athena patient search response */
export interface AthenaPatientResponse {
  totalcount: number;
  patients: AthenaPatient[];
}

/** Proprietary Athena appointment record */
export interface AthenaAppointment {
  appointmentid: string | number;
  appointmentdate?: string;
  appointmentstatus: string;
  patientappointmenttypename?: string;
  appointmenttype?: string;
  scheduleddatetime?: string;
  startcheckin?: string;
  stopexamdatetime?: string;
  duration?: number;
  providerid: string | number;
  patientid?: string | number;
  departmentid: string | number;
  date?: string;
  starttime?: string;
  lastmodified?: string;
  appointmentnotes?: Array<{ text: string }>;
  [key: string]: unknown;
}

/** Proprietary Athena appointment response */
export interface AthenaAppointmentResponse {
  totalcount: number;
  appointments: AthenaAppointment[];
}

/** Proprietary Athena encounter record */
export interface AthenaEncounter {
  encounterid: string | number;
  encounterdate?: string;
  encountertype?: string;
  status: string;
  appointmentid?: string | number;
  patientid?: string | number;
  departmentid?: string | number;
  providerid?: string | number;
  lastupdated?: string;
  encountervisitname?: string;
  appointmentstartdate?: string;
  [key: string]: unknown;
}

/** Proprietary Athena encounter response */
export interface AthenaEncounterResponse {
  totalcount: number;
  encounters: AthenaEncounter[];
}

/** Proprietary Athena CCDA export response */
export interface AthenaCcdaResponse {
  ccda: string;
  [key: string]: unknown;
}

/** Proprietary Athena department record */
export interface AthenaDepartment {
  departmentid: string | number;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  [key: string]: unknown;
}

/** Proprietary Athena department response */
export interface AthenaDepartmentResponse {
  totalcount: number;
  departments: AthenaDepartment[];
}

/** Payload for Athena getToken */
export interface AthenaTokenPayload {
  grantType?: 'client_credentials';
  clientId: string;
  clientSecret: string;
  scope?: string;
}

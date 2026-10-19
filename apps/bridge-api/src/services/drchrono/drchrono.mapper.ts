import { v7 as uuidv7 } from 'uuid';
import {
  type DrChronoPatient,
  type DrChronoAppointment,
  type DrChronoDoctor,
  type DrChronoProblem,
  type DrChronoAllergy,
  type DrChronoMedication,
  type DrChronoCommunication,
  type DrChronoLabResult,
  type DrChronoTask,
  type DrChronoOffice,
  type DrChronoPaginatedResponse,
} from '@hs/ehr-data-service';
import type {
  Patient,
  Bundle,
  Appointment,
  Practitioner,
  Condition,
  AllergyIntolerance,
  MedicationStatement,
  Communication,
  Observation,
  DocumentReference,
  Task,
  Location,
  ContactPoint,
  Identifier,
} from '@medplum/fhirtypes';
import { logger } from '@hs/observability';
import type { FhirSearchParams } from '../vendor-data-service.interface';

export function capitalizeFirstLetter(word: string): string {
  if (!word) return '';
  return word.charAt(0).toUpperCase() + word.slice(1);
}

// Maps FHIR param names to DrChrono API param names.
export function searchParams(params: FhirSearchParams): Record<string, any> {
  const mapped: Record<string, any> = {};
  if (params?.patient && typeof params.patient === 'string') mapped.patient = params.patient;
  if (params?.given && typeof params.given === 'string') mapped.first_name = params.given;
  if (params?.family && typeof params.family === 'string') mapped.last_name = params.family;
  if (params?.birthdate && typeof params.birthdate === 'string') mapped.date_of_birth = params.birthdate;
  if (params?._count) mapped.page_size = params._count;
  if (params?._getpagesoffset) mapped.cursor = params._getpagesoffset;
  return mapped;
}

// ---------- Patient ----------

export function convertPatientFhirToEhr(fhirPatient: Patient): Record<string, any> {
  return {
    last_name: fhirPatient.name?.[0]?.family || '',
    first_name: fhirPatient.name?.[0]?.given?.[0] || '',
    middle_name: fhirPatient.name?.[0]?.given?.[1] || '',
    gender: capitalizeFirstLetter(fhirPatient.gender as string) || '',
    date_of_birth: fhirPatient.birthDate || '',
    zip_code: fhirPatient.address?.[0]?.postalCode || '',
    city: fhirPatient.address?.[0]?.city || '',
    state: fhirPatient.address?.[0]?.state || '',
    address: fhirPatient.address?.[0]?.line?.join(', ') || '',
    home_phone: fhirPatient.telecom?.find((t: any) => t.system === 'phone' && t.use === 'home')?.value || '',
    primary_care_physician: fhirPatient.generalPractitioner?.[0]?.reference?.split('/')?.pop() || '',
    patient_status: 'A',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    doctor: fhirPatient.generalPractitioner?.[0]?.reference?.split('/')?.pop(),
  };
}

function convertSinglePatientToFhir(patient: DrChronoPatient): Patient {
  const resource: Patient = {
    resourceType: 'Patient',
    id: patient.id?.toString(),
    identifier: [],
    name: [
      {
        use: 'official',
        family: patient.last_name,
        given: [patient.first_name, patient?.middle_name].filter((g): g is string => !!g),
      },
    ],
    telecom: [],
    address: [
      {
        use: 'home',
        line: [patient.address].filter((l): l is string => !!l),
        city: patient.city,
        state: patient.state,
        postalCode: patient.zip_code,
      },
    ],
    communication: [],
    meta: { lastUpdated: patient.updated_at },
    generalPractitioner: [],
  };

  if (patient.social_security_number) {
    resource.identifier?.push({ system: 'http://hl7.org/fhir/sid/us-ssn', value: patient.social_security_number });
  }
  if (patient?.gender) resource.gender = patient.gender.toLowerCase() as Patient['gender'];
  if (patient.date_of_birth) resource.birthDate = patient.date_of_birth;

  if (patient.home_phone) resource.telecom?.push({ system: 'phone', value: patient.home_phone, use: 'home' });
  if (patient.cell_phone) resource.telecom?.push({ system: 'phone', value: patient.cell_phone, use: 'mobile' });
  if (patient.office_phone) resource.telecom?.push({ system: 'phone', value: patient.office_phone, use: 'work' });
  if (patient.email) resource.telecom?.push({ system: 'email', value: patient.email, use: 'home' });

  if (patient.preferred_language_code || patient.preferred_language) {
    resource.communication?.push({
      preferred: true,
      language: {
        coding: [
          {
            system: 'urn:ietf:bcp:47',
            code: patient.preferred_language_code,
            display: patient.preferred_language,
          },
        ],
      },
    });
  }
  if (patient?.primary_care_physician) {
    resource.generalPractitioner?.push({ reference: `Practitioner/${patient.primary_care_physician}` });
  }
  return resource;
}

export function convertPatientEhrToFhir(
  patientData: DrChronoPatient | DrChronoPaginatedResponse<DrChronoPatient>,
  isBundle = false,
): Bundle<Patient> | Patient {
  const pData = patientData as any;
  const patients = Array.isArray(pData.results) ? pData.results : [pData];
  const entries = patients.map((p: DrChronoPatient) => ({ resource: convertSinglePatientToFhir(p) }));
  const bundle: Bundle<Patient> = {
    resourceType: 'Bundle',
    id: uuidv7(),
    type: 'searchset',
    total: entries.length,
    entry: entries,
  };
  return isBundle ? bundle : (entries[0]?.resource as Patient);
}

// ---------- Appointment ----------

export function convertDateRange(dateString: string): string {
  const parts = dateString.split(',');
  let startDate = '';
  let endDate = '';
  parts.forEach((part: string) => {
    if (part.startsWith('ge')) startDate = part.substring(2);
    else if (part.startsWith('lt')) endDate = part.substring(2);
  });
  if (!startDate || !endDate) {
    throw { statusCode: 400, body: JSON.stringify({ error: 'Invalid date! Valid format: ge2024-07-01,lt2024-07-10' }) };
  }
  return `${startDate}/${endDate}`;
}

async function paginationLink(baseUrl: string, resUrl: string | null): Promise<string | null> {
  if (!resUrl) return null;
  const nextUrl = new URL(baseUrl);
  const params = new URL(resUrl).searchParams;
  let date = '';
  params.forEach((value: string, key: string) => {
    if (key === 'page_size') nextUrl.searchParams.append('_count', value);
    if (key === 'cursor') nextUrl.searchParams.append('_getpagesoffset', value);
    if (key === 'date_range') {
      const [s, e] = value.split('/');
      date = `&date=ge${s},lt${e}`;
    }
    if (key === 'patient') nextUrl.searchParams.append(key, value);
  });
  return nextUrl.toString() + date;
}

function convertSingleAppointmentToFhir(appointment: DrChronoAppointment): Appointment {
  const resource: Appointment = {
    resourceType: 'Appointment',
    id: appointment.id?.toString(),
    meta: { lastUpdated: appointment?.updated_at },
    description: appointment.reason as string,
    start: appointment.scheduled_time,
    status: (appointment.status || 'booked') as Appointment['status'],
    participant: [
      { actor: { reference: `Practitioner/${appointment.doctor}` }, status: 'accepted' },
      { actor: { reference: `Patient/${appointment.patient}` }, status: 'accepted' },
      { actor: { reference: `Location/${appointment.office}` }, status: 'accepted' },
    ],
    reasonCode: [],
  };
  if (appointment.duration) {
    resource.end = new Date(
      new Date(appointment.scheduled_time).getTime() + appointment.duration * 60000,
    ).toISOString();
    resource.minutesDuration = appointment.duration;
  }
  if (appointment.notes) resource.comment = appointment.notes;

  const reasonCode: any = { coding: [] };
  (appointment.icd9_codes || []).forEach((code: string) => {
    reasonCode.coding.push({ system: 'http://hl7.org/fhir/sid/icd-9-cm', code });
  });
  (appointment.icd10_codes || []).forEach((code: string) => {
    reasonCode.coding.push({ system: 'http://hl7.org/fhir/sid/icd-10-cm', code });
  });
  if (reasonCode.coding.length > 0) resource.reasonCode?.push(reasonCode);
  return resource;
}

export async function convertAppointmentEhrToFhir(
  appointmentData: DrChronoAppointment | DrChronoPaginatedResponse<DrChronoAppointment>,
  url?: string,
  isBundle = false,
): Promise<Bundle<Appointment> | Appointment> {
  const pData = appointmentData as any;
  const appointments = Array.isArray(pData.results) ? pData.results : [pData];
  const next = pData.next;
  const previous = pData.previous;

  const entries = appointments.map((a: DrChronoAppointment) => ({ resource: convertSingleAppointmentToFhir(a) }));
  const bundle: Bundle<Appointment> = {
    resourceType: 'Bundle',
    id: uuidv7(),
    type: 'searchset',
    total: entries.length,
    entry: entries,
    link: [
      {
        relation: 'previous',
        url: (await paginationLink(`${process.env.ENVIRONMENT}/api/fhir/r4/v1/Appointment`, previous)) || '',
      },
      { relation: 'self', url: url || '' },
      {
        relation: 'next',
        url: (await paginationLink(`${process.env.ENVIRONMENT}/api/fhir/r4/v1/Appointment`, next)) || '',
      },
    ],
  };
  return isBundle ? bundle : (entries[0]?.resource as Appointment);
}

// ---------- Practitioner ----------

function convertDoctorToPractitioner(doctor: DrChronoDoctor): Practitioner {
  const resource: Practitioner = {
    resourceType: 'Practitioner',
    id: doctor.id?.toString(),
    active: !doctor?.is_account_suspended,
    name: [
      {
        use: 'official',
        family: doctor?.last_name as string,
        given: [doctor?.first_name as string].filter(Boolean),
        text: `${doctor?.first_name} ${doctor?.last_name}`,
      },
    ],
    telecom: [],
    address: [{ use: 'work', country: doctor?.country as string }],
    identifier: [],
    qualification: [],
  };

  if (doctor?.office_phone)
    resource.telecom?.push({ system: 'phone', value: doctor.office_phone as string, use: 'work' });
  if (doctor?.cell_phone)
    resource.telecom?.push({ system: 'phone', value: doctor.cell_phone as string, use: 'mobile' });
  if (doctor?.email) resource.telecom?.push({ system: 'email', value: doctor.email as string, use: 'work' });
  if (doctor?.npi_number) {
    resource.identifier?.push({ system: 'http://hl7.org/fhir/sid/us-npi', value: doctor.npi_number.toString() });
  }
  if (doctor?.specialty) {
    resource.qualification?.push({ code: { text: doctor.specialty as string } });
  }
  return resource;
}

export function convertPractitionerEhrToFhir(
  doctors: DrChronoDoctor[],
  isBundle = false,
): Bundle<Practitioner> | Practitioner {
  const entries = (doctors || []).map((d) => ({ resource: convertDoctorToPractitioner(d) }));
  const bundle: Bundle<Practitioner> = {
    resourceType: 'Bundle',
    id: uuidv7(),
    type: 'searchset',
    total: entries.length,
    entry: entries,
  };
  return isBundle ? bundle : (entries[0]?.resource as Practitioner);
}

// ---------- Condition ----------

export function ehrToFhirLink(resUrl: string | null): string | null {
  if (!resUrl) return null;
  try {
    const u = new URL(resUrl);
    const cursor = u.searchParams.get('cursor');
    const pageSize = u.searchParams.get('page_size');
    const patient = u.searchParams.get('patient');
    const fhirUrl = new URL(`${process.env.ENVIRONMENT}/api/fhir/r4/v1/`);
    if (cursor) fhirUrl.searchParams.append('_getpagesoffset', cursor);
    if (pageSize) fhirUrl.searchParams.append('_count', pageSize);
    if (patient) fhirUrl.searchParams.append('patient', patient);
    return fhirUrl.toString();
  } catch {
    return null;
  }
}

export async function convertConditionEhrToFhir(
  conditionData: DrChronoProblem | DrChronoPaginatedResponse<DrChronoProblem>,
  url?: string,
): Promise<Bundle<Condition> | Condition> {
  const pData = conditionData as any;
  const conditions = Array.isArray(pData.results) ? pData.results : [pData];
  const next = pData.next;
  const previous = pData.previous;

  const fhirConditions = conditions.map((condition: DrChronoProblem) => {
    const fhirCondition: Condition = {
      resourceType: 'Condition',
      id: condition.id?.toString(),
      clinicalStatus: {
        coding: [
          {
            system: 'https://terminology.hl7.org/CodeSystem/condition-clinical',
            code: condition.status === 'active' ? 'active' : 'resolved',
          },
        ],
      },
      code: {
        coding: [
          {
            system: condition.icd_version === 10 ? 'https://hl7.org/fhir/sid/icd-10' : 'https://hl7.org/fhir/sid/icd-9',
            code: condition.icd_code,
            display: condition.name,
          },
          {
            system: 'https://snomed.info/sct',
            code: condition.snomed_ct_code as string,
            display: condition.description,
          },
        ],
        text: condition.description,
      },
      subject: { reference: `Patient/${condition.patient}` },
      recordedDate: condition.date_diagnosis,
      recorder: { reference: `Practitioner/${condition.doctor}` },
    };

    if (condition.notes) fhirCondition.note = [{ text: condition.notes as string }];
    if (condition.info_url) {
      fhirCondition.evidence = [{ detail: [{ display: 'More information' }] }];
    }
    if (condition.date_onset) fhirCondition.onsetDateTime = condition.date_onset;
    if (condition.date_changed) fhirCondition.abatementDateTime = condition.date_changed;
    return fhirCondition;
  });

  if (fhirConditions.length === 1 && !pData.results) return fhirConditions[0];

  const bundle: Bundle<Condition> = {
    resourceType: 'Bundle',
    id: uuidv7(),
    total: fhirConditions.length,
    type: 'searchset',
    entry: fhirConditions.map((c: Condition) => ({
      fullUrl: `${process.env.ENVIRONMENT}/api/fhir/r4/v1/Condition/${c.id}`,
      resource: c,
    })),
    link: [
      {
        relation: 'previous',
        url: ehrToFhirLink(previous) || '',
      },
      { relation: 'self', url: url || '' },
      {
        relation: 'next',
        url: ehrToFhirLink(next) || '',
      },
    ],
  };
  return bundle;
}

export function conditionBodyBuilder(params: Condition): Record<string, any> {
  const body: Record<string, any> = {
    patient: params?.subject?.reference?.split('/')[1],
    notes: params?.note?.[0]?.text,
    doctor: (params as any)?.practitioner?.split('/')[1],
  };

  (params?.code?.coding || []).forEach((code) => {
    if (code.system === 'https://hl7.org/fhir/sid/icd-10-cm') {
      body.icd_version = 10;
      body.icd_code = code.code;
      body.name = code.display;
    } else if (code.system === 'https://snomed.info/sct') {
      body.snomed_ct_code = code.code;
      body.description = code.display;
    }
  });
  return body;
}

// ---------- Allergy ----------

export async function convertAllergyEhrToFhir(
  allergyData: DrChronoAllergy | DrChronoPaginatedResponse<DrChronoAllergy>,
  isBulk = false,
): Promise<Bundle<AllergyIntolerance> | AllergyIntolerance> {
  const pData = allergyData as any;
  const allergies = Array.isArray(pData.results) ? pData.results : [pData];

  const getFhirAllergyEntries = (items: DrChronoAllergy[]): any[] => {
    return items.map((allergy) => ({
      fullUrl: `${process.env.ENVIRONMENT}/api/fhir/r4/v1/AllergyIntolerance/${allergy.id}`,
      resource: {
        resourceType: 'AllergyIntolerance',
        id: allergy.id?.toString(),
        clinicalStatus: allergy.status
          ? {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical',
                  code: allergy.status.toLowerCase(),
                  display: capitalizeFirstLetter(allergy.status),
                },
              ],
            }
          : undefined,
        code: {
          coding: [
            {
              system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
              code: allergy.rxnorm,
              display: allergy.description,
            },
          ],
          text: allergy.description,
        },
        patient: { reference: `Patient/${allergy.patient}` },
        recorder: { reference: `Practitioner/${allergy.doctor}` },
        note: [{ authorReference: { reference: `Practitioner/${allergy.doctor}` }, text: allergy.notes as string }],
        reaction: allergy.reaction
          ? [
              {
                manifestation: [{ text: allergy.reaction as string }],
              },
            ]
          : [],
      } as AllergyIntolerance,
    }));
  };

  const entries = getFhirAllergyEntries(allergies);
  const bundle: Bundle<AllergyIntolerance> = {
    resourceType: 'Bundle',
    id: uuidv7(),
    type: 'searchset',
    total: entries.length,
    entry: entries,
  };

  return isBulk ? bundle : (entries[0]?.resource as AllergyIntolerance);
}

export function saveAllergy(body: AllergyIntolerance): Record<string, any> {
  return {
    patient: body.patient?.reference?.split('/')[1],
    doctor: body.recorder?.reference?.split('/')[1],
    description: body.code?.text,
    status: body.clinicalStatus?.coding?.[0]?.code,
    rxnorm: body.code?.coding?.[0]?.code,
    notes: body.note?.[0]?.text,
  };
}

// ---------- Medication ----------

export function fhirMedicationStatement(
  medicationData: DrChronoMedication | DrChronoPaginatedResponse<DrChronoMedication>,
  isBulk = false,
): Bundle<MedicationStatement> | MedicationStatement {
  const pData = medicationData as any;
  const medications = Array.isArray(pData.results) ? pData.results : [pData];

  const getFhirEntries = (items: DrChronoMedication[]): any[] => {
    return items.map((med) => ({
      fullUrl: `${process.env.ENVIRONMENT}/api/fhir/r4/v1/MedicationStatement/${med.id}`,
      resource: {
        resourceType: 'MedicationStatement',
        id: med.id?.toString(),
        status: med.status as MedicationStatement['status'],
        medicationCodeableConcept: {
          coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: med.rxnorm }],
          text: med.name,
        },
        subject: { reference: `Patient/${med.patient}` },
        informationSource: { reference: `Practitioner/${med.doctor}` },
        effectivePeriod: { start: med.date_started_taking, end: med.date_stopped_taking as string },
        note: [{ text: med.notes as string }],
        dosage: [{ text: `${med.dosage_quantity} ${med.dosage_units} ${med.route} ${med.frequency}` }],
      } as MedicationStatement,
    }));
  };

  const entries = getFhirEntries(medications);
  const bundle: Bundle<MedicationStatement> = {
    resourceType: 'Bundle',
    id: uuidv7(),
    type: 'searchset',
    total: entries.length,
    entry: entries,
  };

  return isBulk ? bundle : (entries[0]?.resource as MedicationStatement);
}

export function saveMedication(body: MedicationStatement): Record<string, any> {
  return {
    patient: body.subject?.reference?.split('/')[1],
    name: body.medicationCodeableConcept?.text,
    ndc: body.medicationCodeableConcept?.coding?.[0]?.code,
    status: body.status === 'active' ? 'active' : 'inactive',
    notes: body.note?.[0]?.text,
  };
}

// ---------- Communication ----------

export function fhirCommunication(
  communicationData: DrChronoCommunication | DrChronoPaginatedResponse<DrChronoCommunication>,
  isBulk = false,
): Bundle<Communication> | Communication {
  const pData = communicationData as any;
  const communications = Array.isArray(pData.results) ? pData.results : [pData];

  const getFhirEntries = (items: DrChronoCommunication[]): any[] => {
    return items.map((comm) => ({
      fullUrl: `${process.env.ENVIRONMENT}/api/fhir/r4/v1/Communication/${comm.id}`,
      resource: {
        resourceType: 'Communication',
        id: comm.id?.toString(),
        status: comm.archived ? 'completed' : 'in-progress',
        sent: comm.timestamp,
        subject: { reference: `Patient/${comm.patient}` },
        recipient: [{ reference: `Practitioner/${comm.doctor}` }],
        sender: { reference: `Practitioner/${comm.author}` },
        payload: [{ contentString: comm.message }],
        category: [{ coding: [{ system: 'http://loinc.org', code: '77353-1', display: 'Patient message' }] }],
      } as Communication,
    }));
  };

  const entries = getFhirEntries(communications);
  const bundle: Bundle<Communication> = {
    resourceType: 'Bundle',
    id: uuidv7(),
    type: 'searchset',
    total: entries.length,
    entry: entries,
  };

  return isBulk ? bundle : (entries[0]?.resource as Communication);
}

export function saveCommunication(body: Communication): Record<string, any> {
  return {
    patient: body.subject?.reference?.split('/')[1],
    doctor: body.recipient?.[0]?.reference?.split('/')[1],
    message: body.payload?.[0]?.contentString,
    type: 'Patient Message',
  };
}

// ---------- DocumentReference ----------

export function fhirDocumentReference(
  documentData: any | DrChronoPaginatedResponse<any>,
  isBulk = false,
): Bundle<DocumentReference> | DocumentReference {
  const pData = documentData as any;
  const documents = Array.isArray(pData.results) ? pData.results : [pData];

  const getFhirEntries = (items: any[]): any[] => {
    return items.map((doc) => ({
      fullUrl: `${process.env.ENVIRONMENT}/api/fhir/r4/v1/DocumentReference/${doc.id}`,
      resource: {
        resourceType: 'DocumentReference',
        id: doc.id?.toString(),
        status: 'current',
        type: { text: doc.description },
        subject: { reference: `Patient/${doc.patient}` },
        date: doc.updated_at,
        content: [{ attachment: { url: doc.document, contentType: 'application/pdf' } }],
      } as DocumentReference,
    }));
  };

  const entries = getFhirEntries(documents);
  const bundle: Bundle<DocumentReference> = {
    resourceType: 'Bundle',
    id: uuidv7(),
    type: 'searchset',
    total: entries.length,
    entry: entries,
  };

  return isBulk ? bundle : (entries[0]?.resource as DocumentReference);
}

// ---------- Observation ----------

export function fhirObservation(
  labData: DrChronoLabResult | DrChronoPaginatedResponse<DrChronoLabResult>,
  isBulk = false,
): Bundle<Observation> | Observation {
  const pData = labData as any;
  const labs = Array.isArray(pData.results) ? pData.results : [pData];

  const getFhirEntries = (items: DrChronoLabResult[]): any[] => {
    return items.map((lab) => ({
      fullUrl: `${process.env.ENVIRONMENT}/api/fhir/r4/v1/Observation/${lab.id}`,
      resource: {
        resourceType: 'Observation',
        id: lab.id?.toString(),
        status: 'final',
        category: [
          { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'laboratory' }] },
        ],
        code: { text: lab.test_name },
        subject: { reference: `Patient/${lab.patient}` },
        valueQuantity: { value: parseFloat(lab.result_value), unit: lab.result_unit },
      } as Observation,
    }));
  };

  const entries = getFhirEntries(labs);
  const bundle: Bundle<Observation> = {
    resourceType: 'Bundle',
    id: uuidv7(),
    type: 'searchset',
    total: entries.length,
    entry: entries,
  };

  return isBulk ? bundle : (entries[0]?.resource as Observation);
}

export function fhirLocation(
  officeData: DrChronoOffice | DrChronoPaginatedResponse<DrChronoOffice>,
  isBulk = false,
): Bundle<Location> | Location {
  const pData = officeData as any;
  const offices = Array.isArray(pData.results) ? pData.results : [pData];

  const getFhirEntries = (items: DrChronoOffice[]): any[] => {
    return items.map((off) => ({
      fullUrl: `${process.env.ENVIRONMENT}/api/fhir/r4/v1/Location/${off.id}`,
      resource: {
        resourceType: 'Location',
        id: off.id?.toString(),
        name: off.name,
        telecom: [{ system: 'phone', value: off.phone_number as string }],
        address: {
          line: [off.address as string],
          city: off.city as string,
          state: off.state as string,
          postalCode: off.zip_code as string,
        },
      } as Location,
    }));
  };

  const entries = getFhirEntries(offices);
  const bundle: Bundle<Location> = {
    resourceType: 'Bundle',
    id: uuidv7(),
    type: 'searchset',
    total: entries.length,
    entry: entries,
  };

  return isBulk ? bundle : (entries[0]?.resource as Location);
}

export function fhirTask(
  taskData: DrChronoTask | DrChronoPaginatedResponse<DrChronoTask>,
  isBulk = false,
): Bundle<Task> | Task {
  const pData = taskData as any;
  const tasks = Array.isArray(pData.results) ? pData.results : [pData];

  const getFhirEntries = (items: DrChronoTask[]): any[] => {
    return items.map((t) => ({
      fullUrl: `${process.env.ENVIRONMENT}/api/fhir/r4/v1/Task/${t.id}`,
      resource: {
        resourceType: 'Task',
        id: t.id?.toString(),
        status: t.status === 1 ? 'requested' : 'completed',
        intent: 'order',
        priority: t.priority === 'High' ? 'urgent' : 'routine',
        description: t.title,
        authoredOn: t.due_date,
        lastModified: t.due_date,
      } as Task,
    }));
  };

  const entries = getFhirEntries(tasks);
  const bundle: Bundle<Task> = {
    resourceType: 'Bundle',
    id: uuidv7(),
    type: 'searchset',
    total: entries.length,
    entry: entries,
  };

  return isBulk ? bundle : (entries[0]?.resource as Task);
}

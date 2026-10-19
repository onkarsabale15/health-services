import { type ElationPatient, type ElationAppointment, type ElationReport } from '@hs/ehr-data-service';
import type {
  Patient,
  Bundle,
  Appointment,
  Coverage,
  Communication,
  Observation,
  ContactPoint,
  HumanName,
  Address,
} from '@medplum/fhirtypes';
import { v7 as uuidv7 } from 'uuid';

// ── Date parsing ─────────────────────────────────────────────────────────────

export function getDates(dateString?: string): { from_date?: string; to_date?: string } {
  let from_date: string | undefined;
  let to_date: string | undefined;
  const dates = dateString ? dateString.split(',') : [];
  for (const date of dates) {
    if (date.startsWith('ge')) {
      from_date = new Date(date.replace('ge', '')).toISOString();
    }
    if (date.startsWith('lt')) {
      to_date = new Date(date.replace('lt', '')).toISOString();
    }
  }
  return { from_date, to_date };
}

// ── Patient ───────────────────────────────────────────────────────────────────

const genderMap: Record<string, Patient['gender']> = {
  man: 'male',
  woman: 'female',
  unknown: 'unknown',
  other: 'other',
};

export function convertPatientToFhir(patient: ElationPatient): Patient {
  const telecom: ContactPoint[] = [];

  (patient.phones ?? []).forEach((p) => {
    telecom.push({
      system: 'phone',
      value: p.phone,
      use: p.phone_type?.toLowerCase() as ContactPoint['use'],
    });
  });

  (patient.emails ?? []).forEach((e) => {
    telecom.push({
      system: 'email',
      value: e.email,
      use: e.email_type?.toLowerCase() as ContactPoint['use'],
    });
  });

  const name: HumanName = {
    use: 'official',
    family: patient.last_name,
    given: [patient.first_name, patient.middle_name].filter((g): g is string => !!g),
    text: patient.actual_name,
  };
  if (patient.suffix) name.suffix = [patient.suffix];

  const address: Address = {
    use: 'home',
    line: [patient.address?.address_line1, patient.address?.address_line2].filter((l): l is string => !!l),
    city: patient.address?.city,
    state: patient.address?.state,
    postalCode: patient.address?.zip,
  };

  const resource: Patient = {
    resourceType: 'Patient',
    id: String(patient.id),
    meta: { lastUpdated: patient.last_modified },
    active: patient.patient_status?.status === 'active',
    name: [name],
    gender: genderMap[patient.gender_identity as string] || 'unknown',
    birthDate: patient.dob,
    address: [address],
    telecom,
  };

  if (patient.ssn) {
    resource.identifier = [{ system: 'http://hl7.org/fhir/sid/us-ssn', value: String(patient.ssn) }];
  }

  if (patient.emergency_contact) {
    resource.contact = [
      {
        relationship: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0131', code: 'C' }] }],
        name: {
          family: patient.emergency_contact.last_name,
          given: [patient.emergency_contact.first_name].filter((g): g is string => !!g),
        },
        telecom: patient.emergency_contact.phone ? [{ system: 'phone', value: patient.emergency_contact.phone }] : [],
      },
    ];
  }

  return resource;
}

export function convertPatientsToBundle(
  patientData: ElationPatient | ElationPatient[],
  isBundle = false,
): Bundle<Patient> | Patient {
  const patients = Array.isArray(patientData) ? patientData : [patientData];
  const entries = patients.map((p) => ({
    fullUrl: `${process.env.ENVIRONMENT}/api/fhir/r4/v1/Patient/${p.id}`,
    resource: convertPatientToFhir(p),
  }));

  const bundle: Bundle<Patient> = {
    resourceType: 'Bundle',
    id: uuidv7(),
    type: 'searchset',
    total: entries.length,
    entry: entries,
  };

  return isBundle ? bundle : (entries[0]?.resource as Patient);
}

// ── Appointment ──────────────────────────────────────────────────────────────

export function convertAppointmentToFhir(app: ElationAppointment): Appointment {
  return {
    resourceType: 'Appointment',
    id: String(app.id),
    status: (app.status === 'Cancelled' ? 'cancelled' : 'booked') as Appointment['status'],
    start: app.time,
    end: new Date(new Date(app.time).getTime() + app.duration * 60000).toISOString(),
    description: app.reason,
    participant: [
      { actor: { reference: `Patient/${app.patient}` }, status: 'accepted' },
      { actor: { reference: `Practitioner/${app.physician}` }, status: 'accepted' },
      { actor: { reference: `Location/${app.practice}` }, status: 'accepted' },
    ],
  };
}

export function convertAppointmentsToBundle(
  appData: ElationAppointment | ElationAppointment[],
  isBundle = false,
): Bundle<Appointment> | Appointment {
  const appointments = Array.isArray(appData) ? appData : [appData];
  const entries = appointments.map((a) => ({
    fullUrl: `${process.env.ENVIRONMENT}/api/fhir/r4/v1/Appointment/${a.id}`,
    resource: convertAppointmentToFhir(a),
  }));

  const bundle: Bundle<Appointment> = {
    resourceType: 'Bundle',
    id: uuidv7(),
    type: 'searchset',
    total: entries.length,
    entry: entries,
  };

  return isBundle ? bundle : (entries[0]?.resource as Appointment);
}

// ── Coverage ─────────────────────────────────────────────────────────────────

export function convertInsuranceToCoverage(ins: any, patientId: string): Coverage {
  return {
    resourceType: 'Coverage',
    id: String(ins.id),
    status: ins.is_active ? 'active' : 'cancelled',
    subscriberId: ins.member_id,
    type: { text: ins.plan },
    payor: [{ display: ins.carrier?.name }],
    beneficiary: { reference: `Patient/${patientId}` },
    relationship: {
      coding: [{ system: 'http://terminology.hl7.org/CodeSystem/subscriber-relationship', code: 'self' }],
    },
    period: ins.expiry_date ? { end: ins.expiry_date } : undefined,
    class: [
      {
        type: {
          coding: [{ system: 'http://terminology.hl7.org/CodeSystem/coverage-class', code: 'group' }],
        },
        value: ins.group_id,
      },
    ],
  };
}

// ── Communication ────────────────────────────────────────────────────────────

export function convertToCommunicationFhir(data: any): Communication {
  return {
    resourceType: 'Communication',
    id: String(data.id),
    status: 'completed',
    subject: { reference: `Patient/${data.id}` },
    payload: [{ contentString: data.notes }],
    sent: data.last_modified,
  };
}

// ── Observation ──────────────────────────────────────────────────────────────

export function convertReportToObservation(report: ElationReport): Observation {
  return {
    resourceType: 'Observation',
    id: String(report.id),
    status: 'final',
    category: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'laboratory',
            display: 'Laboratory',
          },
        ],
      },
    ],
    code: { text: report.category },
    subject: { reference: `Patient/${report.patient}` },
    effectiveDateTime: report.chart_date,
    performer: [{ reference: `Practitioner/${report.physician}` }, { reference: `Location/${report.practice}` }],
    valueString: report.content,
  };
}

export function convertReportsToBundle(
  reportData: ElationReport | ElationReport[],
  isBundle = false,
): Bundle<Observation> | Observation {
  const reports = Array.isArray(reportData) ? reportData : [reportData];
  const entries = reports.map((r) => ({
    fullUrl: `${process.env.ENVIRONMENT}/api/fhir/r4/v1/Observation/${r.id}`,
    resource: convertReportToObservation(r),
  }));

  const bundle: Bundle<Observation> = {
    resourceType: 'Bundle',
    id: uuidv7(),
    type: 'searchset',
    total: entries.length,
    entry: entries,
  };

  return isBundle ? bundle : (entries[0]?.resource as Observation);
}

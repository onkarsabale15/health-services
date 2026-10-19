import moment from 'moment';
import {
  CODING_URLS,
  type AthenaPatient,
  type AthenaInsurance,
  type AthenaAppointment,
  type AthenaEncounter,
  type AthenaDepartment,
} from '@hs/ehr-data-service';
import type { SiteData } from '@hs/ehr-data-service';
import { logger } from '@hs/observability';
import type {
  Patient,
  Bundle,
  HumanName,
  Address,
  ContactPoint,
  Coverage,
  Appointment,
  Encounter,
  Practitioner,
  Condition,
  AllergyIntolerance,
  ServiceRequest,
  Communication,
  Observation,
  DocumentReference,
  Location,
  Extension,
  Meta,
  Annotation,
  Identifier,
  CodeableConcept,
  Period,
  Resource,
} from '@medplum/fhirtypes';

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

export const genderMappings: Record<string, Patient['gender']> = {
  F: 'female',
  M: 'male',
};

export const severityMappings: Record<string, number> = {
  mild: 255604002,
  moderate: 6736007,
  severe: 24484000,
};

export const encounterStatusMapping: Record<string, Encounter['status']> = {
  CLOSED: 'finished',
  OPEN: 'in-progress',
  PEND: 'onleave',
  REVIEW: 'arrived',
  TEMP: 'in-progress',
  REQUIRESIGNATURE: 'in-progress',
  DELETED: 'cancelled',
  SCHEDULE: 'planned',
};

export const coverageStatusMapping: Record<string, Coverage['status']> = {
  Ineligible: 'cancelled',
  Eligible: 'active',
  Unverified: 'draft',
};

export const documentMappings: Record<string, string> = {
  'data-portability': 'DataPortability',
  'referral-note': 'ReferralNote',
  'care-plan': 'CarePlan',
  'discharge-summary': 'DischargeSummary',
  ccd: 'CCD',
};

export const typeCodeToIdMap: Record<string, string> = {
  '11506-3': 'a-{practice}.progressNote-{id}',
  '28570-0': 'a-{practice}.procedureNote-{id}',
  '10164-2': 'a-{practice}.hpiNote-{id}',
};

// ---------------------------------------------------------------------------
// Search Parameter Lookups
// ---------------------------------------------------------------------------

export function patientLookup(params: Record<string, string | number | boolean>): Record<string, any> {
  const properties: Record<string, any> = {
    dob: params?.birthdate ? moment(params.birthdate as string).format('MM/DD/YYYY') : null,
    lastname: params?.family,
    firstname: params?.given,
    showcustomfields: true,
    departmentid: typeof params?.location === 'string' ? params.location.split('/').pop() : null,
    limit: params?._count,
    offset: params?._getpagesoffset,
  };

  const gp = params?.['general-practitioner'];
  if (typeof gp === 'string') properties.primaryproviderid = gp.split('/').pop();

  return Object.keys(properties).reduce((result: Record<string, any>, key) => {
    const value = properties[key];
    if (value !== undefined && value !== null && value !== '') {
      result[key] = value;
    }
    return result;
  }, {});
}

const appointmentStatusMapping: Record<string, string> = {
  cancelled: 'x',
  noshow: 'f',
  'checked-in': '2',
  fulfilled: '4',
};

export function appointmentLookup(params: Record<string, string | number | boolean>): Record<string, any> {
  const properties: Record<string, any> = {
    date: params?.date,
    providerid: params?.practitioner,
    departmentid: params?.location,
    appointmentid: params?._id,
    patientid: params?.patient,
    limit: params?._count,
    offset: params?._getpagesoffset,
    appointmentstatus: typeof params?.status === 'string' ? appointmentStatusMapping[params.status] : undefined,
  };

  return Object.keys(properties).reduce((result: Record<string, any>, key) => {
    const value = properties[key];
    if (value !== undefined && value !== null && value !== '') {
      result[key] = value;
    }
    return result;
  }, {});
}

function getDateTypeValue(date: string): { key: string; value: string } {
  const prefix = date.slice(0, 2);
  const cleanedDate = date.slice(2);
  switch (prefix) {
    case 'lt':
      return { key: 'enddate', value: moment(cleanedDate).subtract(1, 'day').format('YYYY-MM-DD') };
    case 'ge':
      return { key: 'startdate', value: moment(cleanedDate).format('YYYY-MM-DD') };
    case 'le':
      return { key: 'enddate', value: moment(cleanedDate).format('YYYY-MM-DD') };
    case 'gt':
      return { key: 'startdate', value: moment(cleanedDate).add(1, 'day').format('YYYY-MM-DD') };
    case 'eq':
      return { key: 'startdate', value: moment(cleanedDate).format('YYYY-MM-DD') };
    default:
      return { key: 'startdate', value: moment(cleanedDate).format('YYYY-MM-DD') };
  }
}

function extractDates(date: string, properties: Record<string, any>): void {
  const datePrefixes = ['gt', 'lt', 'ge', 'le'];
  try {
    if (date.includes(',')) {
      const dates = date.split(',');
      for (const d of dates) {
        const { key, value } = getDateTypeValue(d);
        properties[key] = value;
      }
    } else {
      if (date.includes('eq') || !datePrefixes.some((p) => date.startsWith(p))) {
        const clean = date.replace('eq', '');
        properties.startdate = moment(clean).format('YYYY-MM-DD');
        properties.enddate = moment(clean).format('YYYY-MM-DD');
        return;
      }
      const { key, value } = getDateTypeValue(date);
      properties[key] = value;
    }
  } catch (error: any) {
    logger.error('Error in extractDates mapping', error);
  }
}

export function encounterLookup(params: Record<string, string | number | boolean>): Record<string, any> {
  const properties: Record<string, any> = {
    departmentid: params?.location,
    appointmentid: params?.appointment,
    limit: params?._count || 50,
    offset: params?._getpagesoffset || 0,
  };

  if (typeof params?.participant === 'string') {
    properties.providerid = params.participant.split('/').pop();
  }

  if (typeof params?.date === 'string') {
    extractDates(params.date, properties);
  } else {
    const currentYear = moment().format('YYYY');
    properties.startdate = `${currentYear}-01-01`;
    properties.enddate = moment().format('YYYY-MM-DD');
  }

  return Object.keys(properties).reduce((result: Record<string, any>, key) => {
    const value = properties[key];
    if (value !== undefined && value !== null && value !== '') {
      result[key] = value;
    }
    return result;
  }, {});
}

export function allergySearch(params: Record<string, any> | null, siteData: SiteData): Record<string, any> {
  return {
    patient: params?.patient ? `a-${siteData.accountId}.E-${params.patient}` : '',
    'ah-practice': `Organization/a-1.Practice-${siteData?.accountId}`,
    category: params?.category || undefined,
    _count: params?._count,
    code: params?.code,
    cursor: params?.cursor,
    _id: params?._id,
    family: params?.family,
    given: params?.given,
    birthdate: params?.birthdate,
    type: params?.type,
  };
}

export function fhirMappings(params: Record<string, any>, siteData: SiteData): Record<string, any> {
  return {
    patient: params?.patient ? `a-${siteData.accountId}.E-${params.patient}` : undefined,
    'ah-practice': `Organization/a-1.Practice-${siteData?.accountId}`,
  };
}

export function buildPractitionerName(params: Record<string, any>): string {
  const parts: string[] = [];
  if (params?.given) parts.push(String(params.given).trim());
  if (params?.family) parts.push(String(params.family).trim());
  return parts.join(' ');
}

export async function conditionDataExtraction(data: Condition): Promise<{
  data: URLSearchParams;
  encounter: string | null;
  diagnoses: string | null;
  patient: string | null;
  department: string | null;
}> {
  const extracted = {
    data: new URLSearchParams(),
    encounter: data?.encounter?.reference?.split('/')?.pop() ?? null,
    diagnoses: data?.id?.split('-')?.pop() ?? null,
    patient: data?.subject?.reference?.split('/')?.pop() ?? null,
    department: null as string | null,
  };

  extracted.data.append('note', data?.note?.[0]?.text ?? '');
  const snomedcode = data?.code?.coding?.find((c) => c?.system === CODING_URLS.snomed)?.code;
  extracted.department =
    data?.identifier
      ?.find((idf) => idf.system?.includes('department'))
      ?.value?.split('/')
      ?.pop() ?? null;

  if (extracted.department) extracted.data.append('departmentid', extracted.department);
  if (!snomedcode) throw new Error('SNOMED code is required');

  const icdCodes: string[] = [];
  data?.code?.coding?.forEach((code) => {
    if (code?.system === CODING_URLS.icd10 && code.code) icdCodes.push(code.code);
  });

  extracted.data.append('icd10codes', icdCodes.join(','));
  extracted.data.append('snomedcode', snomedcode);

  return extracted;
}

// ---------------------------------------------------------------------------
// Mapper Utilities
// ---------------------------------------------------------------------------

export class MapperUtils {
  convertFhirToRequestBody(fhirPatient: Patient): Record<string, string> {
    const requestBody: Record<string, string> = {};
    requestBody.firstname = fhirPatient.name?.[0]?.given?.[0] || '';
    requestBody.lastname = fhirPatient.name?.[0]?.family || '';

    const address = fhirPatient.address?.[0] || {};
    requestBody.address1 = address.line ? address.line[0] : '';
    requestBody.address2 = address.line?.[1] ?? '';
    requestBody.city = address.city || '';
    requestBody.state = address.state || '';
    requestBody.postalcode = address.postalCode || '';
    requestBody.countrycode3166 = address.country || '';

    const telecom = fhirPatient.telecom?.find((t) => t.system === 'phone' && t.use === 'home');
    requestBody.homephone = telecom ? telecom.value || '' : '';
    requestBody.dob = fhirPatient.birthDate ? moment(fhirPatient.birthDate).format('MM/DD/YYYY') : '';

    const genderMap: Record<string, string> = { male: 'M', female: 'F', other: 'N', unknown: 'U' };
    requestBody.assignedsexatbirth = genderMap[fhirPatient.gender || 'unknown'] || 'U';

    const maritalStatus = fhirPatient.maritalStatus?.coding?.[0]?.code || 'UNK';
    requestBody.maritalstatus = maritalStatus === 'UNK' ? 'U' : maritalStatus;

    fhirPatient.extension?.forEach((ext) => {
      if (ext.url === 'http://athenaNet/fhir/StructureDefinition/departmentid') {
        requestBody.departmentid = String(ext.valueString || '');
      }
    });

    return requestBody;
  }

  convertInsuranceToCoverage(insurance: AthenaInsurance, patientId: string): Coverage {
    return {
      resourceType: 'Coverage',
      id: String(insurance.insuranceid),
      status: (coverageStatusMapping[insurance.eligibilitystatus as string] || 'active') as Coverage['status'],
      type: { text: insurance.insuranceplandisplayname },
      subscriber: insurance?.insurancepolicyholder ? { display: insurance.insurancepolicyholder } : undefined,
      beneficiary: { reference: patientId, type: 'Patient' },
      payor: [
        {
          reference: insurance?.insurancepackagepayerid || insurance?.insuredidnumber,
          display: insurance?.insurancepayername,
          type: 'Organization',
        },
      ],
      subscriberId: insurance?.insuranceidnumber,
      relationship: { text: insurance.relationshiptoinsured?.toLowerCase() },
      period: { start: insurance.created, end: insurance?.expirationdate },
      identifier: [{ system: 'http://example.org/insuranceid', value: String(insurance?.insuranceid) }],
    };
  }

  convertPatientToFhir(patient: AthenaPatient, practiceId: string): Patient {
    const { homephone, mobilephone } = patient || {};
    const telecom: ContactPoint[] = [];
    if (typeof homephone === 'string')
      telecom.push({
        system: 'phone',
        value: `(${homephone.slice(0, 3)}) ${homephone.slice(3, 6)}-${homephone.slice(6)}`,
        use: 'home',
      });
    if (typeof mobilephone === 'string')
      telecom.push({
        system: 'phone',
        value: `(${mobilephone.slice(0, 3)}) ${mobilephone.slice(3, 6)}-${mobilephone.slice(6)}`,
        use: 'mobile',
      });

    const identifier: Identifier[] = [];
    const mrn = patient?.customfields?.find((p) => p.customfieldid === '21');
    if (mrn) identifier.push({ system: CODING_URLS.athena.mrn(practiceId), value: mrn.customfieldvalue });
    if (typeof patient?.ssn === 'string') identifier.push({ system: CODING_URLS.ssn, value: patient.ssn });
    identifier.push({ system: CODING_URLS.athena.patientIdentifier, value: `a-${practiceId}.E-${patient.patientid}` });

    return {
      resourceType: 'Patient',
      id: String(patient.patientid),
      meta: { lastUpdated: patient?.lastupdated as string },
      identifier,
      name: [{ use: 'official', family: patient.lastname, given: [patient.firstname] }],
      telecom,
      gender: genderMappings[patient.sex as string] || 'unknown',
      birthDate: patient.dob as string,
      address: [
        {
          use: 'home',
          line: [patient?.address1?.toUpperCase() || ''],
          city: patient?.city?.toUpperCase(),
          state: patient?.state?.toUpperCase(),
          postalCode: patient?.zip as string,
        },
      ],
      active: patient.status === 'active',
      generalPractitioner: patient?.primaryproviderid
        ? [{ reference: String(patient.primaryproviderid), type: 'Practitioner' }]
        : [],
    };
  }

  async convertPatientEhrToFhir(
    patientData: AthenaPatient | AthenaPatient[],
    practiceId: string,
    includeCoverage: boolean,
    isBundle = false,
  ): Promise<Bundle<Patient> | Patient> {
    const patients = Array.isArray(patientData) ? patientData : [patientData];
    const entries = patients.map((p) => ({
      fullUrl: `${process.env.ENVIRONMENT}/api/fhir/r4/v1/Patient/${p.patientid}`,
      resource: this.convertPatientToFhir(p, practiceId),
    }));
    const bundle: Bundle<Patient> = {
      resourceType: 'Bundle',
      type: 'searchset',
      total: entries.length,
      entry: entries,
    };

    if (includeCoverage && !isBundle && patients[0]?.insurances) {
      patients[0].insurances.forEach((ins) => {
        bundle.entry?.push({
          fullUrl: `${process.env.ENVIRONMENT}/api/fhir/r4/v1/Coverage/${ins.insuranceid}`,
          resource: this.convertInsuranceToCoverage(ins, entries[0].resource?.id || '') as any,
        });
      });
      bundle.total = bundle.entry?.length || 0;
      return bundle;
    }
    return isBundle ? bundle : (bundle.entry?.[0]?.resource as Patient);
  }

  private readonly appointStatusMap: Record<string, Appointment['status']> = Object.freeze({
    x: 'cancelled',
    f: 'noshow',
    o: 'booked',
    '2': 'checked-in',
    '3': 'fulfilled',
    '4': 'fulfilled',
  });

  convertAppointmentToFhir(appointment: AthenaAppointment, patientId?: string): Appointment {
    return {
      resourceType: 'Appointment',
      id: String(appointment.appointmentid),
      status: this.appointStatusMap[appointment?.appointmentstatus] || 'booked',
      appointmentType: {
        coding: [{ system: CODING_URLS.appointmentType, display: appointment.patientappointmenttypename }],
        text: appointment.appointmenttype,
      },
      start: appointment?.startcheckin || appointment?.scheduleddatetime,
      end: appointment?.stopexamdatetime,
      minutesDuration: appointment.duration,
      participant: [
        { actor: { reference: `Practitioner/${appointment.providerid}`, type: 'Practitioner' }, status: 'accepted' },
        { actor: { reference: `Patient/${appointment.patientid || patientId}`, type: 'Patient' }, status: 'accepted' },
        { actor: { reference: `Location/${appointment.departmentid}`, type: 'Location' }, status: 'accepted' },
      ],
    };
  }

  async convertAppointmentEhrToFhir(
    appointmentData: AthenaAppointment | AthenaAppointment[],
    patientId: string | null,
    isBundle = false,
  ): Promise<Bundle<Appointment> | Appointment> {
    const appointments = Array.isArray(appointmentData) ? appointmentData : [appointmentData];
    const entries = appointments.map((a) => ({
      fullUrl: `${process.env.ENVIRONMENT}/api/fhir/r4/v1/Appointment/${a.appointmentid}`,
      resource: this.convertAppointmentToFhir(a, patientId || undefined),
    }));
    const bundle: Bundle<Appointment> = {
      resourceType: 'Bundle',
      type: 'searchset',
      total: entries.length,
      entry: entries,
    };
    return isBundle ? bundle : (bundle.entry?.[0]?.resource as Appointment);
  }

  async convertEncountersEhrToFhir(
    encounters: AthenaEncounter | AthenaEncounter[],
    patientId: string | null,
    practiceId: string,
    isBundle = false,
  ): Promise<Bundle<Encounter> | Encounter> {
    const encounterArray = Array.isArray(encounters) ? encounters : [encounters];
    const entries = encounterArray.map((e) => ({
      fullUrl: `${process.env.ENVIRONMENT}/api/fhir/r4/v1/Encounter/${e.encounterid}`,
      resource: {
        resourceType: 'Encounter',
        id: String(e.encounterid),
        status: encounterStatusMapping[e.status] || 'finished',
        subject: { reference: patientId ? `Patient/${patientId}` : undefined, type: 'Patient' },
        period: { start: e.appointmentstartdate },
        participant: [{ individual: { reference: `Practitioner/${e.providerid}`, type: 'Practitioner' } }],
        location: [{ location: { reference: `Location/${e.departmentid}`, type: 'Location' } }],
      } as Encounter,
    }));
    const bundle: Bundle<Encounter> = {
      resourceType: 'Bundle',
      type: 'searchset',
      total: entries.length,
      entry: entries,
    };
    return isBundle ? bundle : (bundle.entry?.[0]?.resource as Encounter);
  }

  async convertEncounterDiagnosesFhirToEhr(body: Encounter, isProblem = false): Promise<Record<string, any>> {
    const snomed = body?.type?.[0]?.coding?.find((c) => c.system === CODING_URLS.snomed)?.code;
    return { snomedcode: snomed, note: body?.text?.div, isproblem: isProblem };
  }

  async convertCoverageEhrToFhir(
    insuranceData: AthenaInsurance | AthenaInsurance[],
    patientId: string,
    isBundle = false,
  ): Promise<Bundle<Coverage> | Coverage> {
    const insurances = Array.isArray(insuranceData) ? insuranceData : [insuranceData];
    const entries = insurances.map((ins) => ({
      fullUrl: `${process.env.ENVIRONMENT}/api/fhir/r4/v1/Coverage/${ins.insuranceid}`,
      resource: this.convertInsuranceToCoverage(ins, `Patient/${patientId}`),
    }));
    const bundle: Bundle<Coverage> = {
      resourceType: 'Bundle',
      type: 'searchset',
      total: entries.length,
      entry: entries,
    };
    return isBundle ? bundle : (bundle.entry?.[0]?.resource as Coverage);
  }

  async convertCoverageFhirToEhr(body: Coverage): Promise<Record<string, any>> {
    return { insuranceidnumber: body.subscriberId, insurancepayername: body.payor?.[0]?.display };
  }

  async checkExistingConditions(
    fhirResponse: Bundle<Condition>,
    snomedCode: string,
    encounterId: string,
  ): Promise<any> {
    const entry = fhirResponse?.entry || [];
    const encounterDiagnosisExists = entry.some(
      (e) =>
        e.resource?.encounter?.reference?.includes(encounterId) &&
        e.resource?.code?.coding?.some((c) => c.code === snomedCode),
    );
    return { encounterDiagnosisExists, problemExists: false };
  }

  async generateConditionResponse(responses: any[], check: any): Promise<any> {
    return { status: 'success', created: responses.length, alreadyExisted: check };
  }

  async createCommunicationBody(body: Communication, _siteData: SiteData): Promise<Record<string, any>> {
    return { alerttext: body.payload?.[0]?.contentString };
  }

  async convertDocumentRefToNote(
    body: DocumentReference,
  ): Promise<{ body: URLSearchParams; encounter: string | null }> {
    const encounter = body.context?.encounter?.[0]?.reference?.split('/').pop() || null;
    const params = new URLSearchParams();
    params.append('notetext', body.content?.[0]?.attachment?.data || '');
    return { body: params, encounter };
  }

  async convertDocumentReferenceFhirToEhr(body: DocumentReference): Promise<Record<string, any>> {
    return { documenttype: body.type?.coding?.[0]?.code };
  }

  async convertFhirToIb<T extends Resource>(fhirObject: Bundle<T>, siteData: SiteData): Promise<Bundle<T>> {
    if (fhirObject.entry) {
      fhirObject.entry = fhirObject.entry.map((entry) => {
        if (entry.resource) this.filterResource(entry.resource);
        return entry;
      });
    }
    return fhirObject;
  }

  filterResource(resource: Resource): void {
    if (resource.id) resource.id = resource.id.split('-').pop();
  }

  async convertDepartmentToLocation(departments: AthenaDepartment[]): Promise<Bundle<Location>> {
    const entries = departments.map((d) => ({
      fullUrl: `${process.env.ENVIRONMENT}/api/fhir/r4/v1/Location/${d.departmentid}`,
      resource: { resourceType: 'Location', id: String(d.departmentid), name: d.name } as Location,
    }));
    return { resourceType: 'Bundle', type: 'searchset', total: entries.length, entry: entries };
  }

  async convetPractitionerEhrToFhir(
    practitioners: any | any[],
    _accountId: string,
    isBundle = false,
  ): Promise<Bundle<Practitioner> | Practitioner> {
    const pracs = Array.isArray(practitioners) ? practitioners : [practitioners];
    const entries = pracs.map((p) => ({
      fullUrl: `${process.env.ENVIRONMENT}/api/fhir/r4/v1/Practitioner/${p.providerid}`,
      resource: {
        resourceType: 'Practitioner',
        id: String(p.providerid),
        name: [{ family: p.lastname, given: [p.firstname] }],
      } as Practitioner,
    }));
    const bundle: Bundle<Practitioner> = {
      resourceType: 'Bundle',
      type: 'searchset',
      total: entries.length,
      entry: entries,
    };
    return isBundle ? bundle : (bundle.entry?.[0]?.resource as Practitioner);
  }

  async converAllergyFhirToEhr(body: AllergyIntolerance): Promise<Record<string, any>> {
    return { allergyid: body.code?.coding?.[0]?.code };
  }

  async convertProblemToFhirCondition(problems: { problems: any[] }, patientId: string): Promise<Bundle<Condition>> {
    const items = problems?.problems || [];
    const entries = items.map((p) => ({
      fullUrl: `${process.env.ENVIRONMENT}/api/fhir/r4/v1/Condition/${p.problemid}`,
      resource: {
        resourceType: 'Condition',
        id: String(p.problemid),
        subject: { reference: `Patient/${patientId}` },
        code: { text: p.displayname },
      } as Condition,
    }));
    return { resourceType: 'Bundle', type: 'searchset', total: entries.length, entry: entries };
  }

  async convertFhirPatientToEhr(fhirBundle: Bundle<Patient>, _siteData: SiteData): Promise<Bundle<Practitioner>> {
    return fhirBundle as unknown as Bundle<Practitioner>;
  }
}

export const mapperUtils = new MapperUtils();

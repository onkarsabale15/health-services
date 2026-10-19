// ---------------------------------------------------------------------------
// NextGen EHR — FHIR converters and EHR body builders
// Ported from util/ehr/nextgen.js + module/nextgen/*.js
// ---------------------------------------------------------------------------

import { logger } from '@hs/observability';

// ---------------------------------------------------------------------------
// Lookup helpers (module/nextgen/appointment.js, patient.js)
// ---------------------------------------------------------------------------

export const nextgenWorkFlowStatusMapping: Record<string, string> = Object.freeze({
  SCHEDULED: 'booked',
  BOOKED: 'booked',
  WAITLIST: 'waitlist',
  'BLOCK SLOT': 'entered-in-error',
  'CHECKED IN': 'checked-in',
  'CHECKED OUT': 'fulfilled',
  LATE: 'pending',
  KEPT: 'fulfilled',
  NOSHOW: 'noshow',
  CANCELLED: 'cancelled',
  'RESET STATUS': 'pending',
});

export const nextgenCriticalityMapping: Record<string, string> = Object.freeze({
  CRITH: 'high',
  CRITL: 'low',
});

export const nextgenGenderMapping: Record<string, string> = {
  M: 'male',
  F: 'female',
};

/** Convert FHIR appointment search params to NextGen non-FHIR API params */
export function nextgenAppointmentLookup(params: Record<string, any>): Record<string, any> {
  const properties: Record<string, any> = {
    date: params?.date,
    id: params?._id,
    personId: params?.patient,
  };

  return Object.keys(properties).reduce((result: Record<string, any>, key) => {
    const value = properties[key];
    if (value !== undefined && value !== null && value !== '') {
      result[key] = value;
    }
    return result;
  }, {});
}

// ---------------------------------------------------------------------------
// NextgenUtils class — all converters
// ---------------------------------------------------------------------------

export class NextgenUtils {
  // -------------------------------------------------------------------------
  // Appointment converters
  // -------------------------------------------------------------------------

  convertAppointmentToFhir({ appointment }: { appointment: any }): any {
    let status: string;
    if (appointment.isCancelled) {
      status = 'cancelled';
    } else if (appointment.isNoShow) {
      status = 'noshow';
    } else if (appointment.isKept) {
      status = 'fulfilled';
    } else {
      status = nextgenWorkFlowStatusMapping[appointment.workflowStatus] ?? 'booked';
    }

    const resource: any = {
      resourceType: 'Appointment',
      id: String(appointment.id),
      meta: { lastUpdated: appointment?.modifyTimestamp },
      status,
      description: appointment.description,
      minutesDuration: appointment.duration,
      comment: appointment.details,
      participant: [
        { actor: { reference: String(appointment.renderingProviderId), type: 'Practitioner' } },
        { actor: { reference: String(appointment.personId), type: 'Patient' } },
        { actor: { reference: String(appointment.practiceId), type: 'Organization' } },
      ],
    };

    if (appointment.beginTime !== undefined) {
      resource.start = new Date(new Date(appointment.appointmentDate).getTime() + appointment.beginTime * 60000);
    }
    if (appointment.endTime !== undefined) {
      resource.end = new Date(new Date(appointment.appointmentDate).getTime() + appointment.endTime * 60000);
    }

    return resource;
  }

  async convertAppointmentEhrToFhir(response: any, isBundle = false): Promise<any> {
    try {
      const appointments = response?.items || [response];
      const entries = appointments.map((appointment: any) => ({
        fullUrl: `${process.env.ENVIRONMENT}/api/fhir/r4/v1/Appointment/${appointment.id}`,
        resource: this.convertAppointmentToFhir({ appointment }),
      }));
      const bundle: any = {
        resourceType: 'Bundle',
        type: 'searchset',
        total: entries.length,
        entry: entries,
      };
      return isBundle ? bundle : bundle.entry[0]?.resource;
    } catch (error: any) {
      logger.error('NextgenUtils ~ convertAppointmentEhrToFhir', error);
      throw error;
    }
  }

  // -------------------------------------------------------------------------
  // Patient converters
  // -------------------------------------------------------------------------

  async convertPatientFhirToEhr(fhirPatient: any): Promise<Record<string, any>> {
    try {
      const socialSecurityNumber =
        fhirPatient.identifier?.find((id: any) => id?.system === 'http://hl7.org/fhir/sid/us-ssn')?.value ?? null;

      return {
        firstName: fhirPatient.name[0].given[0],
        lastName: fhirPatient.name[0].family,
        middleName: fhirPatient.name[0].given[1] || null,
        addressLine1: fhirPatient.address[0].line[0],
        city: fhirPatient.address[0].city,
        state: fhirPatient.address[0].state,
        zip: fhirPatient.address[0].postalCode,
        cellPhone: fhirPatient.telecom[0].system === 'phone' ? fhirPatient.telecom[0].value : null,
        sex: fhirPatient.gender.split('')[0].toUpperCase(),
        dateOfBirth: fhirPatient.birthDate,
        socialSecurityNumber,
        preferredLanguage: (fhirPatient.communication?.find((comm: any) => comm.language) as any)?.[0]?.display ?? null,
        currentGender: fhirPatient.gender.split('')[0].toUpperCase(),
        showContactInfoOnAlert: false,
        hasPhoneNumber: true,
        isPatient: true,
        ignoreDuplicatePersons: true,
        isEnterpriseChart: true,
      };
    } catch (error: any) {
      logger.error('NextgenUtils ~ convertPatientFhirToEhr', error);
      throw new Error('Internal Server Error');
    }
  }

  // -------------------------------------------------------------------------
  // Condition converters
  // -------------------------------------------------------------------------

  async convertConditionFhirToEHR(condition: any): Promise<Record<string, any>> {
    const conditionObj: Record<string, any> = {};
    if (condition?.resourceType === 'Condition') {
      conditionObj.IcdCode = condition?.code?.coding[0]?.code;
      const personId = condition?.subject?.reference?.split('/')[1];
      conditionObj.Interactions = [
        {
          personId,
          description: condition?.code?.coding[0]?.display,
        },
      ];
    }
    return conditionObj;
  }

  // -------------------------------------------------------------------------
  // Coverage converters
  // -------------------------------------------------------------------------

  async convertCoverageToEHR(data: any): Promise<Record<string, any>> {
    try {
      const copay = data?.extension?.find((ext: any) => ext?.url?.split('/').includes('copay-amount'));
      return {
        payerId: data?.payor?.[0]?.reference?.split('/')?.pop() ?? null,
        planName: data?.class?.find((cls: any) => cls?.type?.coding[0]?.code === 'plan')?.name ?? null,
        isActive: data?.status === 'active',
        copayType: 'Amount',
        copayAmount: copay?.valueMoney?.value ?? null,
        policyEffectiveDate: data?.period?.start ?? null,
        policyExpirationDate: data?.period?.end ?? null,
        policyNumber: data?.identifier?.[0]?.value ?? null,
        planNumber: data?.class?.find((cls: any) => cls?.type?.coding[0]?.code === 'plan')?.value ?? null,
        requiresNotification: true,
        requiresVerification: true,
        isMedicalCoverage: true,
        allowDuplicateInsurance: true,
        defaultCob: data?.priority?.value ?? null,
        isAvailable: true,
      };
    } catch (error: any) {
      logger.error('NextgenUtils ~ convertCoverageToEHR', error);
      throw new Error('Internal Server Error');
    }
  }

  // -------------------------------------------------------------------------
  // Allergy body builder
  // -------------------------------------------------------------------------

  async getAllergyBody(data: any): Promise<Record<string, any>> {
    try {
      return {
        allergyId: data?.code?.coding[0]?.code,
        allergyTypeId:
          data?.code?.coding?.find((code: any) => code.system.split('/').pop() === 'allergy-type-id')?.code ?? null,
        onsetDate: '2024-11-29T10:05:56.482Z',
        resolvedDate: '2024-11-29T10:05:56.482Z',
        comment: data?.note?.[0]?.text,
        providerId: data?.note?.[0]?.authorReference?.reference?.split('/').pop(),
        isIntolerant: true,
        isRecordedElsewhere: false,
        allowDuplicateAllergies: false,
        noKnownAllergies: false,
        criticalityCode: data?.criticality,
        allergyClinicalStatus: data?.clinicalStatus?.coding[0]?.code,
        allergyVerificationStatus: data?.verificationStatus?.coding[0]?.code,
      };
    } catch (error: any) {
      logger.error('NextgenUtils ~ getAllergyBody', error);
      throw new Error('Internal Server Error');
    }
  }

  // -------------------------------------------------------------------------
  // SOAP Notes <-> DocumentReference
  // -------------------------------------------------------------------------

  async notesToFhir(input: any): Promise<any> {
    return {
      resourceType: 'DocumentReference',
      id: String(input.encounterId),
      status: 'current',
      type: {
        coding: [
          {
            system: 'http://hl7.org/fhir/us/core/CodeSystem/document-type',
            code: 'SOAP',
            display: 'SOAP Note',
          },
        ],
        text: 'SOAP Note',
      },
      subject: {
        reference: `Patient/${input.personId}`,
        display: 'Patient',
      },
      context: {
        encounter: {
          reference: `Encounter/${input.encounterId}`,
          display: 'Encounter Details',
        },
      },
      author: [
        {
          reference: `Practitioner/${input.createdBy}`,
          display: 'Author',
        },
      ],
      date: input.createTimestampUtc,
      content: [
        {
          attachment: {
            contentType: 'text/plain',
            data: Buffer.from(input.historyOfPresentIllnessNarrative ?? '', 'utf-8').toString('base64'),
            title: 'History of Present Illness',
          },
        },
        {
          attachment: {
            contentType: 'text/plain',
            data: Buffer.from(input.historiesNarrative ?? '', 'utf-8').toString('base64'),
            title: 'Histories',
          },
        },
        {
          attachment: {
            contentType: 'text/plain',
            data: Buffer.from(input.reviewOfSystemsNarrative ?? '', 'utf-8').toString('base64'),
            title: 'Review of Systems',
          },
        },
      ],
      meta: {
        lastUpdated: input.modifyTimestampUtc,
      },
    };
  }

  async fhirDocumentReferenceToNotes(fhir: any): Promise<Record<string, any>> {
    try {
      const decodeBase64 = (data: string | undefined): string | null =>
        data ? Buffer.from(data, 'base64').toString('utf-8') : null;

      return {
        historyOfPresentIllnessNarrative: decodeBase64(
          fhir.content?.find((c: any) => c?.attachment?.title === 'History of Present Illness')?.attachment?.data,
        ),
        historiesNarrative: decodeBase64(
          fhir.content?.find((c: any) => c?.attachment?.title === 'Histories')?.attachment?.data,
        ),
        reviewOfSystemsNarrative: decodeBase64(
          fhir.content?.find((c: any) => c?.attachment?.title === 'Review of Systems')?.attachment?.data,
        ),
      };
    } catch (error: any) {
      logger.error('NextgenUtils ~ fhirDocumentReferenceToNotes', error);
      throw new Error('Invalid FhirDocumentReference');
    }
  }

  // -------------------------------------------------------------------------
  // Communication / Alerts
  // -------------------------------------------------------------------------

  async communicationToAlert(data: any): Promise<Record<string, any>> {
    try {
      const userDescription = data?.payload?.[0]?.contentAttachment?.data
        ? Buffer.from(data.payload[0].contentAttachment.data, 'base64').toString('utf-8')
        : '';
      return {
        // Alert type IDs are configured per NextGen practice
        AlertTypeId: process.env.NEXTGEN_ALERT_TYPE_ID ?? '',
        Comment: `${data?.topic?.text}`,
        IsFlagged: data?.preferred,
        UserDescription: userDescription,
      };
    } catch (error: any) {
      logger.error('NextgenUtils ~ communicationToAlert', error);
      throw new Error(error?.message || 'Got into error while processing the request.');
    }
  }

  async alertToFhirCommunication(data: any, isBundle = false): Promise<any> {
    try {
      const entries = data?.items?.map((alert: any) => ({
        fullUrl: `${process.env.ENVIRONMENT}/api/fhir/r4/v1/Communication/${alert?.id}?patient=${alert?.personId}`,
        resource: {
          resourceType: 'Communication',
          id: alert.id,
          status: 'completed',
          preferred: alert?.isFlagged,
          category: [
            {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/communication-category',
                  code: 'notification',
                },
              ],
            },
          ],
          subject: { reference: `Patient/${alert?.personId}` },
          topic: [{ text: alert?.comment }],
          payload: [
            {
              contentType: 'text/plain',
              data: alert?.description ? Buffer.from(alert.description, 'utf-8').toString('base64') : '',
            },
          ],
        },
      }));

      if (isBundle) {
        return {
          resourceType: 'Bundle',
          total: entries?.length ?? 0,
          type: 'searchset',
          entry: entries ?? [],
        };
      }
      return entries?.[0];
    } catch (error: any) {
      logger.error('NextgenUtils ~ alertToFhirCommunication', error);
      throw new Error('Internal Server Error');
    }
  }

  // -------------------------------------------------------------------------
  // Misc helpers
  // -------------------------------------------------------------------------

  updateFhirResourceWithEvent(fhirResource: any, event: any): void {
    if (event.source === 'ENCOUNTER' && event.eventtype === 'START') {
      fhirResource.encounter = { reference: `Encounter/${fhirResource.id}` };
      fhirResource.startDate = event.startdate;
    }
    fhirResource.note = event.note || null;
  }

  extractToken(connectionData: any): string {
    const token = connectionData?.accessToken;
    if (!token) throw new Error('Invalid ConnectionId');
    return token;
  }
}

export const nextgenUtils = new NextgenUtils();

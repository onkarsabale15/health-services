// cerner.mapper.ts
// Link rewriting and param mapping utilities for the Cerner FHIR integration.
//
// convertEhrLinks        — rewrites Cerner bundle pagination links and entry fullUrls to
//                          the internal API gateway URL. Also maps Cerner's "continue"
//                          pagination token to the IB "_getpagesoffset" convention.
// Resource-specific search param mappers — each mapper knows which FHIR search
// parameters Cerner supports for that resource type, filtering out undefined values.

/** Removes keys whose value is undefined, null, or empty string. */
function cleanParams(params: Record<string, string | undefined>): Record<string, string> {
  const cleaned: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

/** Common pagination/base params used by Cerner across all resources */
function basePagination(params: Record<string, any>): Record<string, string | undefined> {
  return {
    _id: params._id,
    _count: params._count,
    _sort: params._sort,
  };
}

export function convertEhrLinks(fhirObj: any): any {
  try {
    const { link, entry } = fhirObj ?? {};

    if (link) {
      link.forEach((linkObj: any) => {
        linkObj.url = `${process.env.ENVIRONMENT}/api/fhir/r4/v1/${linkObj.url
          .split('/')
          .pop()
          .replace('continue', '_getpagesoffset')}`;
      });
    }

    if (entry) {
      entry.forEach((entryObj: any) => {
        const parts = entryObj.fullUrl.split('/');
        const resourceId = parts.pop();
        const resourceType = parts.pop();
        entryObj.fullUrl = `${process.env.ENVIRONMENT}/api/fhir/r4/v1/${resourceType}/${resourceId}`;
      });
    }

    return fhirObj;
  } catch (error: any) {
    throw new Error(error);
  }
}

// --- Resource-specific search param mappers ---

/** Patient search — Cerner R4 */
export function cernerPatientSearch(params: Record<string, any>): Record<string, string> {
  return cleanParams({
    ...basePagination(params),
    family: params.family,
    given: params.given,
    name: params.name,
    birthdate: params.birthdate,
    gender: params.gender,
    identifier: params.identifier,
    'address-postalcode': params['address-postalcode'],
    phone: params.phone,
    email: params.email,
    active: params.active,
  });
}

/** AllergyIntolerance search — Cerner R4 */
export function cernerAllergySearch(params: Record<string, any>): Record<string, string> {
  return cleanParams({
    ...basePagination(params),
    patient: params.patient,
    'clinical-status': params['clinical-status'],
    date: params.date,
  });
}

/** Condition search — Cerner R4 */
export function cernerConditionSearch(params: Record<string, any>): Record<string, string> {
  return cleanParams({
    ...basePagination(params),
    patient: params.patient,
    'clinical-status': params['clinical-status'],
    category: params.category,
    code: params.code,
    encounter: params.encounter,
    subject: params.subject,
  });
}

/**
 * Normalize a FHIR date param for Cerner:
 * 1. Cerner requires a prefix (ge, le, etc.) — bare dates are rejected.
 *    If no prefix, default to `ge` (from this date onward).
 * 2. Cerner requires full ISO datetime, not date-only.
 *    `ge2026-04-06` → `ge2026-04-06T00:00:00.000Z`
 */
function normalizeDateParam(value: string | undefined): string | undefined {
  if (!value) return undefined;
  // Match optional prefix + date-only (YYYY-MM-DD)
  const match = value.match(/^(ge|le|gt|lt|eq|ne|sa|eb|ap)?(\d{4}-\d{2}-\d{2})$/);
  if (match) {
    const prefix = match[1] || 'ge'; // default to 'ge' when no prefix
    return `${prefix}${match[2]}T00:00:00.000Z`;
  }
  return value;
}

/** Appointment search — Cerner R4 */
export function cernerAppointmentSearch(params: Record<string, any>): Record<string, string> {
  return cleanParams({
    ...basePagination(params),
    patient: params.patient,
    date: normalizeDateParam(params.date),
    status: params.status,
    practitioner: params.practitioner,
    location: params.location,
    'service-type': params['service-type'],
  });
}

/** Encounter search — Cerner R4 */
export function cernerEncounterSearch(params: Record<string, any>): Record<string, string> {
  return cleanParams({
    ...basePagination(params),
    patient: params.patient,
    date: normalizeDateParam(params.date),
    appointment: params.appointment,
    status: params.status,
    class: params.class,
    type: params.type,
    account: params.account,
    identifier: params.identifier,
    subject: params.subject,
    _lastUpdated: params._lastUpdated,
    _revinclude: params._revinclude,
  });
}

/** Coverage search — Cerner R4. Maps "encounter" → "-encounter" (Cerner custom modifier). */
export function cernerCoverageSearch(params: Record<string, any>): Record<string, string> {
  return cleanParams({
    ...basePagination(params),
    patient: params.patient,
    '-encounter': params.encounter,
    beneficiary: params.beneficiary,
    subscriber: params.subscriber,
    status: params.status,
  });
}

/** Practitioner search — Cerner R4 */
export function cernerPractitionerSearch(params: Record<string, any>): Record<string, string> {
  return cleanParams({
    ...basePagination(params),
    family: params.family,
    given: params.given,
    name: params.name,
    identifier: params.identifier,
    active: params.active,
  });
}

/** Observation search — Cerner R4 */
export function cernerObservationSearch(params: Record<string, any>): Record<string, string> {
  return cleanParams({
    ...basePagination(params),
    patient: params.patient,
    category: params.category,
    code: params.code,
    date: params.date,
    subject: params.subject,
  });
}

/** ServiceRequest search — Cerner R4 */
export function cernerServiceRequestSearch(params: Record<string, any>): Record<string, string> {
  return cleanParams({
    ...basePagination(params),
    patient: params.patient,
    status: params.status,
    category: params.category,
    code: params.code,
    _lastUpdated: params._lastUpdated,
    authored: params.authored,
    occurrence: params.occurrence,
  });
}

/** Communication search — Cerner R4 */
export function cernerCommunicationSearch(params: Record<string, any>): Record<string, string> {
  return cleanParams({
    ...basePagination(params),
    patient: params.patient,
    category: params.category,
    received: params.received,
    sender: params.sender,
    recipient: params.recipient,
  });
}

/** DocumentReference search — Cerner R4 */
export function cernerDocumentReferenceSearch(params: Record<string, any>): Record<string, string> {
  return cleanParams({
    ...basePagination(params),
    patient: params.patient,
    type: params.type,
    date: params.date,
    encounter: params.encounter,
    category: params.category,
    period: params.period,
    _lastUpdated: params._lastUpdated,
  });
}

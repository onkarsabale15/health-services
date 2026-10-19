// eclinicalworks.mapper.ts
// Link rewriting, param mapping, and Transaction Bundle utilities for eClinicalWorks FHIR integration.
//
// eClinicalWorks specifics:
//   - Content-Type is 'application/json+fhir' for all reads
//   - All creates are posted as a Transaction Bundle to the base FHIR URL
//   - Base URL contains a {tenant} placeholder filled from connectionData.tenant
//   - MedicationStatement is served via MedicationRequest endpoint
//   - Encounter search uses custom startDate/endDate params (not standard FHIR date modifiers)

import { logger } from '@hs/observability';
import type { ConnectionData } from '@hs/ehr-data-service';

/** Extracts baseUrl and authToken from eClinicalWorks connection data. */
export function getEhrParameter(connectionData: ConnectionData): { baseUrl: string; authToken: string } {
  const { tenant, accessToken, resolvedBaseUrl } = connectionData || {};
  // resolvedBaseUrl was pre-computed by connection.service.ts using the deployment env.
  const rawBase = resolvedBaseUrl ?? 'https://staging-fhir.ecwcloud.com/fhir/r4/{tenant}';
  return {
    baseUrl: rawBase.replace('{tenant}', tenant ?? ''),
    authToken: accessToken,
  };
}

/** Rewrites pagination links and entry fullUrls to point at the internal gateway. */
export function transformBundle(bundle: any): any {
  try {
    const updatedLinks = bundle?.link?.map((li: any) => ({
      relation: li?.relation,
      url: `${process.env.ENVIRONMENT}/api/fhir/r4/v1/${li?.url?.split('/').pop()}`,
    }));

    const updatedEntries = bundle?.entry?.map((ent: any) => {
      const urlParts = ent?.fullUrl?.split('/');
      const id = urlParts?.pop();
      const resource = urlParts?.pop();
      return {
        ...ent,
        fullUrl: `${process.env.ENVIRONMENT}/api/fhir/r4/v1/${resource}/${id}`,
      };
    });

    return {
      ...bundle,
      link: updatedLinks,
      entry: updatedEntries,
    };
  } catch (error: any) {
    logger.error('eClinicalWorks ~ transformBundle ~ error', error);
    throw error;
  }
}

/** Builds the Transaction Bundle wrapping a single FHIR resource for creates. */
export function buildTransactionBundle(resource: any): any {
  return {
    resourceType: 'Bundle',
    id: 'bundle-transaction',
    type: 'transaction',
    entry: [resource],
  };
}

/**
 * Builds the Encounter query endpoint path from date/patient params.
 * eClinicalWorks uses custom startDate/endDate params (not standard FHIR date modifiers).
 */
export function constructEncounterEndpoint(params: Record<string, any>): string {
  const { patient, startDate, endDate } = params;
  let endpoint = '/Encounter?';
  if (startDate) endpoint += `date=ge${startDate}`;
  if (endDate) endpoint += `${startDate ? '&' : ''}date=le${endDate}`;
  if (patient) endpoint += `${startDate || endDate ? '&' : ''}patient=${patient}`;
  return endpoint;
}

// --- Resource-specific search param mappers ---

/** Filter undefined/null/empty values from params object */
function cleanParams(params: Record<string, string | undefined>): Record<string, string> {
  const cleaned: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

/** Common base params used by eCW across resources */
function basePagination(params: Record<string, any>): Record<string, string | undefined> {
  return {
    _id: params._id,
    _count: params._count,
  };
}

/** Patient search — eClinicalWorks R4 */
export function ecwPatientSearch(params: Record<string, any>): Record<string, string> {
  return cleanParams({
    ...basePagination(params),
    name: params.given || params.name,
    family: params.family,
    birthdate: params.birthdate,
    gender: params.gender,
    identifier: params.identifier,
  });
}

/** AllergyIntolerance search — eClinicalWorks R4 */
export function ecwAllergySearch(params: Record<string, any>): Record<string, string> {
  return cleanParams({
    ...basePagination(params),
    patient: params.patient,
    'clinical-status': params['clinical-status'],
  });
}

/** Condition search — eClinicalWorks R4 */
export function ecwConditionSearch(params: Record<string, any>): Record<string, string> {
  return cleanParams({
    ...basePagination(params),
    patient: params.patient,
    category: params.category,
    'clinical-status': params['clinical-status'],
    code: params.code,
  });
}

/** Coverage search — eClinicalWorks R4 */
export function ecwCoverageSearch(params: Record<string, any>): Record<string, string> {
  return cleanParams({
    ...basePagination(params),
    patient: params.patient,
    beneficiary: params.beneficiary,
  });
}

/** Practitioner search — eClinicalWorks R4 (maps given → name) */
export function ecwPractitionerSearch(params: Record<string, any>): Record<string, string> {
  return cleanParams({
    ...basePagination(params),
    name: params.given || params.name,
    family: params.family,
    identifier: params.identifier,
  });
}

/** Observation search — eClinicalWorks R4 */
export function ecwObservationSearch(params: Record<string, any>): Record<string, string> {
  return cleanParams({
    ...basePagination(params),
    patient: params.patient,
    category: params.category,
    code: params.code,
    date: params.date,
  });
}

/** DocumentReference search — eClinicalWorks R4 */
export function ecwDocumentReferenceSearch(params: Record<string, any>): Record<string, string> {
  return cleanParams({
    ...basePagination(params),
    patient: params.patient,
    type: params.type,
    date: params.date,
    category: params.category,
  });
}

/** MedicationStatement search — eClinicalWorks R4 (maps to MedicationRequest) */
export function ecwMedicationStatementSearch(params: Record<string, any>): Record<string, string> {
  return cleanParams({
    ...basePagination(params),
    patient: params.patient,
    status: params.status,
    code: params.code,
  });
}

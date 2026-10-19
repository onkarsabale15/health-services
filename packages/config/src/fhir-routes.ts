import { FhirRouteEntry, RouteScopeEntry, RouteCheckResult } from './config.types';

// ─── Single Source of Truth: every FHIR route, its scope, and EHR support ────

const ALL_EHRS = [
  'epic',
  'cerner',
  'athenanet',
  'nextgen',
  'eclinicalworks',
  'drchrono',
  'elation',
  'meditech',
  'medent',
  'greenways',
] as const;

export const FHIR_ROUTE_REGISTRY: FhirRouteEntry[] = [
  // ── Patient ────────────────────────────────────────────────
  {
    method: 'GET',
    path: 'Patient',
    resource: 'Patient',
    operation: 'read',
    scope: 'FHIR.R4/Patient.read',
    event: 'patient.search',
    serviceMethod: 'getAllPatients',
    ehrSupported: [...ALL_EHRS],
  },
  {
    method: 'GET',
    path: 'Patient/:id',
    resource: 'Patient',
    operation: 'read',
    scope: 'FHIR.R4/Patient.read',
    event: 'patient.read',
    serviceMethod: 'getPatientById',
    ehrSupported: [...ALL_EHRS],
  },
  {
    method: 'POST',
    path: 'Patient',
    resource: 'Patient',
    operation: 'write',
    scope: 'FHIR.R4/Patient.write',
    event: 'patient.create',
    serviceMethod: 'createPatient',
    ehrSupported: [
      'epic',
      'cerner',
      'athenanet',
      'nextgen',
      'eclinicalworks',
      'drchrono',
      'elation',
      'medent',
      'greenways',
    ],
  },

  // ── Appointment ────────────────────────────────────────────
  {
    method: 'GET',
    path: 'Appointment',
    resource: 'Appointment',
    operation: 'read',
    scope: 'FHIR.R4/Appointment.read',
    event: 'appointment.search',
    serviceMethod: 'getAllAppointments',
    ehrSupported: ['epic', 'cerner', 'athenanet', 'nextgen', 'drchrono', 'elation', 'medent', 'greenways'],
  },
  {
    method: 'GET',
    path: 'Appointment/:id',
    resource: 'Appointment',
    operation: 'read',
    scope: 'FHIR.R4/Appointment.read',
    event: 'appointment.read',
    serviceMethod: 'getAppointmentById',
    ehrSupported: ['epic', 'cerner', 'athenanet', 'nextgen', 'drchrono', 'elation', 'medent', 'greenways'],
  },
  {
    method: 'POST',
    path: 'Appointment',
    resource: 'Appointment',
    operation: 'write',
    scope: 'FHIR.R4/Appointment.write',
    event: 'appointment.create',
    serviceMethod: 'createAppointment',
    ehrSupported: ['epic', 'cerner', 'athenanet', 'drchrono', 'elation'],
  },

  // ── Encounter ──────────────────────────────────────────────
  {
    method: 'GET',
    path: 'Encounter',
    resource: 'Encounter',
    operation: 'read',
    scope: 'FHIR.R4/Encounter.read',
    event: 'encounter.search',
    serviceMethod: 'getAllEncounters',
    ehrSupported: ['epic', 'cerner', 'athenanet', 'nextgen', 'eclinicalworks', 'meditech', 'medent', 'greenways'],
  },
  {
    method: 'GET',
    path: 'Encounter/:id',
    resource: 'Encounter',
    operation: 'read',
    scope: 'FHIR.R4/Encounter.read',
    event: 'encounter.read',
    serviceMethod: 'getEncounterById',
    ehrSupported: ['epic', 'cerner', 'athenanet', 'nextgen', 'eclinicalworks', 'meditech', 'medent', 'greenways'],
  },
  {
    method: 'POST',
    path: 'Encounter',
    resource: 'Encounter',
    operation: 'write',
    scope: 'FHIR.R4/Encounter.write',
    event: 'encounter.create',
    serviceMethod: 'createEncounter',
    ehrSupported: ['cerner', 'athenanet'],
  },

  // ── Coverage ───────────────────────────────────────────────
  {
    method: 'GET',
    path: 'Coverage',
    resource: 'Coverage',
    operation: 'read',
    scope: 'FHIR.R4/Coverage.read',
    event: 'coverage.search',
    serviceMethod: 'getAllCoverages',
    ehrSupported: ['epic', 'cerner', 'athenanet', 'nextgen', 'eclinicalworks', 'elation'],
  },
  {
    method: 'GET',
    path: 'Coverage/:id',
    resource: 'Coverage',
    operation: 'read',
    scope: 'FHIR.R4/Coverage.read',
    event: 'coverage.read',
    serviceMethod: 'getCoverageById',
    ehrSupported: ['epic', 'cerner', 'nextgen', 'eclinicalworks'],
  },
  {
    method: 'POST',
    path: 'Coverage',
    resource: 'Coverage',
    operation: 'write',
    scope: 'FHIR.R4/Coverage.write',
    event: 'coverage.create',
    serviceMethod: 'createCoverage',
    ehrSupported: ['cerner', 'athenanet', 'nextgen'],
  },

  // ── Condition ──────────────────────────────────────────────
  {
    method: 'GET',
    path: 'Condition',
    resource: 'Condition',
    operation: 'read',
    scope: 'FHIR.R4/Condition.read',
    event: 'condition.search',
    serviceMethod: 'getAllConditions',
    ehrSupported: [...ALL_EHRS],
  },
  {
    method: 'GET',
    path: 'Condition/:id',
    resource: 'Condition',
    operation: 'read',
    scope: 'FHIR.R4/Condition.read',
    event: 'condition.read',
    serviceMethod: 'getConditionById',
    ehrSupported: [...ALL_EHRS],
  },
  {
    method: 'POST',
    path: 'Condition',
    resource: 'Condition',
    operation: 'write',
    scope: 'FHIR.R4/Condition.write',
    event: 'condition.create',
    serviceMethod: 'createCondition',
    ehrSupported: ['epic', 'cerner', 'athenanet', 'nextgen', 'drchrono', 'elation', 'medent', 'greenways'],
  },
  {
    method: 'PUT',
    path: 'Condition/:id',
    resource: 'Condition',
    operation: 'write',
    scope: 'FHIR.R4/Condition.write',
    event: 'condition.update',
    serviceMethod: 'updateCondition',
    ehrSupported: ['athenanet'],
  },

  // ── Practitioner ───────────────────────────────────────────
  {
    method: 'GET',
    path: 'Practitioner',
    resource: 'Practitioner',
    operation: 'read',
    scope: 'FHIR.R4/Practitioner.read',
    event: 'practitioner.search',
    serviceMethod: 'getAllPractitioners',
    ehrSupported: [...ALL_EHRS],
  },
  {
    method: 'GET',
    path: 'Practitioner/:id',
    resource: 'Practitioner',
    operation: 'read',
    scope: 'FHIR.R4/Practitioner.read',
    event: 'practitioner.read',
    serviceMethod: 'getPractitionerById',
    ehrSupported: [
      'epic',
      'cerner',
      'athenanet',
      'nextgen',
      'eclinicalworks',
      'drchrono',
      'elation',
      'medent',
      'greenways',
    ],
  },

  // ── AllergyIntolerance ─────────────────────────────────────
  {
    method: 'GET',
    path: 'AllergyIntolerance',
    resource: 'AllergyIntolerance',
    operation: 'read',
    scope: 'FHIR.R4/AllergyIntolerance.read',
    event: 'allergy.search',
    serviceMethod: 'getAllAllergies',
    ehrSupported: [...ALL_EHRS],
  },
  {
    method: 'GET',
    path: 'AllergyIntolerance/:id',
    resource: 'AllergyIntolerance',
    operation: 'read',
    scope: 'FHIR.R4/AllergyIntolerance.read',
    event: 'allergy.read',
    serviceMethod: 'getAllergyById',
    ehrSupported: [...ALL_EHRS],
  },
  {
    method: 'POST',
    path: 'AllergyIntolerance',
    resource: 'AllergyIntolerance',
    operation: 'write',
    scope: 'FHIR.R4/AllergyIntolerance.write',
    event: 'allergy.create',
    serviceMethod: 'createAllergy',
    ehrSupported: ['epic', 'cerner', 'athenanet', 'drchrono', 'elation', 'medent', 'greenways'],
  },

  // ── ServiceRequest ─────────────────────────────────────────
  {
    method: 'GET',
    path: 'ServiceRequest',
    resource: 'ServiceRequest',
    operation: 'read',
    scope: 'FHIR.R4/ServiceRequest.read',
    event: 'serviceRequest.search',
    serviceMethod: 'getAllServiceRequests',
    ehrSupported: ['epic', 'cerner', 'athenanet', 'nextgen'],
  },
  {
    method: 'GET',
    path: 'ServiceRequest/:id',
    resource: 'ServiceRequest',
    operation: 'read',
    scope: 'FHIR.R4/ServiceRequest.read',
    event: 'serviceRequest.read',
    serviceMethod: 'getServiceRequestById',
    ehrSupported: ['epic', 'cerner', 'athenanet', 'nextgen'],
  },

  // ── MedicationStatement ────────────────────────────────────
  {
    method: 'GET',
    path: 'MedicationStatement',
    resource: 'MedicationStatement',
    operation: 'read',
    scope: 'FHIR.R4/MedicationStatement.read',
    event: 'medicationStatement.search',
    serviceMethod: 'getAllMedicationStatements',
    ehrSupported: ['epic', 'nextgen', 'eclinicalworks', 'drchrono', 'elation', 'meditech'],
  },
  {
    method: 'GET',
    path: 'MedicationStatement/:id',
    resource: 'MedicationStatement',
    operation: 'read',
    scope: 'FHIR.R4/MedicationStatement.read',
    event: 'medicationStatement.read',
    serviceMethod: 'getMedicationStatementById',
    ehrSupported: ['epic', 'nextgen', 'eclinicalworks', 'drchrono', 'elation', 'meditech'],
  },
  {
    method: 'POST',
    path: 'MedicationStatement',
    resource: 'MedicationStatement',
    operation: 'write',
    scope: 'FHIR.R4/MedicationStatement.write',
    event: 'medicationStatement.create',
    serviceMethod: 'createMedicationStatement',
    ehrSupported: ['drchrono'],
  },

  // ── Communication ──────────────────────────────────────────
  {
    method: 'GET',
    path: 'Communication',
    resource: 'Communication',
    operation: 'read',
    scope: 'FHIR.R4/Communication.read',
    event: 'communication.search',
    serviceMethod: 'getAllCommunications',
    ehrSupported: ['epic', 'cerner', 'athenanet', 'nextgen', 'drchrono', 'elation', 'meditech'],
  },
  {
    method: 'GET',
    path: 'Communication/:id',
    resource: 'Communication',
    operation: 'read',
    scope: 'FHIR.R4/Communication.read',
    event: 'communication.read',
    serviceMethod: 'getCommunicationById',
    ehrSupported: ['epic', 'cerner', 'drchrono', 'meditech'],
  },
  {
    method: 'POST',
    path: 'Communication',
    resource: 'Communication',
    operation: 'write',
    scope: 'FHIR.R4/Communication.write',
    event: 'communication.create',
    serviceMethod: 'createCommunication',
    ehrSupported: ['epic', 'cerner', 'athenanet', 'nextgen', 'drchrono', 'elation'],
  },

  // ── Observation ────────────────────────────────────────────
  {
    method: 'GET',
    path: 'Observation',
    resource: 'Observation',
    operation: 'read',
    scope: 'FHIR.R4/Observation.read',
    event: 'observation.search',
    serviceMethod: 'getAllObservations',
    ehrSupported: [...ALL_EHRS],
  },
  {
    method: 'GET',
    path: 'Observation/:id',
    resource: 'Observation',
    operation: 'read',
    scope: 'FHIR.R4/Observation.read',
    event: 'observation.read',
    serviceMethod: 'getObservationById',
    ehrSupported: [
      'epic',
      'cerner',
      'athenanet',
      'nextgen',
      'eclinicalworks',
      'elation',
      'meditech',
      'medent',
      'greenways',
    ],
  },
  {
    method: 'POST',
    path: 'Observation',
    resource: 'Observation',
    operation: 'write',
    scope: 'FHIR.R4/Observation.write',
    event: 'observation.create',
    serviceMethod: 'createObservation',
    ehrSupported: ['epic', 'cerner', 'elation', 'medent', 'greenways'],
  },

  // ── DocumentReference ──────────────────────────────────────
  {
    method: 'GET',
    path: 'DocumentReference',
    resource: 'DocumentReference',
    operation: 'read',
    scope: 'FHIR.R4/DocumentReference.read',
    event: 'documentReference.search',
    serviceMethod: 'getAllDocumentReferences',
    ehrSupported: [...ALL_EHRS],
  },
  {
    method: 'GET',
    path: 'DocumentReference/:id',
    resource: 'DocumentReference',
    operation: 'read',
    scope: 'FHIR.R4/DocumentReference.read',
    event: 'documentReference.read',
    serviceMethod: 'getDocumentReferenceById',
    ehrSupported: [...ALL_EHRS],
  },
  {
    method: 'POST',
    path: 'DocumentReference',
    resource: 'DocumentReference',
    operation: 'write',
    scope: 'FHIR.R4/DocumentReference.write',
    event: 'documentReference.create',
    serviceMethod: 'createDocumentReference',
    ehrSupported: ['epic', 'cerner', 'athenanet', 'nextgen', 'elation', 'medent', 'greenways'],
  },

  // ── Location ───────────────────────────────────────────────
  {
    method: 'GET',
    path: 'Location',
    resource: 'Location',
    operation: 'read',
    scope: 'FHIR.R4/Location.read',
    event: 'location.search',
    serviceMethod: 'getAllLocations',
    ehrSupported: ['athenanet'],
  },
];

// ─── Derived Utilities ───────────────────────────────────────

function matchPath(pattern: string, actual: string): boolean {
  const patternParts = pattern.split('/');
  const actualParts = actual.split('/');
  if (patternParts.length !== actualParts.length) return false;
  return patternParts.every((part, i) => part.startsWith(':') || part === actualParts[i]);
}

/**
 * Extracts the FHIR resource path from a full API path.
 * e.g. '/fhir/r4/v1/Patient/123' → 'Patient/:id'
 *      'Patient' → 'Patient'
 */
function normalizePath(rawPath: string): string {
  const stripped = rawPath.replace(/^\/?(api\/)?fhir\/r4\/v1\/?/, '').replace(/\/$/, '');
  const parts = stripped.split('/');
  if (parts.length === 2) return `${parts[0]}/:id`;
  return parts[0];
}

/** Look up the scope required for a given HTTP method + FHIR path. */
export function getRouteScope(method: string, rawPath: string): RouteScopeEntry | undefined {
  const path = normalizePath(rawPath);
  const entry = FHIR_ROUTE_REGISTRY.find((r) => r.method === method && matchPath(r.path, path));
  if (!entry) return undefined;
  return {
    scope: entry.scope,
    resource: entry.resource,
    operation: entry.operation,
    ehrSupported: entry.ehrSupported,
  };
}

/** Get all scopes an EHR supports. */
export function getScopesForEhr(ehrName: string): string[] {
  const scopes = new Set<string>();
  for (const entry of FHIR_ROUTE_REGISTRY) {
    if (entry.ehrSupported.includes(ehrName)) {
      scopes.add(entry.scope);
    }
  }
  return [...scopes].sort();
}

/** Get capabilities per resource for an EHR (for admin UI scope picker). */
export function getCapabilitiesForEhr(ehrName: string): Record<string, { read: boolean; write: boolean }> {
  const caps: Record<string, { read: boolean; write: boolean }> = {};
  for (const entry of FHIR_ROUTE_REGISTRY) {
    if (!entry.ehrSupported.includes(ehrName)) continue;
    if (!caps[entry.resource]) caps[entry.resource] = { read: false, write: false };
    caps[entry.resource][entry.operation] = true;
  }
  return caps;
}

/** All capabilities across all EHRs (union). For app-level scope picker. */
export function getAllCapabilities(): Record<string, { read: boolean; write: boolean }> {
  const caps: Record<string, { read: boolean; write: boolean }> = {};
  for (const entry of FHIR_ROUTE_REGISTRY) {
    if (!caps[entry.resource]) caps[entry.resource] = { read: false, write: false };
    caps[entry.resource][entry.operation] = true;
  }
  return caps;
}

/** All unique scopes across all EHRs (for OAuth discovery). */
export function getAllScopes(): string[] {
  return [...new Set(FHIR_ROUTE_REGISTRY.map((r) => r.scope))].sort();
}

/** All unique FHIR resources. */
export function getAllResources(): string[] {
  return [...new Set(FHIR_ROUTE_REGISTRY.map((r) => r.resource))].sort();
}

/** All supported EHR names. */
export function getAllEhrNames(): string[] {
  return [...ALL_EHRS];
}

/** Validate that scopes are valid for a given EHR. Returns invalid scopes. */
export function validateScopesForEhr(ehrName: string, scopes: string[]): string[] {
  const available = new Set(getScopesForEhr(ehrName));
  return scopes.filter((s) => !available.has(s));
}

/** Check if a specific route is allowed given the EHR and granted scopes. */
export function isRouteAllowed(
  method: string,
  rawPath: string,
  ehrName: string,
  grantedScopes: string[],
): RouteCheckResult {
  const route = getRouteScope(method, rawPath);
  if (!route) {
    return { allowed: false, reason: 'Unknown route' };
  }
  if (!route.ehrSupported.includes(ehrName)) {
    return {
      allowed: false,
      requiredScope: route.scope,
      reason: `${ehrName} does not support ${route.resource}.${route.operation}`,
    };
  }
  if (!grantedScopes.includes(route.scope)) {
    return {
      allowed: false,
      requiredScope: route.scope,
      reason: `Missing scope: ${route.scope}`,
    };
  }
  return { allowed: true };
}

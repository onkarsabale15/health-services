// ─── Single Source of Truth: EHR OAuth Token Scopes ──────────────────────────
//
// These are the OAuth scope strings sent to the EHR's token endpoint when
// requesting an access token. NOT the same as FHIR platform scopes
// (FHIR.R4/Patient.read) which control access through IB.
//
// FHIR platform scopes  → fhir-routes.ts  → IB route authorization
// EHR token scopes       → this file       → EHR OAuth token request

export interface EhrTokenScopeOption {
  value: string;
  label: string;
  description?: string;
}

export interface EhrTokenScopeConfig {
  /** Default scope string sent to the EHR token endpoint */
  defaultScope: string;
  /** Available scope options the user can pick from in admin UI */
  options: EhrTokenScopeOption[];
  /** Whether free-form scope input is allowed beyond the listed options */
  allowCustom: boolean;
}

export const EHR_TOKEN_SCOPES: Record<string, Record<string, EhrTokenScopeConfig>> = {
  // ── Epic ────────────────────────────────────────────────────
  // Epic uses SMART v1 wildcard scopes
  // System → system/ prefix (backend, JWT/JWKS auth)
  // Provider → user/ prefix + context (EHR launch)
  // Patient → patient/ prefix + context (MyChart launch)
  epic: {
    system: {
      defaultScope: 'system/*.read',
      options: [
        { value: 'system/*.read', label: 'System Read All', description: 'Read access to all system-level resources' },
        {
          value: 'system/*.write',
          label: 'System Write All',
          description: 'Write access to all system-level resources',
        },
        {
          value: 'system/*.*',
          label: 'System Full Access',
          description: 'Read + write access to all system-level resources',
        },
      ],
      allowCustom: true,
    },
    // provider: {
    //   defaultScope: 'openid fhirUser launch',
    //   options: [
    //     // Context / launch scopes
    //     { value: 'openid', label: 'OpenID', description: 'OpenID Connect authentication' },
    //     { value: 'fhirUser', label: 'FHIR User', description: 'Include FHIR user claim in ID token' },
    //     { value: 'launch', label: 'EHR Launch', description: 'Receive launch context from EHR' },
    //     { value: 'online_access', label: 'Online Access', description: 'Refresh token valid while user is online' },
    //     { value: 'profile', label: 'Profile', description: 'OpenID Connect profile claim' },
    //     // User-context resource scopes
    //     { value: 'user/*.read', label: 'User Read All', description: 'Read access to all user-context resources' },
    //     { value: 'user/*.write', label: 'User Write All', description: 'Write access to all user-context resources' },
    //     { value: 'user/*.*', label: 'User Full Access', description: 'Read + write access to all user-context resources' },
    //   ],
    //   allowCustom: true,
    // },
    // patient: {
    //   defaultScope: 'openid fhirUser launch',
    //   options: [
    //     // Context / launch scopes
    //     { value: 'openid', label: 'OpenID', description: 'OpenID Connect authentication' },
    //     { value: 'fhirUser', label: 'FHIR User', description: 'Include FHIR user claim in ID token' },
    //     { value: 'launch', label: 'EHR Launch', description: 'Receive launch context from EHR' },
    //     { value: 'online_access', label: 'Online Access', description: 'Refresh token valid while user is online' },
    //     { value: 'profile', label: 'Profile', description: 'OpenID Connect profile claim' },
    //     // Patient-context resource scopes
    //     { value: 'patient/*.read', label: 'Patient Read All', description: 'Read access to all patient-context resources' },
    //     { value: 'patient/*.write', label: 'Patient Write All', description: 'Write access to all patient-context resources' },
    //     { value: 'patient/*.*', label: 'Patient Full Access', description: 'Read + write access to all patient-context resources' },
    //   ],
    //   allowCustom: true,
    // },
  },

  // ── Cerner (Oracle Health) ──────────────────────────────────
  // Cerner/Oracle Health — sourced from /.well-known/smart-configuration
  // SMART v2 granular scopes: Resource.cruds (c=create, r=read, u=update, d=delete, s=search)
  // System → system/ prefix (backend, no user context)
  // Provider → user/ prefix (EHR launch, provider context)
  // Patient → patient/ prefix (patient portal, patient context)
  cerner: {
    system: {
      defaultScope: '',
      options: [
        { value: 'system/Account.rs', label: 'Account (read, search)' },
        { value: 'system/AllergyIntolerance.crus', label: 'AllergyIntolerance (create, read, update, search)' },
        { value: 'system/Appointment.crus', label: 'Appointment (create, read, update, search)' },
        { value: 'system/Basic.c', label: 'Basic (create)' },
        { value: 'system/Binary.r', label: 'Binary (read)' },
        { value: 'system/CarePlan.rs', label: 'CarePlan (read, search)' },
        { value: 'system/CareTeam.rs', label: 'CareTeam (read, search)' },
        { value: 'system/ChargeItem.crs', label: 'ChargeItem (create, read, search)' },
        { value: 'system/Communication.crus', label: 'Communication (create, read, update, search)' },
        { value: 'system/Condition.crus', label: 'Condition (create, read, update, search)' },
        { value: 'system/Consent.rs', label: 'Consent (read, search)' },
        { value: 'system/Coverage.cruds', label: 'Coverage (create, read, update, delete, search)' },
        { value: 'system/Device.rs', label: 'Device (read, search)' },
        { value: 'system/DiagnosticReport.crs', label: 'DiagnosticReport (create, read, search)' },
        { value: 'system/DocumentReference.crus', label: 'DocumentReference (create, read, update, search)' },
        { value: 'system/Encounter.crus', label: 'Encounter (create, read, update, search)' },
        { value: 'system/FamilyMemberHistory.crus', label: 'FamilyMemberHistory (create, read, update, search)' },
        { value: 'system/FinancialTransaction.c', label: 'FinancialTransaction (create)' },
        { value: 'system/Goal.rs', label: 'Goal (read, search)' },
        { value: 'system/Immunization.crus', label: 'Immunization (create, read, update, search)' },
        { value: 'system/InsurancePlan.rs', label: 'InsurancePlan (read, search)' },
        { value: 'system/Location.rs', label: 'Location (read, search)' },
        { value: 'system/Media.r', label: 'Media (read)' },
        { value: 'system/MedicationAdministration.rs', label: 'MedicationAdministration (read, search)' },
        { value: 'system/MedicationDispense.rs', label: 'MedicationDispense (read, search)' },
        { value: 'system/MedicationRequest.crus', label: 'MedicationRequest (create, read, update, search)' },
        { value: 'system/NutritionOrder.rs', label: 'NutritionOrder (read, search)' },
        { value: 'system/Observation.crus', label: 'Observation (create, read, update, search)' },
        { value: 'system/Organization.crs', label: 'Organization (create, read, search)' },
        { value: 'system/Patient.crus', label: 'Patient (create, read, update, search)' },
        { value: 'system/Person.rs', label: 'Person (read, search)' },
        { value: 'system/Practitioner.crs', label: 'Practitioner (create, read, search)' },
        { value: 'system/Procedure.crs', label: 'Procedure (create, read, search)' },
        { value: 'system/Provenance.crs', label: 'Provenance (create, read, search)' },
        { value: 'system/Questionnaire.rs', label: 'Questionnaire (read, search)' },
        { value: 'system/QuestionnaireResponse.rus', label: 'QuestionnaireResponse (read, update, search)' },
        { value: 'system/RelatedPerson.crus', label: 'RelatedPerson (create, read, update, search)' },
        { value: 'system/Schedule.rs', label: 'Schedule (read, search)' },
        { value: 'system/ServiceRequest.rs', label: 'ServiceRequest (read, search)' },
        { value: 'system/Slot.rus', label: 'Slot (read, update, search)' },
        { value: 'system/Specimen.rs', label: 'Specimen (read, search)' },
      ],
      allowCustom: true,
    },
    provider: {
      defaultScope: 'openid fhirUser launch online_access profile',
      options: [
        // Context / launch scopes
        { value: 'openid', label: 'OpenID', description: 'OpenID Connect authentication' },
        { value: 'fhirUser', label: 'FHIR User', description: 'Include FHIR user claim in ID token' },
        { value: 'launch', label: 'EHR Launch', description: 'Receive launch context from EHR' },
        { value: 'online_access', label: 'Online Access', description: 'Refresh token valid while user is online' },
        { value: 'offline_access', label: 'Offline Access', description: 'Refresh token for persistent access' },
        { value: 'profile', label: 'Profile', description: 'OpenID Connect profile claim' },
        // User-context resource scopes
        { value: 'user/Account.rs', label: 'Account (read, search)' },
        { value: 'user/AllergyIntolerance.crus', label: 'AllergyIntolerance (create, read, update, search)' },
        { value: 'user/Appointment.crus', label: 'Appointment (create, read, update, search)' },
        { value: 'user/Basic.c', label: 'Basic (create)' },
        { value: 'user/Binary.r', label: 'Binary (read)' },
        { value: 'user/CarePlan.rs', label: 'CarePlan (read, search)' },
        { value: 'user/CareTeam.rs', label: 'CareTeam (read, search)' },
        { value: 'user/ChargeItem.crs', label: 'ChargeItem (create, read, search)' },
        { value: 'user/Communication.crus', label: 'Communication (create, read, update, search)' },
        { value: 'user/Condition.crus', label: 'Condition (create, read, update, search)' },
        { value: 'user/Consent.rs', label: 'Consent (read, search)' },
        { value: 'user/Coverage.cruds', label: 'Coverage (create, read, update, delete, search)' },
        { value: 'user/Device.rs', label: 'Device (read, search)' },
        { value: 'user/DiagnosticReport.crs', label: 'DiagnosticReport (create, read, search)' },
        { value: 'user/DocumentReference.crus', label: 'DocumentReference (create, read, update, search)' },
        { value: 'user/Encounter.crus', label: 'Encounter (create, read, update, search)' },
        { value: 'user/FamilyMemberHistory.crus', label: 'FamilyMemberHistory (create, read, update, search)' },
        { value: 'user/Goal.rs', label: 'Goal (read, search)' },
        { value: 'user/Immunization.crus', label: 'Immunization (create, read, update, search)' },
        { value: 'user/InsurancePlan.rs', label: 'InsurancePlan (read, search)' },
        { value: 'user/Location.rs', label: 'Location (read, search)' },
        { value: 'user/Media.r', label: 'Media (read)' },
        { value: 'user/MedicationAdministration.rs', label: 'MedicationAdministration (read, search)' },
        { value: 'user/MedicationDispense.rs', label: 'MedicationDispense (read, search)' },
        { value: 'user/MedicationRequest.crus', label: 'MedicationRequest (create, read, update, search)' },
        { value: 'user/NutritionOrder.rs', label: 'NutritionOrder (read, search)' },
        { value: 'user/Observation.crus', label: 'Observation (create, read, update, search)' },
        { value: 'user/Organization.crs', label: 'Organization (create, read, search)' },
        { value: 'user/Patient.crus', label: 'Patient (create, read, update, search)' },
        { value: 'user/Person.rs', label: 'Person (read, search)' },
        { value: 'user/Practitioner.crs', label: 'Practitioner (create, read, search)' },
        { value: 'user/Procedure.crs', label: 'Procedure (create, read, search)' },
        { value: 'user/Provenance.crs', label: 'Provenance (create, read, search)' },
        { value: 'user/Questionnaire.rs', label: 'Questionnaire (read, search)' },
        { value: 'user/QuestionnaireResponse.rus', label: 'QuestionnaireResponse (read, update, search)' },
        { value: 'user/RelatedPerson.crus', label: 'RelatedPerson (create, read, update, search)' },
        { value: 'user/Schedule.rs', label: 'Schedule (read, search)' },
        { value: 'user/ServiceRequest.rs', label: 'ServiceRequest (read, search)' },
        { value: 'user/Slot.rus', label: 'Slot (read, update, search)' },
        { value: 'user/Specimen.rs', label: 'Specimen (read, search)' },
      ],
      allowCustom: true,
    },
  },

  // ── athenahealth ────────────────────────────────────────────
  athenanet: {
    system: {
      defaultScope: 'athena/service/Athenanet.MDP.*',
      options: [
        {
          value: 'athena/service/Athenanet.MDP.*',
          label: 'Athenanet MDP (All)',
          description: 'Full access to athenahealth MDP proprietary API',
        },
        { value: 'system/AllergyIntolerance.read', label: 'AllergyIntolerance (read)' },
        { value: 'system/Binary.read', label: 'Binary (read)' },
        { value: 'system/CarePlan.read', label: 'CarePlan (read)' },
        { value: 'system/CareTeam.read', label: 'CareTeam (read)' },
        { value: 'system/Condition.read', label: 'Condition (read)' },
        { value: 'system/Coverage.read', label: 'Coverage (read)' },
        { value: 'system/Device.read', label: 'Device (read)' },
        { value: 'system/DiagnosticReport.read', label: 'DiagnosticReport (read)' },
        { value: 'system/DocumentReference.read', label: 'DocumentReference (read)' },
        { value: 'system/Encounter.read', label: 'Encounter (read)' },
        { value: 'system/Goal.read', label: 'Goal (read)' },
        { value: 'system/Immunization.read', label: 'Immunization (read)' },
        { value: 'system/Location.read', label: 'Location (read)' },
        { value: 'system/Medication.read', label: 'Medication (read)' },
        { value: 'system/MedicationDispense.read', label: 'MedicationDispense (read)' },
        { value: 'system/MedicationRequest.read', label: 'MedicationRequest (read)' },
        { value: 'system/Observation.read', label: 'Observation (read)' },
        { value: 'system/Organization.read', label: 'Organization (read)' },
        { value: 'system/Patient.read', label: 'Patient (read)' },
        { value: 'system/Practitioner.read', label: 'Practitioner (read)' },
        { value: 'system/Procedure.read', label: 'Procedure (read)' },
        { value: 'system/Provenance.read', label: 'Provenance (read)' },
        { value: 'system/QuestionnaireResponse.read', label: 'QuestionnaireResponse (read)' },
        { value: 'system/RelatedPerson.read', label: 'RelatedPerson (read)' },
        { value: 'system/ServiceRequest.read', label: 'ServiceRequest (read)' },
        { value: 'system/Specimen.read', label: 'Specimen (read)' },
      ],
      allowCustom: false,
    },
    provider: {
      defaultScope: 'athena/service/Athenaone.readonly',
      options: [
        { value: 'athena/service/Athenaone.readonly', label: 'Read Only' },
        { value: 'athena/service/Athenaone', label: 'Full Access' },
      ],
      allowCustom: false,
    },
  },

  // ── NextGen ─────────────────────────────────────────────────
  // NextGen uses its own OAuth + FHIR R4 API
  // System → backend client_credentials (nge-oauth)
  // Provider → EHR launch / standalone launch authorization_code (nge-oauth)
  nextgen: {
    system: {
      defaultScope: '',
      options: [],
      allowCustom: true,
    },
    provider: {
      defaultScope: 'openid fhirUser launch',
      options: [
        { value: 'openid', label: 'OpenID', description: 'OpenID Connect authentication' },
        { value: 'fhirUser', label: 'FHIR User', description: 'Include FHIR user claim in ID token' },
        { value: 'launch', label: 'EHR Launch', description: 'Receive launch context from EHR' },
        { value: 'user/*.read', label: 'User Read All', description: 'Read access to all user-context resources' },
        {
          value: 'user/*.*',
          label: 'User Full Access',
          description: 'Read + write access to all user-context resources',
        },
      ],
      allowCustom: true,
    },
  },

  // ── eClinicalWorks ──────────────────────────────────────────
  // System → system/ prefix (backend, client_credentials)
  // Provider → user/ prefix + context (EHR launch / standalone launch)
  eclinicalworks: {
    system: {
      defaultScope:
        'system/Patient.read system/Encounter.read system/Condition.read system/AllergyIntolerance.read system/MedicationRequest.read system/Observation.read',
      options: [
        { value: 'system/AllergyIntolerance.read', label: 'AllergyIntolerance (read)' },
        { value: 'system/Binary.read', label: 'Binary (read)' },
        { value: 'system/CarePlan.read', label: 'CarePlan (read)' },
        { value: 'system/CareTeam.read', label: 'CareTeam (read)' },
        { value: 'system/Condition.read', label: 'Condition (read)' },
        { value: 'system/Coverage.read', label: 'Coverage (read)' },
        { value: 'system/Device.read', label: 'Device (read)' },
        { value: 'system/DiagnosticReport.read', label: 'DiagnosticReport (read)' },
        { value: 'system/DocumentReference.read', label: 'DocumentReference (read)' },
        { value: 'system/Encounter.read', label: 'Encounter (read)' },
        { value: 'system/Goal.read', label: 'Goal (read)' },
        { value: 'system/Group.read', label: 'Group (read)' },
        { value: 'system/Immunization.read', label: 'Immunization (read)' },
        { value: 'system/Location.read', label: 'Location (read)' },
        { value: 'system/Media.read', label: 'Media (read)' },
        { value: 'system/Medication.read', label: 'Medication (read)' },
        { value: 'system/MedicationAdministration.read', label: 'MedicationAdministration (read)' },
        { value: 'system/MedicationDispense.read', label: 'MedicationDispense (read)' },
        { value: 'system/MedicationRequest.read', label: 'MedicationRequest (read)' },
        { value: 'system/Observation.read', label: 'Observation (read)' },
        { value: 'system/Organization.read', label: 'Organization (read)' },
        { value: 'system/Patient.read', label: 'Patient (read)' },
        { value: 'system/Practitioner.read', label: 'Practitioner (read)' },
        { value: 'system/PractitionerRole.read', label: 'PractitionerRole (read)' },
        { value: 'system/Procedure.read', label: 'Procedure (read)' },
        { value: 'system/Provenance.read', label: 'Provenance (read)' },
        { value: 'system/QuestionnaireResponse.read', label: 'QuestionnaireResponse (read)' },
        { value: 'system/RelatedPerson.read', label: 'RelatedPerson (read)' },
        { value: 'system/ServiceRequest.read', label: 'ServiceRequest (read)' },
        { value: 'system/Specimen.read', label: 'Specimen (read)' },
      ],
      allowCustom: true,
    },
    provider: {
      defaultScope: 'openid fhirUser launch',
      options: [
        { value: 'openid', label: 'OpenID', description: 'OpenID Connect authentication' },
        { value: 'fhirUser', label: 'FHIR User', description: 'Include FHIR user claim in ID token' },
        { value: 'launch', label: 'EHR Launch', description: 'Receive launch context from EHR' },
        { value: 'online_access', label: 'Online Access', description: 'Refresh token valid while user is online' },
        { value: 'user/*.read', label: 'User Read All', description: 'Read access to all user-context resources' },
        {
          value: 'user/*.*',
          label: 'User Full Access',
          description: 'Read + write access to all user-context resources',
        },
      ],
      allowCustom: true,
    },
  },

  // ── DrChrono ────────────────────────────────────────────────
  // DrChrono uses its own proprietary scope format (not FHIR scopes).
  // DrChrono does NOT support system/backend client_credentials — provider auth only.
  // Both provider-ehr and provider-standalone launch modes use these same scopes;
  // the only runtime difference is `launch` vs `launch/patient` added by the bridge.
  drchrono: {
    provider: {
      defaultScope: 'patients:read calendar:read clinical:read',
      options: [
        { value: 'patients:read', label: 'Patients Read' },
        { value: 'patients:write', label: 'Patients Write' },
        { value: 'calendar:read', label: 'Calendar Read' },
        { value: 'calendar:write', label: 'Calendar Write' },
        { value: 'clinical:read', label: 'Clinical Read' },
        { value: 'clinical:write', label: 'Clinical Write' },
        { value: 'labs:read', label: 'Labs Read' },
        { value: 'labs:write', label: 'Labs Write' },
        { value: 'billing:read', label: 'Billing Read' },
        { value: 'billing:write', label: 'Billing Write' },
        { value: 'messages:read', label: 'Messages Read' },
        { value: 'messages:write', label: 'Messages Write' },
        { value: 'tasks:read', label: 'Tasks Read' },
        { value: 'tasks:write', label: 'Tasks Write' },
      ],
      allowCustom: true,
    },
  },

  // ── Elation EMR ─────────────────────────────────────────────
  // Elation uses its own REST API with OAuth2 (not FHIR scopes)
  // System → backend client_credentials
  // Provider → provider-facing authorization_code
  elation: {
    system: {
      defaultScope: '',
      options: [],
      allowCustom: true,
    },
    provider: {
      defaultScope: '',
      options: [],
      allowCustom: true,
    },
  },

  // ── MEDITECH ────────────────────────────────────────────────
  // MEDITECH uses SMART on FHIR scopes
  // Provider → user/ prefix + context (EHR launch)
  // Patient → patient/ prefix + context (patient portal)
  meditech: {
    provider: {
      defaultScope: 'openid fhirUser launch',
      options: [
        { value: 'openid', label: 'OpenID', description: 'OpenID Connect authentication' },
        { value: 'fhirUser', label: 'FHIR User', description: 'Include FHIR user claim in ID token' },
        { value: 'launch', label: 'EHR Launch', description: 'Receive launch context from EHR' },
        { value: 'online_access', label: 'Online Access', description: 'Refresh token valid while user is online' },
        { value: 'profile', label: 'Profile', description: 'OpenID Connect profile claim' },
        { value: 'user/*.read', label: 'User Read All', description: 'Read access to all user-context resources' },
        {
          value: 'user/*.*',
          label: 'User Full Access',
          description: 'Read + write access to all user-context resources',
        },
      ],
      allowCustom: true,
    },
  },

  // ── MEDENT ──────────────────────────────────────────────────
  medent: {
    system: {
      defaultScope: '',
      options: [],
      allowCustom: true,
    },
  },

  // ── Greenway Health ─────────────────────────────────────────
  greenways: {
    system: {
      defaultScope: '',
      options: [],
      allowCustom: true,
    },
  },
};

// ─── Utility Functions ───────────────────────────────────────

/**
 * Normalize an EhrAppType to the scope config key.
 * Both `provider-ehr` and `provider-standalone` share the same OAuth scope config
 * — the runtime difference is only the `launch` vs `launch/patient` scope
 * prefix added by the bridge SMART launch service.
 */
function normalizeAppTypeForScopes(appType: string): string {
  if (appType === 'provider-ehr' || appType === 'provider-standalone') return 'provider';
  return appType;
}

/** Get token scope config for an EHR + appType. */
export function getTokenScopeConfig(ehrName: string, appType: string): EhrTokenScopeConfig | null {
  return EHR_TOKEN_SCOPES[ehrName]?.[normalizeAppTypeForScopes(appType)] ?? null;
}

/** Get the default token scope string. */
export function getDefaultTokenScope(ehrName: string, appType: string): string {
  return EHR_TOKEN_SCOPES[ehrName]?.[normalizeAppTypeForScopes(appType)]?.defaultScope ?? '';
}

/** Validate a token scope string against known options (if custom not allowed). */
export function validateTokenScope(ehrName: string, appType: string, scope: string): boolean {
  const config = EHR_TOKEN_SCOPES[ehrName]?.[normalizeAppTypeForScopes(appType)];
  if (!config) return true;
  if (config.allowCustom) return true;
  if (!scope) return true;
  // Check each space-separated scope token is in the options list
  const tokens = scope.split(/\s+/).filter(Boolean);
  return tokens.every((t) => config.options.some((o) => o.value === t || o.value.includes(t)));
}

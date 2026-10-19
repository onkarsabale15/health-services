/**
 * Centralized application type definitions.
 *
 * All app-type-specific constraints (max EHR connections, allowed grants,
 * capabilities, UI rendering hints) live here so that admin-api, admin-ui,
 * and workflow-ui can share the same validation logic from one source of truth.
 */

/**
 * EHR-facing application types:
 * - `system`: backend service using client_credentials (no user context)
 * - `provider-ehr`: provider app launched from within the EHR (SMART EHR launch — `launch` scope)
 * - `provider-standalone`: provider app opened directly, authenticates via EHR (SMART standalone — `launch/patient` scope)
 */
export type EhrAppType = 'system' | 'provider-ehr' | 'provider-standalone';

/** Display metadata for EHR app types — used by admin-ui + cds-ui for consistent labeling */
export const EHR_APP_TYPE_META: Record<EhrAppType, { label: string; shortLabel: string; description: string }> = {
  system: {
    label: 'System',
    shortLabel: 'System',
    description: 'Backend service using client_credentials (no user context)',
  },
  'provider-ehr': {
    label: 'Provider (EHR Launch)',
    shortLabel: 'Provider EHR',
    description: 'Launched from within the EHR via SMART on FHIR',
  },
  'provider-standalone': {
    label: 'Provider (Standalone Launch)',
    shortLabel: 'Standalone',
    description: 'Opened directly, authenticates via EHR',
  },
};

/** Get display label for an EHR app type (falls back to raw value if unknown) */
export function getEhrAppTypeLabel(ehrAppType: string): string {
  return EHR_APP_TYPE_META[ehrAppType as EhrAppType]?.label ?? ehrAppType;
}

/** Get short display label for an EHR app type (for badges/tags) */
export function getEhrAppTypeShortLabel(ehrAppType: string): string {
  return EHR_APP_TYPE_META[ehrAppType as EhrAppType]?.shortLabel ?? ehrAppType;
}

export interface AppTypeDefinition {
  /** Database enum value */
  appType: string;
  /** Human-readable label for UI */
  label: string;
  /** Short description for the type selector card */
  description: string;
  /** Max EHR connections allowed. -1 = unlimited */
  maxEhrAccess: number;
  /** OAuth grant types this app type can use */
  allowedGrantTypes: string[];
  /** Default grant types assigned on creation */
  defaultGrantTypes: string[];
  /** EHR-facing app types this application supports */
  allowedEhrAppTypes: EhrAppType[];
  /** Default EHR app type */
  defaultEhrAppType: EhrAppType;
  /** Whether this type needs client type selection (PUBLIC/CONFIDENTIAL) */
  requiresClientType: boolean;
  /** Whether this type requires a SMART launch URL */
  requiresSmartLaunchUrl: boolean;
  /** Whether this type supports SMART on FHIR launch (as middleware for third-party apps) */
  supportsSmartLaunch: boolean;
  /** Whether this type supports workflow design/execution */
  supportsWorkflows: boolean;
  /** Whether this type supports CDS hooks */
  supportsCds: boolean;
  /** Whether this type supports LLM/AI configuration */
  supportsLlm: boolean;
  /** Whether this type shows FHIR scope selection at creation */
  showsScopeSelection: boolean;
  /** Whether this type shows redirect URI management */
  showsRedirectUris: boolean;
}

export const APP_TYPE_DEFINITIONS: Record<string, AppTypeDefinition> = {
  BRIDGE: {
    appType: 'BRIDGE',
    label: 'Bridge',
    description:
      'Connect to EHRs via FHIR R4 API. Supports backend services and provider apps (EHR or standalone launch).',
    maxEhrAccess: -1,
    allowedGrantTypes: ['client_credentials', 'urn:ietf:params:oauth:grant-type:jwt-bearer'],
    defaultGrantTypes: ['client_credentials'],
    allowedEhrAppTypes: ['system', 'provider-ehr', 'provider-standalone'],
    defaultEhrAppType: 'system',
    requiresClientType: true,
    requiresSmartLaunchUrl: false, // only required if provider-ehr/provider-standalone
    supportsSmartLaunch: true,
    supportsWorkflows: false,
    supportsCds: false,
    supportsLlm: false,
    showsScopeSelection: true,
    showsRedirectUris: true,
  },
  WORKFLOW: {
    appType: 'WORKFLOW',
    label: 'Workflow',
    description:
      'Build automated healthcare workflows with FHIR data, AI/LLM tools, and data transformations. Supports one EHR integration.',
    maxEhrAccess: 1,
    allowedGrantTypes: ['client_credentials'],
    defaultGrantTypes: ['client_credentials'],
    allowedEhrAppTypes: ['system'],
    defaultEhrAppType: 'system',
    requiresClientType: false,
    requiresSmartLaunchUrl: false,
    supportsSmartLaunch: false,
    supportsWorkflows: true,
    supportsCds: false,
    supportsLlm: true,
    showsScopeSelection: true,
    showsRedirectUris: false,
  },
  CDS: {
    appType: 'CDS',
    label: 'Clinical Decision Support',
    description: 'AI-powered clinical decision support with CDS Hooks. Launched from EHR via SMART on FHIR.',
    maxEhrAccess: -1,
    allowedGrantTypes: ['client_credentials', 'urn:ietf:params:oauth:grant-type:jwt-bearer'],
    defaultGrantTypes: ['client_credentials'],
    allowedEhrAppTypes: ['system', 'provider-ehr', 'provider-standalone'],
    defaultEhrAppType: 'provider-ehr',
    requiresClientType: false,
    requiresSmartLaunchUrl: true,
    supportsSmartLaunch: true,
    supportsWorkflows: false,
    supportsCds: true,
    supportsLlm: true,
    showsScopeSelection: true,
    showsRedirectUris: false,
  },
  CUSTOM: {
    appType: 'CUSTOM',
    label: 'Custom',
    description: 'Custom application with flexible configuration. No built-in EHR integration.',
    maxEhrAccess: -1,
    allowedGrantTypes: ['client_credentials', 'urn:ietf:params:oauth:grant-type:jwt-bearer'],
    defaultGrantTypes: ['client_credentials'],
    allowedEhrAppTypes: ['system'],
    defaultEhrAppType: 'system',
    requiresClientType: true,
    requiresSmartLaunchUrl: false,
    supportsSmartLaunch: false,
    supportsWorkflows: false,
    supportsCds: false,
    supportsLlm: false,
    showsScopeSelection: false,
    showsRedirectUris: true,
  },
  PARTNER: {
    appType: 'PARTNER',
    label: 'Partner',
    description:
      'Third-party app using admin-api as its OIDC IdP. Triggers consent screen + ConsentGrant on first login.',
    maxEhrAccess: 0,
    allowedGrantTypes: ['authorization_code'],
    defaultGrantTypes: ['authorization_code'],
    allowedEhrAppTypes: ['system'],
    defaultEhrAppType: 'system',
    requiresClientType: true,
    requiresSmartLaunchUrl: false,
    supportsSmartLaunch: false,
    supportsWorkflows: false,
    supportsCds: false,
    supportsLlm: false,
    showsScopeSelection: false,
    showsRedirectUris: true,
  },
  MCP: {
    appType: 'MCP',
    label: 'MCP Server',
    description:
      'Backend app exposed to LLM agents via the MCP server. System / client_credentials only — invokes EHR vendor methods as tools (no SMART launch, no user context).',
    maxEhrAccess: -1,
    allowedGrantTypes: ['client_credentials'],
    defaultGrantTypes: ['client_credentials'],
    allowedEhrAppTypes: ['system'],
    defaultEhrAppType: 'system',
    requiresClientType: true,
    requiresSmartLaunchUrl: false,
    supportsSmartLaunch: false,
    supportsWorkflows: false,
    supportsCds: false,
    supportsLlm: false,
    showsScopeSelection: true,
    showsRedirectUris: false,
  },
};

/** Get the full definition for an app type. */
export function getAppTypeDefinition(appType: string): AppTypeDefinition | undefined {
  return APP_TYPE_DEFINITIONS[appType];
}

/** Get the max EHR access count for an app type. -1 = unlimited. */
export function getMaxEhrAccess(appType: string): number {
  return APP_TYPE_DEFINITIONS[appType]?.maxEhrAccess ?? -1;
}

/** Get all app type definitions as an array (for UI dropdowns). */
export function getAllAppTypes(): AppTypeDefinition[] {
  return Object.values(APP_TYPE_DEFINITIONS);
}

/** Get the primary app types shown in the create application type selector. */
export function getCreateableAppTypes(): AppTypeDefinition[] {
  return [APP_TYPE_DEFINITIONS.BRIDGE, APP_TYPE_DEFINITIONS.WORKFLOW, APP_TYPE_DEFINITIONS.MCP];
}

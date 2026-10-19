import { createHash } from 'crypto';
import { EhrDefinition, EhrFieldDefinition } from './config.types';
import { getDefaultEndpoints, EhrEndpointSet } from './ehr-endpoints';
import { isProdDeployment } from './deployment-env';

// ─── URL field keys that get defaults from EHR_ENDPOINTS ─────
// Single-value keys; the resolver picks sandbox vs prod side of the catalog
// based on deployment env at enrichment time.
const ENDPOINT_FIELD_KEYS = ['baseUrl', 'authUrl'];

export const EHR_DEFINITIONS: Record<string, EhrDefinition> = {
  epic: {
    ehrName: 'epic',
    label: 'Epic',
    description: 'Epic FHIR R4 integration via SMART Backend Services',
    supportedAppTypes: ['system', 'provider-ehr', 'provider-standalone'],

    authMethod: 'jwt_bearer',
    fhirVersion: 'R4',
    fields: [
      {
        key: 'appType',
        label: 'App Type',
        type: 'select',
        required: true,
        sensitive: false,
        group: 'oauth',
        options: [
          { value: 'system', label: 'System (Backend)' },
          { value: 'provider-ehr', label: 'Provider (EHR Launch)' },
          { value: 'provider-standalone', label: 'Provider (Standalone Launch)' },
        ],
      },
      {
        key: 'clientId',
        label: 'Client ID',
        type: 'text',
        required: true,
        sensitive: false,
        group: 'credentials',
        description: 'Client ID from Epic App Orchard',
        placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
      },
      {
        key: 'clientSecret',
        label: 'JWKS',
        type: 'jwk',
        required: true,
        sensitive: true,
        group: 'credentials',
        description: 'JWK private key. Stored in AWS Secrets Manager.',
      },
      {
        key: 'baseUrl',
        label: 'FHIR Base URL',
        type: 'url',
        required: false,
        sensitive: false,
        group: 'urls',
        placeholder: 'https://hospital.epic.com/interconnect-fhir-oauth',
        description:
          'Override of the catalog default. For system: used directly. For provider-standalone: used as ISS for the launch redirect.',
        dependsOn: { field: 'appType', value: ['system', 'provider-standalone'] },
      },
      {
        key: 'authUrl',
        label: 'Token URL',
        type: 'url',
        required: false,
        sensitive: false,
        group: 'urls',
        description: 'Override of the catalog default. Token endpoint for client_credentials grant.',
        dependsOn: { field: 'appType', value: 'system' },
      },
      {
        key: 'launchUrl',
        label: 'Application Launch URL',
        type: 'url',
        required: false,
        sensitive: false,
        group: 'smart',
        description:
          'Third-party application URL. After SMART auth, Bridge redirects here with an encrypted launch token (JWE) containing sessionId and SMART context.',
        dependsOn: { field: 'appType', value: ['provider-ehr', 'provider-standalone'] },
      },
    ],
  },

  cerner: {
    ehrName: 'cerner',
    label: 'Oracle Health (Cerner)',
    description: 'Cerner Millennium FHIR R4 integration',
    supportedAppTypes: ['system', 'provider-ehr', 'provider-standalone'],

    authMethod: 'basic_auth',
    fhirVersion: 'R4',
    fields: [
      {
        key: 'appType',
        label: 'App Type',
        type: 'select',
        required: true,
        sensitive: false,
        group: 'oauth',
        options: [
          { value: 'system', label: 'System (Backend)' },
          { value: 'provider-ehr', label: 'Provider (EHR Launch)' },
          { value: 'provider-standalone', label: 'Provider (Standalone Launch)' },
        ],
      },
      { key: 'clientId', label: 'Client ID', type: 'text', required: true, sensitive: false, group: 'credentials' },
      {
        key: 'clientSecret',
        label: 'Client Secret',
        type: 'password',
        required: false,
        sensitive: true,
        group: 'credentials',
        description: 'Required for confidential apps. Leave empty for public apps (PKCE only).',
      },
      {
        key: 'tenant',
        label: 'Tenant ID',
        type: 'text',
        required: true,
        sensitive: false,
        group: 'identifiers',
        description: 'Cerner tenant/domain identifier',
        perSite: true,
      },
      {
        key: 'baseUrl',
        label: 'FHIR Base URL',
        type: 'url',
        required: false,
        sensitive: false,
        group: 'urls',
        description:
          'Override of the catalog default. For system: used directly. For provider-standalone: used as ISS for the launch redirect.',
        dependsOn: { field: 'appType', value: ['system', 'provider-standalone'] },
      },
      {
        key: 'authUrl',
        label: 'Token URL',
        type: 'url',
        required: false,
        sensitive: false,
        group: 'urls',
        description: 'Override of the catalog default. Token endpoint for client_credentials grant.',
        dependsOn: { field: 'appType', value: 'system' },
      },
      {
        key: 'launchUrl',
        label: 'Application Launch URL',
        type: 'url',
        required: false,
        sensitive: false,
        group: 'smart',
        description: 'Where to redirect the user after successful SMART auth',
        dependsOn: { field: 'appType', value: ['provider-ehr', 'provider-standalone'] },
      },
    ],
  },

  athenanet: {
    ehrName: 'athenanet',
    label: 'athenahealth',
    description: 'athenahealth FHIR R4 + proprietary API integration',
    supportedAppTypes: ['system', 'provider-ehr', 'provider-standalone'],

    authMethod: 'basic_auth',
    fhirVersion: 'R4',
    fields: [
      {
        key: 'appType',
        label: 'App Type',
        type: 'select',
        required: true,
        sensitive: false,
        group: 'oauth',
        options: [
          { value: 'system', label: 'System (Backend)' },
          { value: 'provider-ehr', label: 'Provider (EHR Launch)' },
          { value: 'provider-standalone', label: 'Provider (Standalone Launch)' },
        ],
      },
      { key: 'clientId', label: 'Client ID', type: 'text', required: true, sensitive: false, group: 'credentials' },
      {
        key: 'clientSecret',
        label: 'Client Secret',
        type: 'password',
        required: false,
        sensitive: true,
        group: 'credentials',
        description: 'Required for confidential apps. Leave empty for public apps (PKCE only).',
      },
      {
        key: 'accountId',
        label: 'Practice ID',
        type: 'text',
        required: true,
        sensitive: false,
        group: 'identifiers',
        description: 'athenahealth Practice ID used in all API paths',
        perSite: true,
      },
      {
        key: 'baseUrl',
        label: 'Base URL',
        type: 'url',
        required: false,
        sensitive: false,
        group: 'urls',
        description:
          'Override of the catalog default. For system: used directly. For provider-standalone: used as ISS for the launch redirect.',
        dependsOn: { field: 'appType', value: ['system', 'provider-standalone'] },
      },
      {
        key: 'authUrl',
        label: 'Token URL',
        type: 'url',
        required: false,
        sensitive: false,
        group: 'urls',
        description: 'Override of the catalog default. Token endpoint for client_credentials grant.',
        dependsOn: { field: 'appType', value: 'system' },
      },
      {
        key: 'launchUrl',
        label: 'Application Launch URL',
        type: 'url',
        required: false,
        sensitive: false,
        group: 'smart',
        description: 'Where to redirect the user after successful SMART auth',
        dependsOn: { field: 'appType', value: ['provider-ehr', 'provider-standalone'] },
      },
    ],
  },

  nextgen: {
    ehrName: 'nextgen',
    label: 'NextGen',
    description: 'NextGen FHIR R4 + Native API integration',
    supportedAppTypes: ['system', 'provider-ehr', 'provider-standalone'],

    authMethod: 'form_post',
    fhirVersion: 'R4',
    fields: [
      {
        key: 'appType',
        label: 'App Type',
        type: 'select',
        required: true,
        sensitive: false,
        group: 'oauth',
        options: [
          { value: 'system', label: 'System (Backend)' },
          { value: 'provider-ehr', label: 'Provider (EHR Launch)' },
          { value: 'provider-standalone', label: 'Provider (Standalone Launch)' },
        ],
      },
      { key: 'clientId', label: 'Client ID', type: 'text', required: true, sensitive: false, group: 'credentials' },
      {
        key: 'clientSecret',
        label: 'Client Secret',
        type: 'password',
        required: false,
        sensitive: true,
        group: 'credentials',
        description: 'Required for confidential apps. Leave empty for public apps (PKCE only).',
      },
      {
        key: 'siteId',
        label: 'Site ID',
        type: 'text',
        required: true,
        sensitive: false,
        group: 'identifiers',
        description: 'NextGen Site ID for authentication',
        perSite: true,
      },
      {
        key: 'accountId',
        label: 'Enterprise ID',
        type: 'text',
        required: true,
        sensitive: false,
        group: 'identifiers',
        description: 'Passed as x-enterprise-id header',
        perSite: true,
      },
      {
        key: 'tenant',
        label: 'Practice ID',
        type: 'text',
        required: true,
        sensitive: false,
        group: 'identifiers',
        description: 'Passed as x-practice-id header',
        perSite: true,
      },
      {
        key: 'baseUrl',
        label: 'Native API Base URL',
        type: 'url',
        required: false,
        sensitive: false,
        group: 'urls',
        description:
          'Override of the catalog default. For system: used directly. For provider-standalone: used as ISS for the launch redirect.',
        dependsOn: { field: 'appType', value: ['system', 'provider-standalone'] },
      },
      {
        key: 'authUrl',
        label: 'Token URL',
        type: 'url',
        required: false,
        sensitive: false,
        group: 'urls',
        description: 'Override of the catalog default. Token endpoint for client_credentials grant.',
        dependsOn: { field: 'appType', value: 'system' },
      },
      {
        key: 'launchUrl',
        label: 'Application Launch URL',
        type: 'url',
        required: false,
        sensitive: false,
        group: 'smart',
        description: 'Where to redirect the user after successful SMART auth',
        dependsOn: { field: 'appType', value: ['provider-ehr', 'provider-standalone'] },
      },
    ],
  },

  eclinicalworks: {
    ehrName: 'eclinicalworks',
    label: 'eClinicalWorks',
    description: 'eClinicalWorks FHIR R4 via SMART Backend Services',
    supportedAppTypes: ['system', 'provider-ehr', 'provider-standalone'],

    authMethod: 'jwt_bearer',
    fhirVersion: 'R4',
    fields: [
      {
        key: 'appType',
        label: 'App Type',
        type: 'select',
        required: true,
        sensitive: false,
        group: 'oauth',
        options: [
          { value: 'system', label: 'System (Backend)' },
          { value: 'provider-ehr', label: 'Provider (EHR Launch)' },
          { value: 'provider-standalone', label: 'Provider (Standalone Launch)' },
        ],
      },
      {
        key: 'clientId',
        label: 'Client ID',
        type: 'text',
        required: true,
        sensitive: false,
        group: 'credentials',
        description: 'eCW client_id (also used as JWT issuer/subject)',
      },
      {
        key: 'clientSecret',
        label: 'JWKS',
        type: 'jwk',
        required: false,
        sensitive: true,
        group: 'credentials',
        description: 'JWK private key. Required for confidential/system apps.',
      },
      {
        key: 'tenant',
        label: 'Tenant ID',
        type: 'text',
        required: true,
        sensitive: false,
        group: 'identifiers',
        description: 'Substituted into {tenant} URL placeholder',
        perSite: true,
      },
      {
        key: 'baseUrl',
        label: 'FHIR Base URL',
        type: 'url',
        required: false,
        sensitive: false,
        group: 'urls',
        description:
          'Override of the catalog default. For system: used directly. For provider-standalone: used as ISS for the launch redirect.',
        dependsOn: { field: 'appType', value: ['system', 'provider-standalone'] },
      },
      {
        key: 'authUrl',
        label: 'Token URL',
        type: 'url',
        required: false,
        sensitive: false,
        group: 'urls',
        description: 'Override of the catalog default. Token endpoint for client_credentials grant.',
        dependsOn: { field: 'appType', value: 'system' },
      },
      {
        key: 'launchUrl',
        label: 'Application Launch URL',
        type: 'url',
        required: false,
        sensitive: false,
        group: 'smart',
        description: 'Where to redirect the user after successful SMART auth',
        dependsOn: { field: 'appType', value: ['provider-ehr', 'provider-standalone'] },
      },
    ],
  },

  drchrono: {
    ehrName: 'drchrono',
    label: 'DrChrono',
    description: 'DrChrono proprietary REST API with FHIR conversion',
    supportedAppTypes: ['provider-ehr', 'provider-standalone'],
    authMethod: 'form_post',
    fhirVersion: 'R4',
    fields: [
      {
        key: 'appType',
        label: 'App Type',
        type: 'select',
        required: true,
        sensitive: false,
        group: 'oauth',
        options: [
          { value: 'provider-ehr', label: 'Provider (EHR Launch)' },
          { value: 'provider-standalone', label: 'Provider (Standalone Launch)' },
        ],
        defaultValue: 'provider-ehr',
      },
      { key: 'clientId', label: 'Client ID', type: 'text', required: true, sensitive: false, group: 'credentials' },
      {
        key: 'clientSecret',
        label: 'Client Secret',
        type: 'password',
        required: false,
        sensitive: true,
        group: 'credentials',
        description: 'Required for confidential apps. Leave empty for public apps (PKCE only).',
      },
      {
        key: 'code',
        label: 'Authorization Code',
        type: 'text',
        required: true,
        sensitive: true,
        group: 'oauth',
        description: 'OAuth authorization code from DrChrono redirect',
      },
      {
        key: 'baseUrl',
        label: 'API Base URL',
        type: 'url',
        required: false,
        sensitive: false,
        group: 'urls',
        description: 'Override of the catalog default. Used as ISS for the launch redirect.',
        dependsOn: { field: 'appType', value: 'provider-standalone' },
      },
      {
        key: 'authUrl',
        label: 'Auth URL',
        type: 'url',
        required: false,
        sensitive: false,
        group: 'urls',
        description: 'Override of the catalog default. Token endpoint for client_credentials grant.',
        dependsOn: { field: 'appType', value: 'system' },
      },
      {
        key: 'launchUrl',
        label: 'Application Launch URL',
        type: 'url',
        required: false,
        sensitive: false,
        group: 'smart',
        description: 'Where to redirect the user after successful SMART auth',
      },
    ],
  },

  elation: {
    ehrName: 'elation',
    label: 'Elation EMR',
    description: 'Elation REST API with FHIR conversion',
    supportedAppTypes: ['system', 'provider-ehr', 'provider-standalone'],

    authMethod: 'form_post',
    fhirVersion: 'R4',
    fields: [
      {
        key: 'appType',
        label: 'App Type',
        type: 'select',
        required: true,
        sensitive: false,
        group: 'oauth',
        options: [
          { value: 'system', label: 'System (Backend)' },
          { value: 'provider-ehr', label: 'Provider (EHR Launch)' },
          { value: 'provider-standalone', label: 'Provider (Standalone Launch)' },
        ],
        defaultValue: 'system',
      },
      { key: 'clientId', label: 'Client ID', type: 'text', required: true, sensitive: false, group: 'credentials' },
      {
        key: 'clientSecret',
        label: 'Client Secret',
        type: 'password',
        required: false,
        sensitive: true,
        group: 'credentials',
        description: 'Required for confidential apps. Leave empty for public apps (PKCE only).',
      },
      {
        key: 'baseUrl',
        label: 'API Base URL',
        type: 'url',
        required: false,
        sensitive: false,
        group: 'urls',
        description:
          'Override of the catalog default. For system: used directly. For provider-standalone: used as ISS for the launch redirect.',
        dependsOn: { field: 'appType', value: ['system', 'provider-standalone'] },
      },
      {
        key: 'authUrl',
        label: 'Token URL',
        type: 'url',
        required: false,
        sensitive: false,
        group: 'urls',
        description: 'Override of the catalog default. Token endpoint for client_credentials grant.',
        dependsOn: { field: 'appType', value: 'system' },
      },
      {
        key: 'launchUrl',
        label: 'Application Launch URL',
        type: 'url',
        required: false,
        sensitive: false,
        group: 'smart',
        description: 'Where to redirect the user after successful SMART auth',
        dependsOn: { field: 'appType', value: ['provider-ehr', 'provider-standalone'] },
      },
    ],
  },

  meditech: {
    ehrName: 'meditech',
    label: 'MEDITECH',
    description: 'MEDITECH FHIR R4/STU6 integration',
    supportedAppTypes: ['provider-ehr', 'provider-standalone'],
    authMethod: 'json_body',
    fhirVersion: 'R4+STU6',
    fields: [
      {
        key: 'appType',
        label: 'App Type',
        type: 'select',
        required: true,
        sensitive: false,
        group: 'oauth',
        options: [
          { value: 'provider-ehr', label: 'Provider (EHR Launch)' },
          { value: 'provider-standalone', label: 'Provider (Standalone Launch)' },
        ],
        defaultValue: 'provider-ehr',
      },
      { key: 'clientId', label: 'Client ID', type: 'text', required: true, sensitive: false, group: 'credentials' },
      {
        key: 'clientSecret',
        label: 'Client Secret',
        type: 'password',
        required: false,
        sensitive: true,
        group: 'credentials',
        description: 'Required for confidential apps. Leave empty for public apps (PKCE only).',
      },
      {
        key: 'code',
        label: 'Authorization Code',
        type: 'text',
        required: true,
        sensitive: true,
        group: 'oauth',
        description: 'OAuth code from MEDITECH redirect',
      },
      {
        key: 'baseUrl',
        label: 'FHIR Base URL',
        type: 'url',
        required: false,
        sensitive: false,
        group: 'urls',
        description: 'Override of the catalog default. Used as ISS for the launch redirect.',
        dependsOn: { field: 'appType', value: 'provider-standalone' },
      },
      {
        key: 'authUrl',
        label: 'Token URL',
        type: 'url',
        required: false,
        sensitive: false,
        group: 'urls',
        description: 'Override of the catalog default. Token endpoint for client_credentials grant.',
        dependsOn: { field: 'appType', value: 'system' },
      },
      {
        key: 'launchUrl',
        label: 'Application Launch URL',
        type: 'url',
        required: false,
        sensitive: false,
        group: 'smart',
        description: 'Where to redirect the user after successful SMART auth',
      },
    ],
  },

  medent: {
    ehrName: 'medent',
    label: 'MEDENT',
    description: 'MEDENT FHIR R4 pass-through',
    supportedAppTypes: ['system'],
    authMethod: 'bearer_token',
    fhirVersion: 'R4',
    fields: [
      {
        key: 'appType',
        label: 'App Type',
        type: 'select',
        required: true,
        sensitive: false,
        group: 'oauth',
        options: [{ value: 'system', label: 'System' }],
        defaultValue: 'system',
      },
      {
        key: 'accountId',
        label: 'Account ID',
        type: 'text',
        required: true,
        sensitive: false,
        group: 'identifiers',
        description: 'Used in all FHIR endpoint paths',
        perSite: true,
      },
      {
        key: 'baseUrl',
        label: 'FHIR Base URL',
        type: 'url',
        required: false,
        sensitive: false,
        group: 'urls',
        description: 'Override of the catalog default.',
      },
    ],
  },

  greenways: {
    ehrName: 'greenways',
    label: 'Greenway Health',
    description: 'Greenway Health FHIR R4 pass-through',
    supportedAppTypes: ['system'],
    authMethod: 'bearer_token',
    fhirVersion: 'R4',
    fields: [
      {
        key: 'appType',
        label: 'App Type',
        type: 'select',
        required: true,
        sensitive: false,
        group: 'oauth',
        options: [{ value: 'system', label: 'System' }],
        defaultValue: 'system',
      },
      {
        key: 'tenant',
        label: 'Tenant ID',
        type: 'text',
        required: true,
        sensitive: false,
        group: 'identifiers',
        description: 'Used in all FHIR endpoint paths',
        perSite: true,
      },
      {
        key: 'baseUrl',
        label: 'FHIR Base URL',
        type: 'url',
        required: false,
        sensitive: false,
        group: 'urls',
        description: 'Override of the catalog default.',
      },
    ],
  },
};

/** Get field definitions for a specific EHR. */
export function getEhrDefinition(ehrName: string): EhrDefinition | undefined {
  return EHR_DEFINITIONS[ehrName];
}

/** Get all EHR definitions. */
export function getAllEhrDefinitions(): EhrDefinition[] {
  return Object.values(EHR_DEFINITIONS);
}

/**
 * Get an enriched definition with URL defaults from EHR_ENDPOINTS,
 * resolved for a specific appType AND the current deployment env.
 *
 * Each `baseUrl`/`authUrl` field gets its default from the deployment-active
 * side of the static catalog (sandbox side on cert deployment, prod side on
 * prod deployment).
 */
export function getEnrichedDefinition(ehrName: string, appType?: string): EhrDefinition | undefined {
  const def = EHR_DEFINITIONS[ehrName];
  if (!def) return undefined;

  const resolvedAppType = appType || def.supportedAppTypes[0];
  const endpoints = getDefaultEndpoints(ehrName, resolvedAppType);
  const envSuffix = isProdDeployment() ? 'Prod' : 'Test';

  const enrichedFields: EhrFieldDefinition[] = def.fields.map((field) => {
    const enriched = { ...field };

    // Inject URL defaults from EHR_ENDPOINTS — pick the deployment-env side of the catalog.
    // e.g. `baseUrl` field default reads from `baseUrlProd` on prod, `baseUrlTest` on cert.
    if (endpoints && ENDPOINT_FIELD_KEYS.includes(field.key)) {
      const catalogKey = `${field.key}${envSuffix}` as keyof EhrEndpointSet;
      const val = endpoints[catalogKey] ?? endpoints[`${field.key}Test` as keyof EhrEndpointSet];
      if (val) enriched.defaultValue = val;
    }

    return enriched;
  });

  return { ...def, fields: enrichedFields };
}

/**
 * Get all enriched definitions (useful for the definitions list endpoint).
 * Uses first supported appType for each EHR.
 */
export function getAllEnrichedDefinitions(): EhrDefinition[] {
  return Object.keys(EHR_DEFINITIONS).map((ehrName) => getEnrichedDefinition(ehrName)!);
}

/** Get field definitions that are per-site for a given EHR. */
export function getPerSiteFields(ehrName: string): EhrFieldDefinition[] {
  const def = EHR_DEFINITIONS[ehrName];
  if (!def) return [];
  return def.fields.filter((f) => f.perSite);
}

/** Check if an EHR supports multi-site (has per-site fields). */
export function supportsMultiSite(ehrName: string): boolean {
  return getPerSiteFields(ehrName).length > 0;
}

/**
 * Build a unique siteKey from EHR identifiers.
 * Used to prevent duplicate sites within the same integration.
 *
 * Format: {ehrName}:{identifier} — e.g., "cerner:ec2458f2-..."
 */
export function buildSiteKey(ehrName: string, siteIdentifiers: Record<string, any>): string {
  const id =
    siteIdentifiers.tenant || siteIdentifiers.accountId || siteIdentifiers.siteId || siteIdentifiers.practiceId;

  if (id) return `${ehrName}:${id}`;

  // Fallback: hash the full identifiers object for EHRs without a single unique field
  const hash = createHash('sha256').update(JSON.stringify(siteIdentifiers)).digest('hex').slice(0, 16);
  return `${ehrName}:${hash}`;
}

/** Validate ehrConfig values against field definitions. Returns errors. */
export function validateEhrConfig(ehrName: string, config: Record<string, any>): { field: string; message: string }[] {
  const definition = EHR_DEFINITIONS[ehrName];
  if (!definition) return [{ field: 'ehrName', message: `Unknown EHR: ${ehrName}` }];

  const errors: { field: string; message: string }[] = [];

  for (const field of definition.fields) {
    // JWK fields are stored in AWS Secrets Manager, not in ehrConfig — skip DB validation.
    // JWK presence is validated separately via the /jwks/status endpoint.
    if (field.type === 'jwk') continue;

    // Per-site fields live in EhrSiteConfig, not ehrConfig — skip.
    if (field.perSite) continue;

    // Skip fields whose dependency condition is not met
    if (field.dependsOn) {
      const depValue = config[field.dependsOn.field];
      const allowed = Array.isArray(field.dependsOn.value)
        ? field.dependsOn.value.includes(depValue)
        : field.dependsOn.value === depValue;
      if (!allowed) continue;
    }

    const value = config[field.key];

    if (field.required && (value === undefined || value === null || value === '')) {
      errors.push({ field: field.key, message: `${field.label} is required` });
      continue;
    }

    if (value === undefined || value === null || value === '') continue;

    if (field.type === 'url' && typeof value === 'string') {
      try {
        new URL(value);
      } catch {
        errors.push({ field: field.key, message: `${field.label} must be a valid URL` });
      }
    }

    if (field.type === 'json' && typeof value === 'string') {
      try {
        JSON.parse(value);
      } catch {
        errors.push({ field: field.key, message: `${field.label} must be valid JSON` });
      }
    }

    if (field.validation?.pattern && typeof value === 'string') {
      if (!new RegExp(field.validation.pattern).test(value)) {
        errors.push({ field: field.key, message: `${field.label} format is invalid` });
      }
    }

    if (field.validation?.minLength && typeof value === 'string' && value.length < field.validation.minLength) {
      errors.push({
        field: field.key,
        message: `${field.label} must be at least ${field.validation.minLength} characters`,
      });
    }

    if (field.options && !field.options.some((o) => o.value === value)) {
      errors.push({ field: field.key, message: `${field.label} has invalid value: ${value}` });
    }
  }

  return errors;
}

import { isProdDeployment } from './deployment-env';

// ─── Single Source of Truth: EHR URLs per ehrName × appType × environment ─────
//
// All EHR base URLs and auth URLs live here. Vendor services, admin UI, and
// the connection controller all read from this file.
//
// The catalog stores BOTH sandbox and production URLs per EHR. At runtime,
// resolvers pick the right side based on `getDeploymentEnv()` — cert deployments
// hit sandbox endpoints, prod deployments hit production endpoints.
//
// Resolution priority (at runtime):
//   1. Stored ehrConfig override (admin-configured `baseUrl` / `authUrl`)
//   2. This file — active side picked by deployment env

export interface EhrEndpointSet {
  baseUrlTest: string | null;
  baseUrlProd: string | null;
  authUrlTest: string | null;
  authUrlProd: string | null;
  /** Extra URLs some EHRs need (e.g. tokenUrl, fhirBaseUrl, expiryUrl) */
  [key: string]: string | null | undefined;
}

export const EHR_ENDPOINTS: Record<string, Record<string, EhrEndpointSet>> = {
  // ── Epic ────────────────────────────────────────────────────
  epic: {
    system: {
      baseUrlTest: 'https://fhir.epic.com/interconnect-fhir-oauth',
      baseUrlProd: null,
      authUrlTest: 'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token',
      authUrlProd: null,
    },
    provider: {
      baseUrlTest: 'https://fhir.epic.com/interconnect-fhir-oauth',
      baseUrlProd: 'https://fhir.epic.com/interconnect-fhir-oauth',
      authUrlTest: 'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token',
      authUrlProd: 'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token',
      authorizeUrlTest: 'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/authorize',
      authorizeUrlProd: null,
    },
    patient: {
      baseUrlTest: 'https://fhir.epic.com/interconnect-fhir-oauth',
      baseUrlProd: 'https://fhir.epic.com/interconnect-fhir-oauth',
      authUrlTest: 'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token',
      authUrlProd: 'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token',
      authorizeUrlTest: 'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/authorize',
      authorizeUrlProd: null,
    },
  },

  // ── Cerner (Oracle Health) ──────────────────────────────────
  // URLs contain {tenant} placeholder — resolved at runtime
  cerner: {
    system: {
      baseUrlTest: 'https://fhir-ehr.sandboxcerner.com/r4/{tenant}',
      baseUrlProd: 'https://fhir-ehr.cerner.com/r4/{tenant}',
      authUrlTest: 'https://authorization.sandboxcerner.com/tenants/{tenant}/protocols/oauth2/profiles/smart-v1/token',
      authUrlProd: 'https://authorization.cerner.com/tenants/{tenant}/protocols/oauth2/profiles/smart-v1/token',
    },
    provider: {
      baseUrlTest: 'https://fhir-ehr-code.cerner.com/r4/{tenant}',
      baseUrlProd: 'https://fhir-ehr-code.cerner.com/r4/{tenant}',
      authUrlTest: 'https://authorization.sandboxcerner.com/tenants/{tenant}/protocols/oauth2/profiles/smart-v1/token',
      authUrlProd: 'https://authorization.cerner.com/tenants/{tenant}/protocols/oauth2/profiles/smart-v1/token',
      authorizeUrlTest:
        'https://authorization.sandboxcerner.com/tenants/{tenant}/protocols/oauth2/profiles/smart-v1/personas/provider/authorize',
      authorizeUrlProd:
        'https://authorization.cerner.com/tenants/{tenant}/protocols/oauth2/profiles/smart-v1/personas/provider/authorize',
    },
    patient: {
      baseUrlTest: 'https://fhir-ehr.sandboxcerner.com/r4/{tenant}',
      baseUrlProd: 'https://fhir-ehr.cerner.com/r4/{tenant}',
      authUrlTest: 'https://authorization.sandboxcerner.com/tenants/{tenant}/protocols/oauth2/profiles/smart-v1/token',
      authUrlProd: 'https://authorization.cerner.com/tenants/{tenant}/protocols/oauth2/profiles/smart-v1/token',
      authorizeUrlTest:
        'https://authorization.sandboxcerner.com/tenants/{tenant}/protocols/oauth2/profiles/smart-v1/personas/patient/authorize',
      authorizeUrlProd:
        'https://authorization.cerner.com/tenants/{tenant}/protocols/oauth2/profiles/smart-v1/personas/patient/authorize',
    },
  },

  // ── athenahealth ────────────────────────────────────────────
  athenanet: {
    system: {
      baseUrlTest: 'https://api.preview.platform.athenahealth.com',
      baseUrlProd: 'https://api.platform.athenahealth.com',
      authUrlTest: 'https://api.preview.platform.athenahealth.com/oauth2/v1/token',
      authUrlProd: 'https://api.platform.athenahealth.com/oauth2/v1/token',
    },
    provider: {
      baseUrlTest: 'https://api.preview.platform.athenahealth.com',
      baseUrlProd: 'https://api.platform.athenahealth.com',
      authUrlTest: 'https://myidentity-support.platform.athenahealth.com/oauth2/v1/token',
      authUrlProd: 'https://myidentity.platform.athenahealth.com/oauth2/v1/token',
      authorizeUrlTest: 'https://myidentity-support.platform.athenahealth.com/oauth2/v1/authorize',
      authorizeUrlProd: 'https://myidentity.platform.athenahealth.com/oauth2/v1/authorize',
    },
    patient: {
      baseUrlTest: 'https://api.preview.platform.athenahealth.com',
      baseUrlProd: 'https://api.platform.athenahealth.com',
      authUrlTest: 'https://myidentity-support.platform.athenahealth.com/oauth2/v1/token',
      authUrlProd: 'https://myidentity.platform.athenahealth.com/oauth2/v1/token',
      authorizeUrlTest: 'https://myidentity-support.platform.athenahealth.com/oauth2/v1/authorize',
      authorizeUrlProd: 'https://myidentity.platform.athenahealth.com/oauth2/v1/authorize',
    },
  },

  // ── NextGen ─────────────────────────────────────────────────
  nextgen: {
    system: {
      baseUrlTest: 'https://nativeapi.nextgen.com',
      baseUrlProd: 'https://nativeapi.nextgen.com',
      authUrlTest: 'https://nativeapi.nextgen.com/nge/prod/nge-oauth/token',
      authUrlProd: 'https://nativeapi.nextgen.com/nge/prod/nge-oauth/token',
      fhirBaseUrlTest: 'https://fhir.nextgen.com/nge/prod/fhir-api-r4/fhir/R4',
    },
    provider: {
      baseUrlTest: 'https://nativeapi.nextgen.com',
      baseUrlProd: 'https://nativeapi.nextgen.com',
      authUrlTest: 'https://nativeapi.nextgen.com/nge/prod/nge-oauth/token',
      authUrlProd: 'https://nativeapi.nextgen.com/nge/prod/nge-oauth/token',
      authorizeUrlTest: 'https://nativeapi.nextgen.com/nge/prod/nge-oauth/authorize',
      authorizeUrlProd: 'https://nativeapi.nextgen.com/nge/prod/nge-oauth/authorize',
      fhirBaseUrlTest: 'https://fhir.nextgen.com/nge/prod/fhir-api-r4/fhir/R4',
    },
    patient: {
      baseUrlTest: 'https://nativeapi.nextgen.com/nge/prod/nge-api/api',
      baseUrlProd: 'https://nativeapi.nextgen.com/nge/prod/nge-api/api',
      authUrlTest: 'https://nativeapi.nextgen.com/nge/prod/patient-oauth/token',
      authUrlProd: 'https://nativeapi.nextgen.com/nge/prod/patient-oauth/token',
      authorizeUrlTest: 'https://nativeapi.nextgen.com/nge/prod/patient-oauth/authorize',
      authorizeUrlProd: 'https://nativeapi.nextgen.com/nge/prod/patient-oauth/authorize',
    },
  },

  // ── eClinicalWorks ──────────────────────────────────────────
  // URLs contain {tenant} placeholder
  eclinicalworks: {
    system: {
      baseUrlTest: 'https://staging-fhir.ecwcloud.com/fhir/r4/{tenant}',
      baseUrlProd: null,
      authUrlTest: 'https://staging-oauthserver.ecwcloud.com/oauth/oauth2/token',
      authUrlProd: null,
      tokenUrlTest: 'https://staging-oauthserver.ecwcloud.com/oauth/oauth2/token',
    },
    provider: {
      baseUrlTest: 'https://staging-fhir.ecwcloud.com/fhir/r4/{tenant}',
      baseUrlProd: null,
      authUrlTest: 'https://staging-oauthserver.ecwcloud.com/oauth/oauth2/token',
      authUrlProd: null,
      tokenUrlTest: 'https://staging-oauthserver.ecwcloud.com/oauth/oauth2/token',
      tokenUrlProd: null,
      authorizeUrlTest: 'https://staging-oauthserver.ecwcloud.com/oauth/oauth2/authorize',
      authorizeUrlProd: null,
    },
    patient: {
      baseUrlTest: 'https://staging-fhir.ecwcloud.com/fhir/r4/{tenant}',
      baseUrlProd: null,
      authUrlTest: 'https://staging-oauthserver.ecwcloud.com/oauth/oauth2/token',
      authUrlProd: null,
      tokenUrlTest: 'https://staging-oauthserver.ecwcloud.com/oauth/oauth2/token',
      tokenUrlProd: null,
      authorizeUrlTest: 'https://staging-oauthserver.ecwcloud.com/oauth/oauth2/authorize',
      authorizeUrlProd: null,
    },
  },

  // ── DrChrono ────────────────────────────────────────────────
  drchrono: {
    provider: {
      baseUrlTest: 'https://app.drchrono.com',
      baseUrlProd: null,
      authUrlTest: 'https://drchrono.com/o/token/',
      authUrlProd: null,
      tokenUrlTest: 'https://drchrono.com/o/token/',
      tokenUrlProd: null,
      authorizeUrlTest: 'https://drchrono.com/o/authorize',
      authorizeUrlProd: null,
    },
    patient: {
      baseUrlTest: 'https://app.drchrono.com',
      baseUrlProd: null,
      authUrlTest: 'https://drchrono.com/o/token/',
      authUrlProd: null,
      tokenUrlTest: 'https://drchrono.com/o/token/',
      tokenUrlProd: null,
      authorizeUrlTest: 'https://drchrono.com/o/authorize',
      authorizeUrlProd: null,
    },
  },

  // ── Elation EMR ─────────────────────────────────────────────
  elation: {
    system: {
      baseUrlTest: 'https://sandbox.elationemr.com/api/2.0',
      baseUrlProd: null,
      authUrlTest: 'https://sandbox.elationemr.com/api/2.0/oauth2/token/',
      authUrlProd: null,
    },
    provider: {
      baseUrlTest: 'https://sandbox.elationemr.com/api/2.0',
      baseUrlProd: null,
      authUrlTest: 'https://sandbox.elationemr.com/api/2.0/oauth2/token/',
      authUrlProd: null,
      authorizeUrlTest: 'https://sandbox.elationemr.com/api/2.0/oauth2/authorize/',
      authorizeUrlProd: null,
    },
  },

  // ── MEDITECH ────────────────────────────────────────────────
  meditech: {
    provider: {
      baseUrlTest: 'https://greenfield-prod-apis.meditech.com',
      baseUrlProd: null,
      authUrlTest: 'https://greenfield-prod-apis.meditech.com/oauth/token',
      authUrlProd: null,
      authorizeUrlTest: 'https://greenfield-prod-apis.meditech.com/oauth/authorize',
      authorizeUrlProd: null,
    },
    patient: {
      baseUrlTest: 'https://greenfield-prod-apis.meditech.com',
      baseUrlProd: null,
      authUrlTest: 'https://greenfield-prod-apis.meditech.com/oauth/token',
      authUrlProd: null,
      authorizeUrlTest: 'https://greenfield-prod-apis.meditech.com/oauth/authorize',
      authorizeUrlProd: null,
    },
  },

  // ── MEDENT ──────────────────────────────────────────────────
  medent: {
    system: {
      baseUrlTest: 'https://www.medentfhir.com/fhir/R4',
      baseUrlProd: 'https://www.medentfhir.com/fhir/R4',
      authUrlTest: null,
      authUrlProd: null,
    },
  },

  // ── Greenway Health ─────────────────────────────────────────
  greenways: {
    system: {
      baseUrlTest: 'https://fhir-api.fhirprod.aws.greenwayhealth.com',
      baseUrlProd: 'https://fhir-api.fhirprod.aws.greenwayhealth.com',
      authUrlTest: null,
      authUrlProd: null,
    },
  },
};

// ─── Resolution Functions ────────────────────────────────────

/** Get default endpoints for an EHR + appType. */
export function getDefaultEndpoints(ehrName: string, appType: string): EhrEndpointSet | null {
  return EHR_ENDPOINTS[ehrName]?.[appType] ?? null;
}

/** Get all appTypes that have endpoints for an EHR. */
export function getEndpointAppTypes(ehrName: string): string[] {
  return Object.keys(EHR_ENDPOINTS[ehrName] ?? {});
}

/**
 * Apply template substitution to a URL string.
 * Replaces {tenant}, {accountId}, {siteId} with actual values.
 */
function applyTemplateVars(url: string, vars: Record<string, any>): string {
  let result = url;
  for (const [key, value] of Object.entries(vars)) {
    if (value != null && typeof value === 'string') {
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    }
  }
  return result;
}

/**
 * Resolve endpoints with override priority:
 *   overrides (payload/stored config) > EHR_ENDPOINTS defaults
 *
 * Handles template substitution ({tenant}, {accountId}, {siteId}).
 */
export function resolveEndpoints(
  ehrName: string,
  appType: string,
  overrides: Record<string, any> = {},
): EhrEndpointSet {
  const defaults = EHR_ENDPOINTS[ehrName]?.[appType] ?? {
    baseUrlTest: null,
    baseUrlProd: null,
    authUrlTest: null,
    authUrlProd: null,
  };

  // Merge: overrides win over defaults for the 4 standard keys + any extras
  const allKeys = new Set([...Object.keys(defaults), 'baseUrlTest', 'baseUrlProd', 'authUrlTest', 'authUrlProd']);
  const resolved: Record<string, string | null> = {};
  for (const key of allKeys) {
    resolved[key] = overrides[key] || defaults[key] || null;
  }

  // Template substitution
  const templateVars: Record<string, any> = {
    tenant: overrides.tenant,
    accountId: overrides.accountId,
    siteId: overrides.siteId,
  };

  for (const key of Object.keys(resolved)) {
    if (resolved[key] && typeof resolved[key] === 'string') {
      resolved[key] = applyTemplateVars(resolved[key]!, templateVars);
    }
  }

  return resolved as EhrEndpointSet;
}

/**
 * Resolve the active FHIR base URL — picks the sandbox/prod side of the catalog
 * based on the deployment env, with a single-value `baseUrl` override from
 * stored config winning over everything.
 */
export function resolveBaseUrl(ehrName: string, appType: string, overrides: Record<string, any> = {}): string {
  if (overrides.baseUrl) return applyTemplateVars(overrides.baseUrl, overrides);
  const endpoints = resolveEndpoints(ehrName, appType, overrides);
  const key = isProdDeployment() ? 'baseUrlProd' : 'baseUrlTest';
  return (endpoints[key] || endpoints.baseUrlTest) as string;
}

/** Resolve the active auth/token URL for the current deployment env. */
export function resolveAuthUrl(ehrName: string, appType: string, overrides: Record<string, any> = {}): string {
  if (overrides.authUrl) return applyTemplateVars(overrides.authUrl, overrides);
  const endpoints = resolveEndpoints(ehrName, appType, overrides);
  const key = isProdDeployment() ? 'authUrlProd' : 'authUrlTest';
  return (endpoints[key] || endpoints.authUrlTest) as string;
}

/** Resolve a named extra URL (e.g. tokenUrl, fhirBaseUrl) for the current deployment env. */
export function resolveExtraUrl(
  ehrName: string,
  appType: string,
  urlKey: string,
  overrides: Record<string, any> = {},
): string | null {
  // Single-value override wins
  if (overrides[urlKey]) return applyTemplateVars(overrides[urlKey], overrides);
  const endpoints = resolveEndpoints(ehrName, appType, overrides);
  const testKey = `${urlKey}Test`;
  const prodKey = `${urlKey}Prod`;
  const key = isProdDeployment() ? prodKey : testKey;
  return (endpoints[key] || endpoints[testKey]) ?? null;
}

// ─── FHIR Route Registry Types ───────────────────────────────

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type ScopeOperation = 'read' | 'write';

export interface FhirRouteEntry {
  method: HttpMethod;
  path: string;
  resource: string;
  operation: ScopeOperation;
  scope: string;
  event: string;
  serviceMethod: string;
  ehrSupported: string[];
}

export interface RouteScopeEntry {
  scope: string;
  resource: string;
  operation: ScopeOperation;
  ehrSupported: string[];
}

export interface RouteCheckResult {
  allowed: boolean;
  requiredScope?: string;
  reason?: string;
}

// ─── EHR Field Definition Types ──────────────────────────────

export interface EhrFieldOption {
  value: string;
  label: string;
}

export type EhrFieldType = 'text' | 'url' | 'password' | 'json' | 'jwk' | 'select' | 'boolean' | 'textarea';
export type EhrFieldGroup = 'credentials' | 'urls' | 'identifiers' | 'oauth' | 'smart';
export type EhrAuthMethod = 'jwt_bearer' | 'basic_auth' | 'form_post' | 'json_body' | 'bearer_token';

export interface EhrFieldValidation {
  pattern?: string;
  minLength?: number;
  maxLength?: number;
}

export interface EhrFieldDependency {
  field: string;
  value: any;
}

export interface EhrFieldDefinition {
  key: string;
  label: string;
  type: EhrFieldType;
  required: boolean;
  sensitive: boolean;
  group: EhrFieldGroup;
  description?: string;
  placeholder?: string;
  options?: EhrFieldOption[];
  defaultValue?: any;
  validation?: EhrFieldValidation;
  dependsOn?: EhrFieldDependency;
  /** If true, this field is per-site (managed via EhrSiteConfig, not ehrConfig). */
  perSite?: boolean;
}

export interface EhrDefinition {
  ehrName: string;
  label: string;
  description: string;
  supportedAppTypes: string[];
  authMethod: EhrAuthMethod;
  fhirVersion: string;
  fields: EhrFieldDefinition[];
}

/**
 * Resolve OAuth grant type from app type.
 * system → client_credentials (backend service)
 * provider/patient → authorization_code (SMART launch)
 */
export function resolveGrantType(appType: string): string {
  return appType === 'system' ? 'client_credentials' : 'authorization_code';
}

/**
 * Extract credentials from stored config.
 * Each deployment stores credentials for its own env, so no env branching here.
 */
export function resolveCredentials(config: Record<string, any>): { clientId: string; clientSecret: any } {
  return {
    clientId: config.clientId,
    clientSecret: config.clientSecret,
  };
}

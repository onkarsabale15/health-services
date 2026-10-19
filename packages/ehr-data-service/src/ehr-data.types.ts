import type { EhrClientConfig } from './core/interfaces/ehr-client-config.interface';
import type { EhrConfig, EhrConfigName } from './core/interfaces/ehr-config.interface';
import type { PrivateJwkSet } from './core/interfaces/ehr-service.interface';

/**
 * Flat site data — everything needed to make an EHR API call.
 * No nesting. Bridge interceptor builds this from DB, bridge controllers pass it through.
 *
 * `integrationId` was removed from `EhrClientConfig` — siteId is the canonical
 * runtime identifier. SiteData retains `integrationId` (loose, via index sig)
 * for bridge-api's internal JWKS-secret-name fallback paths only; do NOT
 * propagate into EhrClientConfig.
 */
export interface SiteData {
  /** EhrSiteConfig.id */
  siteId: string;
  /** EHR vendor name (e.g., 'epic', 'cerner', 'athenanet') */
  ehrName: string;
  /** Application type for URL resolution ('system' | 'patient' | 'provider') */
  appType: string;
  /** OAuth scopes for the EHR token request */
  ehrTokenScopes: string[];
  /** JWK key set for JWT assertion vendors */
  jwks?: PrivateJwkSet;
  /** All vendor-specific fields are flat (clientId, clientSecret, tenant, accountId, etc.) */
  [key: string]: string | string[] | number | boolean | undefined | unknown | PrivateJwkSet;
}

/**
 * Converts flat SiteData (DB format) to structured EhrClientConfig (Service format).
 *
 * `SiteData.ehrName` is `string` (loose from DB layer); cast to `EhrConfigName`
 * at this boundary — runtime contract: admin-api MUST persist only valid
 * vendor names (validated server-side). The inner `ehrConfig` is shaped per
 * vendor (see `EhrConfig` discriminated union); we attach `ehrName` to it so
 * the discriminator matches and TS narrowing works downstream.
 */
export function toEhrConfig(sd: SiteData): EhrClientConfig {
  // `integrationId` is intentionally dropped here — siteId is canonical.
  // The destructure strips it from the vendor-config residue if present.
  const {
    integrationId: _,
    siteId,
    ehrName,
    appType,
    ehrTokenScopes,
    jwks,
    ...rest
  } = sd as SiteData & {
    integrationId?: string;
  };
  void _;
  const ehrNameTyped = ehrName as EhrConfigName;
  return {
    siteId,
    ehrName: ehrNameTyped,
    appType,
    ehrConfig: { ehrName: ehrNameTyped, ...rest } as unknown as EhrConfig,
    ehrTokenScopes,
    jwks,
  };
}

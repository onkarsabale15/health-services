import type { PrivateJwkSet } from './ehr-service.interface';
import type { EhrConfig, EhrConfigName } from './ehr-config.interface';

/**
 * Configuration for making authenticated EHR API calls.
 * Built from AppEhrAccess DB record + resolved JWKS.
 * Passed to BaseEhrService methods which handle token management internally.
 *
 * The `ehrConfig` field is a discriminated union keyed by `ehrName`. See
 * `./ehr-config.interface.ts` for per-vendor shapes. The outer `ehrName`
 * here MUST match the inner `ehrConfig.ehrName` (invariant: both source
 * from `AppEhrAccess.ehrName` in DB).
 */
export interface EhrClientConfig {
  /**
   * EhrSiteConfig.id — the canonical, globally-unique identifier for the
   * vendor instance this config targets. The parent AppEhrAccess
   * (integration) is derivable via DB FK; callers that need the integration
   * resolve it on demand. Token cache + lock keys are keyed solely on this.
   */
  siteId: string;

  /** EHR vendor name. Must equal `ehrConfig.ehrName`. */
  ehrName: EhrConfigName;

  /** Application type for URL resolution ('system' | 'patient' | 'provider') */
  appType: string;

  /** Vendor-specific config — discriminated union by `ehrName`. */
  ehrConfig: EhrConfig;

  /** OAuth scopes for the EHR token request */
  ehrTokenScopes: string[];

  /** JWK key set for JWT assertion vendors (Epic, eClinicalWorks). Loaded from Secrets Manager. */
  jwks?: PrivateJwkSet;
}

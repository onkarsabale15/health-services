/**
 * Vendor-specific `ehrConfig` shapes — a discriminated union typed by `ehrName`.
 *
 * Replaces the previous `Record<string, unknown>` so each consumer (vendor
 * service, mcp-app, workflow-app, admin-api when persisting) gets compile-time
 * guarantees about which fields exist per vendor.
 *
 * **Source of truth for vendor field requirements:**
 * - Each vendor's `getToken()` payload (`packages/ehr-data-service/src/vendors/{vendor}/{vendor}.service.ts`)
 * - `base-ehr.service.ts:buildConnectionData()` (line ~155) — which fields it reads from `ec`
 * - Each vendor's auth pattern documented in their service header
 *
 * **Discriminator:** the inner `ehrName` literal MUST match the outer
 * `EhrClientConfig.ehrName` (invariant by construction — both are sourced from
 * `AppEhrAccess.ehrName` in the DB).
 *
 * **Runtime additions:** `BaseEhrConfig` covers fields added at runtime
 * (not stored in DB): SMART session tokens, pre-resolved URLs.
 *
 * **Drift note (May 2026):** `packages/ehr-data-service/src/core/constants/ehr-enums.ts`
 * `EhrName` enum is stale — the factory registers vendors as lowercase
 * (`cerner`, `epic`, `athenanet`, ...) not as the camelCase values in that
 * enum. The discriminator literals below use the actual registered names.
 * Update the enum in a follow-up; this union is the new source of truth.
 */

// ─── Shared runtime overrides (set by callers, not stored in DB) ─────────────

interface BaseEhrConfig {
  /**
   * SMART launch session token override. When set, bypasses client_credentials
   * OAuth flow and uses this token directly. Refreshed via `_sessionRefreshToken`
   * on 401. Used by SMART-launched apps; not present in M2M / system configs.
   */
  _sessionToken?: string;

  /** Paired refresh token for SMART session apps. */
  _sessionRefreshToken?: string;

  /**
   * Pre-resolved FHIR base URL. When set, overrides the ehr-endpoints catalog
   * lookup. Set by smart-launch when ISS-pinning to a customer's instance.
   */
  resolvedBaseUrl?: string;

  /** Pre-resolved OAuth token endpoint. Same semantics as `resolvedBaseUrl`. */
  resolvedAuthUrl?: string;

  /** Extra pre-resolved URLs (e.g. `{ tokenUrl, fhirBaseUrl }`). Vendor-specific. */
  resolvedExtraUrls?: Record<string, string>;
}

// ─── Per-vendor configs ──────────────────────────────────────────────────────
//
// `ehrName` literal = the value registered in `ehr-data-service/src/init.ts`.
// Fields below mirror what each vendor's service code reads from `ec` (the
// `ehrConfig` alias inside `buildConnectionData`) plus what each `getToken()`
// payload destructures.

/**
 * Cerner Millennium — client_credentials grant via Basic auth, tenant-scoped URLs.
 * Token URL: `{authBase}/tenants/{tenant}/protocols/oauth2/profiles/smart-v1/token`
 */
export interface CernerEhrConfig extends BaseEhrConfig {
  ehrName: 'cerner';
  clientId: string;
  clientSecret: string;
  tenant: string;
  scope?: string;
  grantType?: string;
}

/**
 * Epic — client_credentials grant. Supports BOTH Basic auth (with `clientSecret`)
 * AND JWT assertion (`EhrClientConfig.jwks` set, no clientSecret). Tenant-scoped URLs.
 */
export interface EpicEhrConfig extends BaseEhrConfig {
  ehrName: 'epic';
  clientId: string;
  /** Set for Basic auth path; omitted for JWT assertion path (jwks set instead). */
  clientSecret?: string;
  tenant?: string;
  scope?: string;
  grantType?: string;
}

/**
 * AthenaNet — client_credentials grant via Basic auth, accountId-scoped URLs.
 * Proprietary REST + FHIR R4 dual surface.
 */
export interface AthenaEhrConfig extends BaseEhrConfig {
  ehrName: 'athenanet';
  clientId: string;
  clientSecret: string;
  accountId: string;
  scope?: string;
  grantType?: string;
}

/**
 * DrChrono — OAuth authorization-code grant. Requires user-mediated consent;
 * `code` is the one-time code from the authorize callback.
 */
export interface DrChronoEhrConfig extends BaseEhrConfig {
  ehrName: 'drchrono';
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  /** One-time auth code set during the authorize → token exchange. */
  code?: string;
  grantType?: string;
}

/**
 * eClinicalWorks — client_credentials with JWT client assertion (no clientSecret).
 * `EhrClientConfig.jwks` must be populated. Tenant-scoped URLs.
 */
export interface EclinicalworksEhrConfig extends BaseEhrConfig {
  ehrName: 'eclinicalworks';
  clientId: string;
  tenant: string;
  scope?: string;
  grantType?: string;
}

/**
 * Elation EMR — client_credentials grant. No tenant/account scoping.
 */
export interface ElationEhrConfig extends BaseEhrConfig {
  ehrName: 'elation';
  clientId: string;
  clientSecret: string;
  scope?: string;
  grantType?: string;
}

/**
 * MEDITECH — OAuth authorization-code grant. User-mediated; `code` is the
 * one-time code from the authorize callback.
 */
export interface MeditechEhrConfig extends BaseEhrConfig {
  ehrName: 'meditech';
  clientId: string;
  clientSecret: string;
  /** One-time auth code set during the authorize → token exchange. */
  code?: string;
  grantType?: string;
}

/**
 * NextGen — client_credentials grant, accountId (`x-enterprise-id`) + tenant
 * (`x-practice-id`) headers required. `siteId` distinguishes practices.
 */
export interface NextgenEhrConfig extends BaseEhrConfig {
  ehrName: 'nextgen';
  clientId: string;
  clientSecret: string;
  accountId: string;
  tenant: string;
  siteId?: string;
  scope?: string;
  grantType?: string;
}

/**
 * Greenways — FHIR R4 with tenant-scoped URLs. No documented OAuth flow in
 * current vendor implementation; reads `tenant` + `baseUrl` from connection data
 * for URL construction.
 */
export interface GreenwaysEhrConfig extends BaseEhrConfig {
  ehrName: 'greenways';
  tenant: string;
  /** Override the default Greenways base URL when set. */
  baseUrl?: string;
  /** Auth credentials if/when Greenways OAuth flow is implemented. */
  clientId?: string;
  clientSecret?: string;
}

/**
 * MEDENT — FHIR R4 with accountId-scoped URLs. Same shape as Greenways but
 * keyed by `accountId` instead of `tenant`.
 */
export interface MedentEhrConfig extends BaseEhrConfig {
  ehrName: 'medent';
  accountId: string;
  /** Override the default MEDENT base URL when set. */
  baseUrl?: string;
  clientId?: string;
  clientSecret?: string;
}

// ─── Discriminated union ─────────────────────────────────────────────────────

/**
 * The full vendor-config union. Use `EhrConfig['ehrName']` for the runtime
 * vendor-name literals, and `Extract<EhrConfig, { ehrName: T }>` to pick a
 * specific vendor's shape:
 *
 *   const cernerCfg: Extract<EhrConfig, { ehrName: 'cerner' }> = { ... };
 *
 * TypeScript narrowing works via `switch (config.ehrName)`:
 *
 *   switch (config.ehrName) {
 *     case 'cerner':
 *       // config is CernerEhrConfig here — tenant is required
 *       break;
 *     case 'epic':
 *       // config is EpicEhrConfig — clientSecret is optional
 *       break;
 *   }
 */
export type EhrConfig =
  | CernerEhrConfig
  | EpicEhrConfig
  | AthenaEhrConfig
  | DrChronoEhrConfig
  | EclinicalworksEhrConfig
  | ElationEhrConfig
  | MeditechEhrConfig
  | NextgenEhrConfig
  | GreenwaysEhrConfig
  | MedentEhrConfig;

/** Literal union of all supported `ehrName` values — derived from `EhrConfig`. */
export type EhrConfigName = EhrConfig['ehrName'];

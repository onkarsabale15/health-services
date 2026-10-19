/**
 * Typed representation of the connection data cached in Redis.
 * Created by ConnectionService.createConnection() and consumed by
 * EHR vendor services and bridge-api interceptors/guards.
 */
export interface ConnectionData {
  /** Unique connection identifier (UUIDv7) */
  connectionId: string;

  /** EHR vendor name (e.g., 'epic', 'cerner', 'athenanet') */
  ehrName: string;

  /** OAuth access token for the EHR */
  accessToken: string;

  /** Token expiry in seconds from creation */
  expiresIn: number;

  /** OAuth refresh token (some vendors) */
  refreshToken?: string;

  /** Application type ('system' | 'patient' | 'provider') */
  appType?: string;

  /** OAuth grant type used */
  grantType?: string;

  /** OAuth client ID */
  clientId?: string;

  /** OAuth client secret (confidential apps) */
  clientSecret?: string;

  /** OAuth scopes granted */
  scope?: string;

  // ── Vendor-specific fields ──

  /** Tenant identifier (Cerner, eClinicalWorks, Greenways) */
  tenant?: string;

  /** Account identifier (AthenaNet, NextGen, MEDENT) */
  accountId?: string;

  /** Site identifier (NextGen) */
  siteId?: string;

  /** Redirect URI (DrChrono, MEDITECH authorization code flow) */
  redirectUri?: string;

  // ── Resolved URLs (pre-computed at connection creation) ──

  /** Pre-resolved FHIR base URL */
  resolvedBaseUrl?: string;

  /** Pre-resolved auth/token URL */
  resolvedAuthUrl?: string;

  /** Pre-resolved extra URLs (tokenUrl, fhirBaseUrl, etc.) */
  resolvedExtraUrls?: Record<string, string>;

  // ── Injected by interceptor ──

  /** Token expiration timestamp (set by ConnectionDataInterceptor from request.user) */
  expiresAt?: number;

  /** Whether connection was returned from cache */
  cached?: boolean;

  /** Allow additional vendor-specific properties */
  [key: string]: unknown;
}

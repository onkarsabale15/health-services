import { SignJWT, importJWK } from 'jose';
import { v7 as uuidv7 } from 'uuid';
import { httpClient, secrets } from '@hs/infra';
import { logger } from '@hs/observability';
import type { ResolveAction } from '@hs/config';

const ALG = 'RS384';
const PLATFORM_JWKS_SECRET = 'HS_PLATFORM_JWKS';

/**
 * HTTP client for internal services → admin-api calls.
 *
 * Self-signs a JWT using the shared platform JWKS private key (from secrets manager).
 * The JWT includes `internal: true` claim, which admin-api's InternalOrAuthGuard
 * recognizes to grant internal service privileges (skip org boundary checks).
 *
 * Consumers (bridge-api, workflow-app, mcp-app, …) each instantiate one
 * `AdminClient` with their own service identifier — `bridge-service`,
 * `workflow-service`, `mcp-service` — so admin-api audit logs surface which
 * service made which call.
 *
 * No API keys, no token-for-app endpoint — just the shared JWKS.
 */
export class AdminClient {
  private token: string | null = null;
  private tokenExpiresAt = 0;
  private refreshing: Promise<string> | null = null;

  constructor(
    /**
     * Logical service identifier — used as JWT `sub` + `client_id` claim.
     * Surfaces in admin-api audit logs so cross-service calls are attributable.
     * Examples: `'bridge-service'`, `'workflow-service'`, `'mcp-service'`.
     */
    private readonly serviceName: string,
    /**
     * Admin-api base URL. Defaults to `process.env.ADMIN_API_URL` or
     * `http://localhost:3002` for local dev.
     */
    private readonly adminApiUrl: string = process.env.ADMIN_API_URL || 'http://localhost:3002',
    /**
     * OAuth issuer used in JWT `iss` claim. Defaults to `process.env.OAUTH_ISSUER`
     * or `http://localhost:3002`. Must match admin-api's issuer config.
     */
    private readonly issuer: string = process.env.OAUTH_ISSUER || 'http://localhost:3002',
  ) {}

  /** Get or refresh the self-signed internal service token (deduplicated) */
  private async getServiceToken(): Promise<string> {
    if (this.token && Date.now() < this.tokenExpiresAt - 60000) {
      return this.token;
    }

    if (this.refreshing) return this.refreshing;
    this.refreshing = this.signToken().finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }

  /** Sign a JWT with the platform's private key */
  private async signToken(): Promise<string> {
    const jwks = await secrets.getSecretValue<{ keys: any[] }>(PLATFORM_JWKS_SECRET);
    if (!jwks?.keys?.length) throw new Error('Platform JWKS not found in secrets manager');

    const signingKey = jwks.keys.find((k: any) => k.use === 'sig' && k.alg === ALG);
    if (!signingKey) throw new Error(`No signing key found with use=sig and alg=${ALG}`);

    const key = await importJWK(signingKey, ALG);
    const expiresIn = 3600;

    const token = await new SignJWT({
      token_type: 'api',
      internal: true,
      client_id: this.serviceName,
      org_id: 'system',
      scope: 'internal',
      app_type: this.serviceName.replace('-service', '').toUpperCase(),
    })
      .setProtectedHeader({ alg: ALG, kid: signingKey.kid, typ: 'JWT' })
      .setIssuer(this.issuer)
      .setSubject(this.serviceName)
      .setAudience(`${this.issuer}/api`)
      .setJti(uuidv7())
      .setIssuedAt()
      .setExpirationTime(`${expiresIn}s`)
      .sign(key);

    this.token = token;
    this.tokenExpiresAt = Date.now() + expiresIn * 1000;
    logger.info('Internal service token signed', { service: this.serviceName, expiresIn });
    return token;
  }

  // ── Application lookups ──────────────────────────────────────────────

  /** Lookup application by ID */
  async getApplication(id: string): Promise<any> {
    return this.lookup('application', { id });
  }

  /** Lookup application by clientId */
  async getApplicationByClientId(clientId: string): Promise<any> {
    return this.lookup('application', { clientId });
  }

  // ── Integration (AppEhrAccess) lookups ───────────────────────────────

  /** Lookup integration by applicationId + ehrName, optionally filtered by ehrAppType. */
  async getIntegration(applicationId: string, ehrName: string, ehrAppType?: string): Promise<any> {
    const params: Record<string, string> = { applicationId, ehrName };
    if (ehrAppType) params.ehrAppType = ehrAppType;
    return this.lookup('integration', params);
  }

  async getAppEhrConfig(clientId: string, ehrName: string): Promise<any> {
    return this.lookup('integration', { clientId, ehrName });
  }

  // ── Site (EhrSiteConfig) lookups ─────────────────────────────────────

  /**
   * Look up a site by siteId. Returns flat SiteData (admin-api pre-merges
   * AppEhrAccess.ehrConfig + EhrSiteConfig.siteIdentifiers + siteCredentials
   * + siteUrls into one record).
   *
   * THE canonical entry point for runtime EHR calls — every internal service
   * goes through this to obtain the credentials + URL config for a site.
   */
  async getSite(siteId: string): Promise<any> {
    return this.lookup('site', { siteId });
  }

  /** Lookup site by integration + vendor-specific identifier (e.g. tenant, accountId). */
  async getSiteByIdentifier(integrationId: string, identifiers: Record<string, string>): Promise<any> {
    return this.lookup('site', { integrationId, ...identifiers });
  }

  /** Generic lookup helper — calls /api/lookup/{resource}?key=value */
  private async lookup(resource: string, params: Record<string, string>): Promise<any> {
    const token = await this.getServiceToken();
    const query = new URLSearchParams(params).toString();
    const response = await httpClient.request<any>({
      url: `${this.adminApiUrl}/api/lookup/${resource}?${query}`,
      method: 'get',
      authType: 'Bearer',
      authToken: token,
    });
    return response.data;
  }

  // ── End-user access resolution (bridge SMART launch path) ────────────

  /** Resolve EHR/OTP user to EndUser + check app access via admin-api. */
  async resolveAndCheckEndUserAccess(input: {
    ehrName?: string;
    fhirId?: string;
    /** Real email from id_token or Practitioner.telecom enrichment; omit when no email is available. */
    email?: string;
    applicationId: string;
    siteId?: string;
  }): Promise<{ endUserId?: string; allowed: boolean; reason?: string; action?: ResolveAction }> {
    const token = await this.getServiceToken();
    const response = await httpClient.request<{
      endUserId?: string;
      allowed: boolean;
      reason?: string;
      action?: ResolveAction;
    }>({
      url: `${this.adminApiUrl}/api/oauth/access-check`,
      method: 'post',
      data: input,
      contentType: 'application/json',
      authType: 'Bearer',
      authToken: token,
    });
    return response.data;
  }

  // ── Site management (bridge auto-provisioning path) ──────────────────

  /** Create a site via admin-api (internal service call) */
  async createSite(appId: string, ehrName: string, body: Record<string, any>): Promise<any> {
    let token: string;
    try {
      token = await this.getServiceToken();
    } catch (err: any) {
      this.token = null;
      this.tokenExpiresAt = 0;
      logger.error('Failed to sign internal service token', err);
      throw err;
    }

    const response = await httpClient.request<any>({
      url: `${this.adminApiUrl}/api/applications/${appId}/ehr/${ehrName}/sites`,
      method: 'post',
      data: body,
      contentType: 'application/json',
      authType: 'Bearer',
      authToken: token,
    });

    logger.info('Admin-API: site created via internal call', {
      service: this.serviceName,
      appId,
      ehrName,
      siteId: response.data?.id,
      siteName: body.name,
    });

    return response.data;
  }
}

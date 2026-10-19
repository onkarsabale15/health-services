import { v7 as uuidv7 } from 'uuid';
import { createHash, randomBytes } from 'crypto';
import { CompactEncrypt, importJWK } from 'jose';
import { cache } from '@hs/infra';
import { db } from '@hs/infra';
import { logger } from '@hs/observability';
import { httpClient } from '@hs/infra';
import { resolveEndpoints } from '@hs/config';
import { ForbiddenException } from '@nestjs/common';
import { adminClient } from '../../services/admin-client.service';

const SMART_STATE_TTL = 300; // 5 minutes for OAuth state
const LAUNCH_CODE_TTL = 120; // 2 minutes for one-time launch code (confidential)
const SESSION_TOKEN_TTL = 300; // 5 minutes for session token (public)
const SMART_DISCOVERY_TTL = 600; // 10 minutes for SMART configuration discovery cache
const SMART_SESSION_DEFAULT_TTL = 28800; // 8 hours default if no refresh token expiry
const BRIDGE_API_URL = process.env.BRIDGE_API_URL || 'http://localhost:3000/api';

// ─── PKCE helpers ────────────────────────────────────────────

function generateCodeVerifier(): string {
  return randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

// ─── Interfaces ──────────────────────────────────────────────

export interface SmartLaunchConfig {
  ehrName: string;
  appType: string;
  clientId: string;
  clientSecret?: any;
  scope: string;
  redirectUri: string;
  launchUrl: string;
  tenant?: string;
  accountId?: string;
  siteId?: string;
  authorizeUrl: string;
  tokenUrl: string;
  resolvedBaseUrl: string;
  // New fields
  applicationId?: string;
  integrationId?: string;
  clientType?: string;
  siteData?: Record<string, any>;
  /** App's public JWKS for asymmetric JWE encryption (if JWKS auth method) */
  jwks?: { keys: any[] };
  [key: string]: any;
}

interface SmartCachedState {
  config: SmartLaunchConfig;
  codeVerifier: string;
  launch?: string;
}

interface SmartCachedCode {
  integrationId: string;
  applicationId: string;
  ehrName: string;
  smartContext: SmartContext;
}

interface SmartContext {
  patient?: string;
  encounter?: string;
  fhirContext?: any[];
  idToken?: string;
  needPatientBanner?: boolean;
  smartStyleUrl?: string;
  intent?: string;
  scope?: string;
}

export interface SmartSession {
  sessionId: string;
  siteId: string;
  integrationId: string;
  applicationId: string;
  ehrName: string;
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  /** Unix ms timestamp when this token was issued by the EHR. Used to compute token age on subsequent requests. */
  createdAt: number;
  tokenUrl: string;
  patient?: string;
  encounter?: string;
  fhirContext?: any[];
  scope?: string;
  idToken?: string;
  needPatientBanner?: boolean;
  smartStyleUrl?: string;
  intent?: string;
  providerFhirId?: string;
  providerName?: string;
  providerNpi?: string;
  providerSpecialty?: string;
  providerQualification?: string;
  /** Canonical EndUser id resolved by admin-api (Phase C). `undefined` only on legacy
   * fallback path where EhrProviderAccess approved a launch without an EndUser match. */
  endUserId?: string;
  launchMode: 'ehr' | 'standalone';
  siteData: Record<string, any>;
}

// ─── Service ─────────────────────────────────────────────────

class SmartLaunchService {
  /**
   * Discover SMART configuration from ISS (FHIR base URL).
   * Returns authorize and token endpoints from .well-known/smart-configuration.
   * Results are cached for 10 minutes per ISS.
   */
  async discoverSmartConfig(iss: string): Promise<{ authorizeUrl: string; tokenUrl: string }> {
    // SSRF protection: validate ISS URL before making outbound request
    this.validateIssUrl(iss);

    const cacheKey = `smart:discovery:${iss}`;
    const cached = await cache.get<{ authorizeUrl: string; tokenUrl: string }>(cacheKey).catch(() => null);
    if (cached) {
      logger.debug('SMART discovery cache hit', { iss });
      return cached;
    }

    const wellKnownUrl = `${iss.replace(/\/$/, '')}/.well-known/smart-configuration`;
    logger.info('SMART discovery fetching', { iss, wellKnownUrl });

    const response = await httpClient.request<any>({
      url: wellKnownUrl,
      method: 'get',
      timeout: 5000,
    });

    const authorizeUrl = response.data?.authorization_endpoint;
    const tokenUrl = response.data?.token_endpoint;

    if (!authorizeUrl || !tokenUrl) {
      logger.warn('SMART discovery incomplete', {
        iss,
        authorizeUrl,
        tokenUrl,
        capabilities: response.data?.capabilities,
      });
      throw new Error(`SMART configuration at ${wellKnownUrl} missing authorization_endpoint or token_endpoint`);
    }

    const config = { authorizeUrl, tokenUrl };
    await cache.set(cacheKey, config, SMART_DISCOVERY_TTL).catch(() => {});
    logger.info('SMART discovery successful', { iss, authorizeUrl, tokenUrl });
    return config;
  }

  /**
   * Step 1: Build the EHR authorization URL.
   * Stores PKCE verifier + launch context in cache under the `state` key.
   */
  async buildAuthorizeRedirect(config: SmartLaunchConfig, launch?: string): Promise<string> {
    const state = uuidv7();
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);

    // Cache state
    await cache.set(
      `smart:state:${state}`,
      {
        config,
        codeVerifier,
        launch,
      } as SmartCachedState,
      SMART_STATE_TTL,
    );

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      scope: config.scope,
      state,
      aud: config.resolvedBaseUrl,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    if (launch) {
      params.set('launch', launch);
    }

    const authorizeUrl = `${config.authorizeUrl}?${params.toString()}`;
    logger.info('Built SMART authorize redirect', { ehrName: config.ehrName, state });
    return authorizeUrl;
  }

  /**
   * Step 2: Handle EHR callback — exchange code for token,
   * cache EHR token, generate launch code or session token,
   * redirect to third-party app's launch URL.
   */
  async handleCallback(code: string, state: string, applicationId: string): Promise<{ redirectUrl: string }> {
    // Consume state atomically
    const stateData = await cache.getdel<SmartCachedState>(`smart:state:${state}`);
    if (!stateData) {
      throw new Error('Invalid or expired state parameter');
    }

    const { config, codeVerifier } = stateData;

    // Exchange code at EHR token endpoint
    const tokenResponse = await this.exchangeCodeForToken(config, code, codeVerifier);

    // Extract provider identity from id_token (OIDC claims only — no extra FHIR call)
    const providerInfo = extractProviderFromIdToken(tokenResponse.id_token);
    if (!providerInfo) {
      logger.warn('No provider identity in SMART token response', {
        hasIdToken: !!tokenResponse.id_token,
        scope: tokenResponse.scope,
        hint: 'Ensure openid and fhirUser scopes are configured for this integration',
      });
    }

    logger.info('SMART EHR token exchanged', {
      applicationId,
      ehrName: config.ehrName,
      patient: tokenResponse.patient,
      encounter: tokenResponse.encounter,
      scope: tokenResponse.scope,
      hasIdToken: !!tokenResponse.id_token,
      providerFhirId: providerInfo?.fhirId,
      providerName: providerInfo?.name,
      // Token diagnostics
      tokenType: tokenResponse.token_type,
      expiresIn: tokenResponse.expires_in,
      tokenLength: tokenResponse.access_token?.length ?? 0,
      tokenPrefix: tokenResponse.access_token?.slice(0, 16),
      tokenSuffix: tokenResponse.access_token?.slice(-8),
      hasRefreshToken: !!tokenResponse.refresh_token,
      // Log all non-sensitive keys from token response for debugging launch context
      tokenResponseKeys: Object.keys(tokenResponse).filter(
        (k) => !['access_token', 'refresh_token', 'id_token'].includes(k),
      ),
    });

    // Enrich provider email from Practitioner.telecom when the EHR's id_token
    // didn't include it (common with Cerner). Email is the canonical EndUser
    // identity — without it, admin's invite-by-email won't match this launch.
    if (providerInfo?.fhirId && !providerInfo.email) {
      const enriched = await fetchPractitionerEmail({
        baseUrl: config.resolvedBaseUrl,
        accessToken: tokenResponse.access_token,
        fhirId: providerInfo.fhirId,
      });
      if (enriched) {
        providerInfo.email = enriched;
        logger.info('Practitioner email resolved via FHIR enrichment', {
          ehrName: config.ehrName,
          providerFhirId: providerInfo.fhirId,
        });
      }
    }

    // Resolve canonical EndUser + check EndUserAppAccess (Phase C IdP gate).
    // Sole authorization source — admin-api owns identity resolution + auto-provisioning.
    let endUserId: string | undefined;
    if (config.integrationId && providerInfo?.fhirId) {
      endUserId = await this.checkEndUserAccess({
        applicationId,
        integrationId: config.integrationId,
        ehrName: config.ehrName,
        siteId: config.siteId,
        providerInfo,
      });
    } else if (config.integrationId) {
      // No provider identity available — check if restriction is enabled and block if so
      const ehrAccess = await db.getClient().appEhrAccess.findUnique({
        where: { id: config.integrationId },
        select: { providerRestriction: true },
      });
      if (ehrAccess?.providerRestriction === 'restricted') {
        throw new ForbiddenException('Provider identity could not be determined. Ensure fhirUser scope is configured.');
      }
    }

    // Store SMART session in Redis (per-user, per-launch)
    const session = await this.storeSmartSession({
      siteId: config.siteId || '',
      integrationId: config.integrationId || '',
      applicationId,
      ehrName: config.ehrName,
      ehrResponse: tokenResponse,
      tokenUrl: config.tokenUrl,
      siteData: config.siteData || {},
      providerFhirId: providerInfo?.fhirId,
      providerName: providerInfo?.name,
      providerNpi: providerInfo?.npi,
      providerSpecialty: providerInfo?.specialty || providerInfo?.qualification,
      endUserId,
      launchMode: stateData.launch ? 'ehr' : 'standalone',
    });

    // Redirect to third-party app's launch URL
    const redirectUrl = new URL(config.launchUrl);

    if (config.jwks?.keys?.length) {
      // JWKS app: encrypt with app's public key (asymmetric JWE)
      const jwe = await this.generateLaunchJwe(session, { jwks: config.jwks });
      redirectUrl.searchParams.set('launch_token', jwe);
    } else if (typeof config.clientSecret === 'string' && config.clientSecret) {
      // Client secret app: encrypt with shared secret (symmetric JWE)
      const jwe = await this.generateLaunchJwe(session, { clientSecret: config.clientSecret });
      redirectUrl.searchParams.set('launch_token', jwe);
    } else {
      // Public app: no encryption possible — pass sessionId as opaque token
      // (sessionId is a UUIDv7, reveals nothing without Redis access)
      redirectUrl.searchParams.set('session_id', session.sessionId);
      redirectUrl.searchParams.set('iss', BRIDGE_API_URL);
    }

    logger.info('SMART launch session ready', {
      sessionId: session.sessionId,
      patient: session.patient,
      encounter: session.encounter,
      ehrName: config.ehrName,
      launchUrl: config.launchUrl,
    });

    return { redirectUrl: redirectUrl.toString() };
  }

  /**
   * @deprecated Use JWE launch token flow instead. Kept for backward compatibility
   * with apps still using the opaque code exchange pattern.
   *
   * Step 3a: Confidential app exchanges one-time launch code for token + context.
   */
  async exchangeLaunchCode(launchCode: string, authenticatedClientId: string): Promise<Record<string, any>> {
    const data = await cache.getdel<SmartCachedCode>(`smart:code:${launchCode}`);
    if (!data) {
      throw new Error('Invalid or expired launch code');
    }

    // Verify the authenticated client owns this launch code
    if (data.applicationId !== authenticatedClientId) {
      logger.warn('SMART launch code client mismatch', {
        expected: data.applicationId,
        actual: authenticatedClientId,
      });
      throw new Error('Launch code does not belong to this client');
    }

    return this.buildTokenResponse(data);
  }

  /**
   * @deprecated Use JWE launch token flow instead. Kept for backward compatibility.
   *
   * Step 3b: Public app exchanges session token for token + context.
   */
  async exchangeSessionToken(sessionToken: string, applicationId: string): Promise<Record<string, any>> {
    const data = await cache.getdel<SmartCachedCode>(`smart:session:${sessionToken}`);
    if (!data) {
      throw new Error('Invalid or expired session');
    }

    // Verify applicationId matches
    if (data.applicationId !== applicationId) {
      throw new Error('Session does not belong to this application');
    }

    return this.buildTokenResponse(data);
  }

  // ─── SMART Session Flow ────────────────────────────────────

  /**
   * Store a SMART session in Redis after EHR token exchange.
   * Returns the full SmartSession object with a generated sessionId.
   */
  async storeSmartSession(params: {
    siteId: string;
    integrationId: string;
    applicationId: string;
    ehrName: string;
    ehrResponse: any;
    tokenUrl: string;
    siteData: Record<string, any>;
    providerFhirId?: string;
    providerName?: string;
    providerNpi?: string;
    providerSpecialty?: string;
    endUserId?: string;
    launchMode?: 'ehr' | 'standalone';
  }): Promise<SmartSession> {
    const sessionId = uuidv7();
    const createdAt = Date.now();
    const { siteId, integrationId, applicationId, ehrName, ehrResponse, tokenUrl, siteData } = params;

    const session: SmartSession = {
      sessionId,
      siteId,
      integrationId,
      applicationId,
      ehrName,
      accessToken: ehrResponse.access_token,
      refreshToken: ehrResponse.refresh_token,
      expiresIn: ehrResponse.expires_in || 3600,
      createdAt,
      tokenUrl,
      patient: ehrResponse.patient,
      encounter: ehrResponse.encounter,
      fhirContext: ehrResponse.fhirContext,
      scope: ehrResponse.scope,
      idToken: ehrResponse.id_token,
      needPatientBanner: ehrResponse.need_patient_banner,
      smartStyleUrl: ehrResponse.smart_style_url,
      intent: ehrResponse.intent,
      providerFhirId: params.providerFhirId,
      providerName: params.providerName,
      providerNpi: params.providerNpi,
      providerSpecialty: params.providerSpecialty,
      endUserId: params.endUserId,
      launchMode: params.launchMode || (ehrResponse.patient ? 'ehr' : 'standalone'),
      siteData,
    };

    // If refresh token exists, use 8-hour default (can refresh indefinitely).
    // Otherwise, use access token lifetime minus 30s buffer (minimum 300s).
    const ttl = ehrResponse.refresh_token ? SMART_SESSION_DEFAULT_TTL : Math.max(session.expiresIn - 30, 300);

    await cache.set(`smart:launch:${sessionId}`, session, ttl);

    logger.info('SMART session stored', {
      sessionId,
      applicationId,
      ehrName,
      patient: session.patient,
      encounter: session.encounter,
      ttl,
      // Token diagnostics
      tokenLength: session.accessToken?.length ?? 0,
      tokenPrefix: session.accessToken?.slice(0, 16),
      tokenSuffix: session.accessToken?.slice(-8),
      expiresIn: session.expiresIn,
      hasRefreshToken: !!session.refreshToken,
      absoluteExpiryAt: new Date(createdAt + session.expiresIn * 1000).toISOString(),
      createdAt: new Date(createdAt).toISOString(),
    });

    return session;
  }

  /**
   * Generate JWE containing SMART context + sessionId.
   *
   * Two modes based on the app's auth method (one or the other, never both):
   * - **Client Secret**: Symmetric encryption (dir + A256GCM) using SHA-256(clientSecret) as key.
   *   App decrypts using same clientSecret.
   * - **JWKS**: Asymmetric encryption (RSA-OAEP + A256GCM) using the app's public key.
   *   App decrypts using its private key.
   */
  async generateLaunchJwe(
    session: SmartSession,
    options: { clientSecret?: string; jwks?: { keys: any[] } },
  ): Promise<string> {
    // Provider identity (`providerFhirId`, `providerName`) is included in
    // the JWE because cds-app reads it during launch to bootstrap the
    // provider session BEFORE the lazy `/clinical-data/practitioner`
    // call runs (which itself depends on `providerFhirId` to do the
    // FHIR Practitioner read). The JWE is RFC 7516 encrypted with the
    // platform's RSA-OAEP-256 key and travels over TLS — HIPAA
    // §164.312(e)(1) is satisfied by transport + payload encryption.
    const payload = new TextEncoder().encode(
      JSON.stringify({
        sessionId: session.sessionId,
        applicationId: session.applicationId,
        ehrName: session.ehrName,
        siteId: session.siteId,
        patient: session.patient,
        encounter: session.encounter,
        scope: session.scope,
        fhirContext: session.fhirContext,
        iss: BRIDGE_API_URL,
        needPatientBanner: session.needPatientBanner,
        intent: session.intent,
        providerFhirId: session.providerFhirId,
        providerName: session.providerName,
        endUserId: session.endUserId,
        launchMode: session.launchMode,
      }),
    );

    let jwe: string;

    // Strongest-first preference per RFC 7516
    const JWE_ALG_PREFERENCE = ['RSA-OAEP-256', 'RSA-OAEP', 'ECDH-ES+A256KW', 'ECDH-ES'];

    if (options.jwks?.keys?.length) {
      // Filter to encryption keys (use=enc), then pick strongest algorithm
      const encKeys = options.jwks.keys.filter((k: any) => k.use === 'enc');
      const candidates = encKeys.length > 0 ? encKeys : options.jwks.keys;

      let encKey: any = null;
      for (const preferredAlg of JWE_ALG_PREFERENCE) {
        encKey = candidates.find((k: any) => k.alg === preferredAlg);
        if (encKey) break;
      }

      if (!encKey) {
        throw new Error(
          `No suitable encryption key found in JWKS. Need a key with use="enc" and alg in [${JWE_ALG_PREFERENCE.join(', ')}]`,
        );
      }

      const alg = encKey.alg;
      const key = await importJWK(encKey, alg);
      jwe = await new CompactEncrypt(payload).setProtectedHeader({ alg, enc: 'A256GCM', kid: encKey.kid }).encrypt(key);
      logger.info('SMART launch JWE generated (JWKS/asymmetric)', {
        sessionId: session.sessionId,
        kid: encKey.kid,
        alg,
      });
    } else if (options.clientSecret) {
      // Symmetric: encrypt with SHA-256(clientSecret)
      const keyBytes = createHash('sha256').update(options.clientSecret).digest();
      jwe = await new CompactEncrypt(payload).setProtectedHeader({ alg: 'dir', enc: 'A256GCM' }).encrypt(keyBytes);
      logger.info('SMART launch JWE generated (client_secret/symmetric)', { sessionId: session.sessionId });
    } else {
      throw new Error('Cannot generate JWE: no clientSecret or JWKS configured for this application');
    }

    return jwe;
  }

  /**
   * Retrieve a SMART session from Redis by sessionId.
   * Returns null if the session has expired or does not exist.
   */
  async getSmartSession(sessionId: string): Promise<SmartSession | null> {
    const session = await cache.get<SmartSession>(`smart:launch:${sessionId}`).catch(() => null);
    if (!session) {
      logger.debug('SMART session not found', { sessionId });
      return null;
    }
    return session;
  }

  /**
   * Refresh the EHR access token for an existing SMART session.
   * Requires the session to have a refresh token.
   */
  async refreshSessionToken(session: SmartSession): Promise<SmartSession> {
    if (!session.refreshToken) {
      throw new Error('Session has no refresh token — cannot refresh');
    }

    const data = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: session.refreshToken,
    });

    const response = await httpClient.request<any>({
      url: session.tokenUrl,
      method: 'post',
      data,
      contentType: 'application/x-www-form-urlencoded',
    });

    if (!response.data?.access_token) {
      logger.error('SMART session token refresh failed', new Error('No access_token'), {
        sessionId: session.sessionId,
        ehrName: session.ehrName,
      });
      throw new Error('Token refresh failed — no access_token in response');
    }

    // Update session with new token data
    session.accessToken = response.data.access_token;
    session.expiresIn = response.data.expires_in || 3600;
    if (response.data.refresh_token) {
      session.refreshToken = response.data.refresh_token;
    }

    // Re-store: use 8-hour TTL if refresh token still available, otherwise access token TTL
    const ttl = session.refreshToken ? SMART_SESSION_DEFAULT_TTL : Math.max(session.expiresIn - 30, 300);
    await cache.set(`smart:launch:${session.sessionId}`, session, ttl);

    logger.info('SMART session token refreshed', {
      sessionId: session.sessionId,
      ehrName: session.ehrName,
      expiresIn: session.expiresIn,
    });

    return session;
  }

  // ─── Private ───────────────────────────────────────────────

  /**
   * Validate ISS URL to prevent SSRF attacks.
   * - Must be HTTPS in production
   * - Must not point to private/internal IP ranges
   */
  private validateIssUrl(iss: string): void {
    let parsed: URL;
    try {
      parsed = new URL(iss);
    } catch {
      throw new Error('Invalid ISS URL format');
    }

    // Enforce HTTPS in production
    if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:') {
      throw new Error('ISS URL must use HTTPS');
    }

    // Block private/internal IPs (SSRF protection)
    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname === '0.0.0.0' ||
      hostname.endsWith('.local') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
      hostname.startsWith('169.254.')
    ) {
      throw new Error('ISS URL must not point to private/internal addresses');
    }
  }

  /**
   * Build the RFC-compliant token response with SMART context.
   */
  private buildTokenResponse(data: SmartCachedCode): Record<string, any> {
    return {
      token_type: 'Bearer',
      scope: data.smartContext.scope || '',
      integration_id: data.integrationId,
      ehr_name: data.ehrName,
      // SMART context
      patient: data.smartContext.patient,
      encounter: data.smartContext.encounter,
      fhir_context: data.smartContext.fhirContext,
      id_token: data.smartContext.idToken,
      need_patient_banner: data.smartContext.needPatientBanner,
      smart_style_url: data.smartContext.smartStyleUrl,
      intent: data.smartContext.intent,
      // Bridge API URL for FHIR calls
      iss: BRIDGE_API_URL,
    };
  }

  /**
   * Exchange authorization code for access token at EHR's token endpoint.
   */
  private async exchangeCodeForToken(
    config: SmartLaunchConfig,
    code: string,
    codeVerifier: string,
  ): Promise<Record<string, any>> {
    const data = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.redirectUri,
      code_verifier: codeVerifier,
    });

    const requestOptions: any = {
      url: config.tokenUrl,
      method: 'post',
      data,
      contentType: 'application/x-www-form-urlencoded',
    };

    // Confidential apps: use Basic auth header (required by most EHRs including Cerner)
    if (config.clientSecret && typeof config.clientSecret === 'string') {
      const basicAuth = Buffer.from(
        `${encodeURIComponent(config.clientId)}:${encodeURIComponent(config.clientSecret)}`,
      ).toString('base64');
      requestOptions.authType = 'Basic';
      requestOptions.authToken = basicAuth;
    } else {
      // Public apps: send client_id in body
      data.append('client_id', config.clientId);
    }

    logger.debug('SMART token exchange request', {
      tokenUrl: config.tokenUrl,
      clientId: config.clientId ? `${config.clientId.substring(0, 8)}...` : 'MISSING',
      hasClientSecret: !!(config.clientSecret && typeof config.clientSecret === 'string'),
      authMethod: config.clientSecret ? 'Basic' : 'Public',
      redirectUri: config.redirectUri,
    });

    const response = await httpClient.request<any>(requestOptions);

    if (!response.data?.access_token) {
      logger.error('SMART token exchange failed', new Error('No access_token'), { ehrName: config.ehrName });
      throw new Error('Token exchange failed — no access_token in response');
    }

    return response.data;
  }

  /**
   * Phase C IdP gate. `EndUserAppAccess` is the sole authorization source for
   * SMART launches. Identity resolution + auto-provisioning live in admin-api;
   * a denial here is final.
   *
   * If admin-api is unreachable we fail closed — better to block a launch than
   * grant access without an authoritative answer.
   */
  private async checkEndUserAccess(input: {
    applicationId: string;
    integrationId: string;
    ehrName: string;
    siteId?: string;
    providerInfo: ProviderInfo;
  }): Promise<string> {
    const { applicationId, ehrName, siteId, providerInfo } = input;

    let result: { endUserId?: string; allowed: boolean; reason?: string; action?: string };
    try {
      result = await adminClient.resolveAndCheckEndUserAccess({
        ehrName,
        fhirId: providerInfo.fhirId,
        email: providerInfo.email,
        applicationId,
        siteId,
      });
    } catch (err: any) {
      logger.error('EndUser access check failed — admin-api unreachable', err, { applicationId });
      throw new ForbiddenException('Authorization service is unavailable. Please try again.');
    }

    if (!result.allowed || !result.endUserId) {
      logger.warn('SMART launch denied', { applicationId, reason: result.reason });
      throw new ForbiddenException(
        result.reason === 'access_pending'
          ? 'Your account is not authorized for this application. An administrator has been notified.'
          : 'Your account is not authorized for this application.',
      );
    }

    logger.info('SMART launch allowed via EndUserAppAccess', {
      applicationId,
      endUserId: result.endUserId,
      action: result.action,
    });
    return result.endUserId;
  }
}

// ── Provider Identity Extraction ────────────────────────────

interface ProviderInfo {
  fhirId: string; // e.g., "Practitioner/12345"
  name?: string;
  email?: string;
  npi?: string;
  specialty?: string;
  qualification?: string;
  role?: string;
}

/**
 * Extract provider identity from the OIDC id_token JWT.
 * Decodes without verification (we only need the claims, not the signature —
 * the token was already verified by the EHR during the OAuth exchange).
 */
function extractProviderFromIdToken(idToken?: string): ProviderInfo | null {
  if (!idToken) return null;

  try {
    const [, payloadB64] = idToken.split('.');
    const claims = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());

    // fhirUser is the standard SMART claim: "Practitioner/12345" or full URL
    let fhirId = claims.fhirUser || claims.sub || '';
    // Strip full URL to just ResourceType/ID
    if (fhirId.includes('/')) {
      const parts = fhirId.split('/');
      fhirId = `${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
    }

    if (!fhirId) return null;

    // Build display name from available claims
    const name =
      claims.name ||
      (claims.given_name || claims.family_name
        ? `${claims.given_name || ''} ${claims.family_name || ''}`.trim()
        : undefined) ||
      claims.preferred_username;

    logger.info('Provider identity extracted from id_token', {
      fhirId,
      name: name || 'unknown',
      hasEmail: !!claims.email,
      hasFhirUser: !!claims.fhirUser,
    });

    return { fhirId, name, email: claims.email, npi: claims.npi || claims.practitioner_npi };
  } catch (err: any) {
    logger.warn('Failed to extract provider from id_token', { error: err.message });
    return null;
  }
}

// ── Practitioner Email Enrichment ───────────────────────────
//
// EHRs vary on whether they include `email` in the SMART id_token (Cerner
// typically does not). When missing, we read the Practitioner FHIR resource
// directly with the EHR access token we just minted and pull the first email
// from `telecom`. Best-effort: failure here is logged and the resolver gets
// `undefined` email — admins are notified per the closed-policy reject path.

interface PractitionerTelecom {
  system?: string;
  value?: string;
  use?: string;
}

interface PractitionerResource {
  resourceType?: string;
  telecom?: PractitionerTelecom[];
}

async function fetchPractitionerEmail(input: {
  baseUrl: string;
  accessToken: string;
  fhirId: string;
}): Promise<string | undefined> {
  const { baseUrl, accessToken, fhirId } = input;
  // fhirId arrives as "Practitioner/abc" or just "abc" — normalize to the
  // path segment the FHIR server expects.
  const path = fhirId.includes('/') ? fhirId : `Practitioner/${fhirId}`;
  const url = `${baseUrl.replace(/\/$/, '')}/${path}`;
  try {
    const response = await httpClient.request<PractitionerResource>({
      url,
      method: 'get',
      authType: 'Bearer',
      authToken: accessToken,
      headers: { Accept: 'application/fhir+json' },
      timeout: 5000,
    });
    const telecom = response.data?.telecom ?? [];
    const email = telecom.find((t) => t.system === 'email' && t.value)?.value;
    return email?.trim() || undefined;
  } catch (err: any) {
    logger.warn('Practitioner email enrichment failed', { fhirId, error: err?.message });
    return undefined;
  }
}

export const smartLaunchService = new SmartLaunchService();

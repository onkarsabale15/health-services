import { v7 as uuidv7 } from 'uuid';
import { SignJWT, importJWK } from 'jose';
import { EhrResponse, TokenResult, JwkSet } from '../interfaces/ehr-service.interface';
import type { ConnectionData } from '../interfaces/connection-data.interface';
import type { EhrClientConfig } from '../interfaces/ehr-client-config.interface';
import type { ICache } from '@hs/infra';
import { httpClient } from '@hs/infra';
import { resolveBaseUrl, resolveAuthUrl, resolveExtraUrl } from '@hs/config';
import { EhrError } from '../errors/ehr.error';

export abstract class BaseEhrService {
  abstract readonly ehrName: string;

  /** Injected cache instance (DIP — set by consumer at startup via setCache) */
  private _cache: ICache | null = null;

  private static readonly MAX_AUTH_RETRIES = 3;
  private static readonly TOKEN_LOCK_TTL = 20;
  private static readonly TOKEN_WAIT_TIMEOUT = 10_000;
  private static readonly TOKEN_WAIT_POLL_INTERVAL = 300;
  private static readonly TOKEN_TTL_BUFFER = 30;

  /** Inject cache dependency. Called once at app startup. */
  setCache(cache: ICache): void {
    this._cache = cache;
  }

  private ensureCache(): ICache {
    if (!this._cache) throw new Error(`Cache not initialized for ${this.ehrName} — call setCache() at startup`);
    return this._cache;
  }

  // ---------------------------------------------------------------------------
  // URL Resolution — reads from cached connectionData (populated at connection creation).
  // Falls back to @hs/config resolution only during getToken() (pre-cache).
  // ---------------------------------------------------------------------------

  /** Get the FHIR base URL from cached connectionData. */
  protected getResolvedBaseUrl(connectionData: ConnectionData): string {
    if (connectionData.resolvedBaseUrl) return connectionData.resolvedBaseUrl;
    // Fallback: resolve at call-time (used during getToken before cache exists).
    // Resolvers read the deployment env (cert/prod) internally.
    return resolveBaseUrl(this.ehrName, connectionData.appType || 'system', connectionData);
  }

  /** Get the auth/token URL from cached connectionData. */
  protected getResolvedAuthUrl(connectionData: ConnectionData): string {
    if (connectionData.resolvedAuthUrl) return connectionData.resolvedAuthUrl;
    return resolveAuthUrl(this.ehrName, connectionData.appType || 'system', connectionData);
  }

  /** Get a named extra URL (e.g. 'tokenUrl', 'fhirBaseUrl') from cached connectionData. */
  protected getResolvedExtraUrl(connectionData: ConnectionData, urlKey: string): string | null {
    if (connectionData.resolvedExtraUrls?.[urlKey]) return connectionData.resolvedExtraUrls[urlKey];
    return resolveExtraUrl(this.ehrName, connectionData.appType || 'system', urlKey, connectionData);
  }

  // ---------------------------------------------------------------------------
  // Auth helpers (shared across vendors)
  // ---------------------------------------------------------------------------

  protected async getJwkSignedToken(params: {
    jwks: JwkSet;
    audience: string;
    alg: string;
    issuer: string;
    subject: string;
  }): Promise<string> {
    const { jwks, audience, alg, issuer, subject } = params;
    const privateKey = jwks.keys?.find((k) => k.alg === alg) || jwks.keys[0];
    const key = await importJWK(privateKey as any, alg);
    return new SignJWT({})
      .setProtectedHeader({ alg, kid: privateKey.kid, typ: 'JWT' })
      .setIssuer(issuer)
      .setSubject(subject)
      .setAudience(audience)
      .setJti(uuidv7())
      .setExpirationTime('1m')
      .setIssuedAt(Math.floor(Date.now() / 1000) - 60)
      .sign(key);
  }

  protected handleAuthError(error: unknown): EhrError {
    if (error instanceof EhrError) {
      return error;
    }
    const err = error as Record<string, unknown>;
    const response = err.response as Record<string, unknown> | undefined;

    // The shared @hs/infra httpClient normalizes axios errors to a FLAT shape
    // ({ status, data, headers }); raw axios uses `.response.{status,data}`.
    // Read both so the EHR's real status + token-error body survive (e.g. a
    // Cerner client_credentials failure: { error, error_description }).
    const body = err.data ?? response?.data;
    let errorDetail: unknown;
    if (body !== undefined) {
      errorDetail = body;
    } else if (err.message) {
      try {
        errorDetail = JSON.parse(err.message as string);
      } catch {
        errorDetail = err.message;
      }
    } else if (err.body) {
      try {
        errorDetail = JSON.parse(err.body as string);
      } catch {
        errorDetail = err.body;
      }
    } else {
      errorDetail = err;
    }

    const detail = errorDetail as Record<string, unknown> | undefined;
    const statusCode =
      (err?.statusCode as number) ||
      (err?.status as number) ||
      (response?.status as number) ||
      (detail?.code as number) ||
      (err?.code as number) ||
      500;

    const message =
      typeof errorDetail === 'string'
        ? errorDetail
        : (detail?.error_description as string) || (detail?.message as string) || 'EHR authentication failed';

    return new EhrError(statusCode as number, message as string, this.ehrName, errorDetail);
  }

  // ---------------------------------------------------------------------------
  // Default getToken - vendors must override
  // ---------------------------------------------------------------------------

  async getToken(_payload: unknown, _secrets?: unknown): Promise<TokenResult> {
    throw new EhrError(501, 'getToken not implemented', this.ehrName);
  }

  /** Override in vendor if the EHR supports refresh_token grant */
  async refreshToken(_connectionData: ConnectionData): Promise<TokenResult> {
    throw new EhrError(501, 'Refresh token not supported', this.ehrName);
  }

  // ---------------------------------------------------------------------------
  // Token-Managed Request Layer
  //
  // Flow: cache check → distributed lock → getToken → make API call → retry on 401
  // - 401: clear token → attempt refresh_token → else full getToken → retry (max 3)
  // - 403: clear token → throw immediately (no retry)
  // ---------------------------------------------------------------------------

  private tokenCacheKey(config: EhrClientConfig): string {
    // Keyed on siteId only — EhrSiteConfig.id is globally unique. Integration
    // (AppEhrAccess) is derivable via DB FK; not needed in the cache key.
    return `ehr:token:${config.siteId}`;
  }

  private tokenLockKey(config: EhrClientConfig): string {
    return `ehr:token:lock:${config.siteId}`;
  }

  /**
   * Build a ConnectionData object from EhrClientConfig + optional token.
   *
   * `EhrConfig` is now a discriminated union — fields like `clientSecret`,
   * `tenant`, `accountId`, `siteId`, `scope`, `grantType` exist only on
   * certain variants. We read them via a generic accessor that mirrors the
   * prior `as string` casts: the function returns the field if present,
   * `undefined` otherwise. Each ConnectionData field is already typed as
   * optional, so the narrowed union flows cleanly.
   *
   * The `resolveBaseUrl` / `resolveAuthUrl` calls accept `Record<string, any>`
   * for legacy reasons; the EhrConfig union is structurally compatible.
   */
  buildConnectionData(config: EhrClientConfig, token: TokenResult | null): ConnectionData {
    const ec = config.ehrConfig;
    const pick = <K extends string>(key: K): string | undefined =>
      (ec as unknown as Record<string, unknown>)[key] as string | undefined;

    return {
      connectionId: config.siteId,
      ehrName: config.ehrName,
      accessToken: token?.accessToken || '',
      expiresIn: token?.expiresIn || 0,
      refreshToken: token?.refreshToken,
      appType: config.appType,
      clientId: pick('clientId'),
      clientSecret: pick('clientSecret'),
      tenant: pick('tenant'),
      accountId: pick('accountId'),
      siteId: pick('siteId'),
      scope: config.ehrTokenScopes?.join(' ') || pick('scope'),
      grantType: pick('grantType'),
      // Pre-resolved URLs (set by caller, e.g. smart-launch ISS pinning) win.
      // Fall back to catalog resolution only if not provided.
      resolvedBaseUrl: ec.resolvedBaseUrl || resolveBaseUrl(config.ehrName, config.appType, ec as Record<string, any>),
      resolvedAuthUrl: ec.resolvedAuthUrl || resolveAuthUrl(config.ehrName, config.appType, ec as Record<string, any>),
    };
  }

  /** Get token from cache or generate a new one (with distributed lock for idempotency) */
  async getOrCreateToken(config: EhrClientConfig): Promise<TokenResult> {
    const cache = this.ensureCache();
    const cacheKey = this.tokenCacheKey(config);

    // 1. Check cache
    const cached = await cache.get<TokenResult>(cacheKey).catch(() => null);
    if (cached) return cached;

    // 2. Distributed lock — prevents thundering herd
    const lockKey = this.tokenLockKey(config);
    const acquired = await cache.setNx(lockKey, '1', BaseEhrService.TOKEN_LOCK_TTL);

    if (!acquired) {
      return this.waitForToken(config);
    }

    try {
      // 3. Double-check after acquiring lock
      const rechecked = await cache.get<TokenResult>(cacheKey).catch(() => null);
      if (rechecked) return rechecked;

      // 4. Generate token (vendor-specific)
      const connectionData = this.buildConnectionData(config, null);
      const token = await this.getToken(connectionData, config.jwks ? { jwks: config.jwks } : undefined);

      // 5. Cache with TTL buffer
      const ttl = Math.max((token.expiresIn || 3600) - BaseEhrService.TOKEN_TTL_BUFFER, 60);
      await cache.set(cacheKey, token, ttl).catch(() => {});

      return token;
    } finally {
      await cache.del(lockKey).catch(() => {});
    }
  }

  /** Wait for another instance to finish generating the token */
  private async waitForToken(config: EhrClientConfig): Promise<TokenResult> {
    const cache = this.ensureCache();
    const cacheKey = this.tokenCacheKey(config);
    const start = Date.now();

    while (Date.now() - start < BaseEhrService.TOKEN_WAIT_TIMEOUT) {
      const cached = await cache.get<TokenResult>(cacheKey).catch(() => null);
      if (cached) return cached;
      await new Promise((r) => setTimeout(r, BaseEhrService.TOKEN_WAIT_POLL_INTERVAL));
    }

    throw new EhrError(504, 'Token generation timeout — another instance may have failed', this.ehrName);
  }

  /** Clear cached token for an integration site */
  private async clearToken(config: EhrClientConfig): Promise<void> {
    await this.ensureCache()
      .del(this.tokenCacheKey(config))
      .catch(() => {});
  }

  /**
   * Make an authenticated FHIR request with automatic token management.
   *
   * System apps (client_credentials):
   * - Gets/generates token from cache (distributed lock for idempotency)
   * - On 401: clears cached token → tries refresh_token → else full getToken → retries (max 3)
   * - On 403: clears token cache → throws immediately (no retry)
   *
   * SMART session apps (config.ehrConfig._sessionToken):
   * - Uses the session-specific access token directly (no cache lookup)
   * - On 401: tries refresh via _sessionRefreshToken → updates config → retries
   * - If no refresh token or refresh fails → throws 401 immediately
   */
  protected async makeAuthenticatedRequest<T = any>(
    config: EhrClientConfig,
    requestConfig: {
      url: string;
      method: 'get' | 'post' | 'put' | 'patch' | 'delete';
      params?: Record<string, any>;
      data?: unknown;
      headers?: Record<string, string>;
    },
  ): Promise<EhrResponse<T>> {
    const cache = this.ensureCache();
    const isSessionToken = Boolean(config.ehrConfig._sessionToken);
    // Local copy for session tokens to avoid mutating the shared config object during retries
    let sessionAccessToken = config.ehrConfig._sessionToken as string;
    let sessionRefreshToken = config.ehrConfig._sessionRefreshToken as string;
    let attempt = 0;

    while (attempt < BaseEhrService.MAX_AUTH_RETRIES) {
      attempt++;

      // Check if a session-specific token is provided (SMART launch)
      let token: TokenResult;
      if (isSessionToken) {
        token = {
          accessToken: sessionAccessToken,
          expiresIn: 0,
          refreshToken: sessionRefreshToken,
        };
      } else {
        // System app — get shared token via client_credentials
        token = await this.getOrCreateToken(config);
      }

      try {
        return await this.makeRequest<T>({
          ...requestConfig,
          authToken: token.accessToken,
        });
      } catch (error: unknown) {
        const err = error as Record<string, unknown>;
        const status = (err?.statusCode as number) || (err?.status as number);

        if (status === 401) {
          if (isSessionToken) {
            // SMART session token — try refreshing via EHR token endpoint
            if (token.refreshToken && attempt < BaseEhrService.MAX_AUTH_RETRIES) {
              try {
                const connectionData = this.buildConnectionData(config, token);
                const refreshed = await this.refreshToken(connectionData);
                // Update local session token so next attempt uses the refreshed token
                sessionAccessToken = refreshed.accessToken;
                if (refreshed.refreshToken) {
                  sessionRefreshToken = refreshed.refreshToken;
                }
                continue;
              } catch (refreshError: unknown) {
                // No refresh token or refresh failed — cannot recover, throw the 401
                throw error;
              }
            }
            // No refresh token available — throw immediately
            throw error;
          }

          // System token 401 handling
          await this.clearToken(config);

          // Attempt refresh_token if the vendor supports it
          if (token.refreshToken && attempt < BaseEhrService.MAX_AUTH_RETRIES) {
            try {
              const connectionData = this.buildConnectionData(config, token);
              const refreshed = await this.refreshToken(connectionData);
              const ttl = Math.max((refreshed.expiresIn || 3600) - BaseEhrService.TOKEN_TTL_BUFFER, 60);
              await cache.set(this.tokenCacheKey(config), refreshed, ttl).catch(() => {});
              continue;
            } catch {
              // Refresh failed — will do full getToken on next loop iteration
              continue;
            }
          }

          if (attempt >= BaseEhrService.MAX_AUTH_RETRIES) throw error;
          continue;
        }

        if (status === 403) {
          if (!isSessionToken) {
            await this.clearToken(config);
          }
          throw error;
        }

        throw error;
      }
    }

    throw new EhrError(401, `EHR authentication failed after ${BaseEhrService.MAX_AUTH_RETRIES} retries`, this.ehrName);
  }

  // ---------------------------------------------------------------------------
  // HTTP helpers
  // ---------------------------------------------------------------------------

  protected async makeRequest<T = any>(config: {
    url: string;
    method: 'get' | 'post' | 'put' | 'patch' | 'delete';
    authToken: string;
    params?: Record<string, any>;
    data?: unknown;
    headers?: Record<string, string>;
  }): Promise<EhrResponse<T>> {
    try {
      const response = await httpClient.request({
        url: config.url,
        method: config.method,
        authType: 'Bearer',
        authToken: config.authToken,
        params: config.params as Record<string, any>,
        data: config.data,
        headers: {
          'Content-Type': 'application/fhir+json',
          Accept: 'application/fhir+json, application/json',
          ...config.headers,
        },
      });
      return createFhirResponse<T>(response.status, response.data as T);
    } catch (error: unknown) {
      const err = error as Record<string, unknown>;
      const status = (err.status as number) || 500;

      throw new EhrError(
        status,
        (err.message as string) || 'EHR request failed',
        this.ehrName,
        err.data as Record<string, unknown>,
      );
    }
  }

  protected extractToken(connectionData: ConnectionData): string {
    return connectionData.accessToken;
  }
}

export function createFhirResponse<T = any>(
  statusCode: number,
  data: T,
  headers?: Record<string, string>,
): EhrResponse<T> {
  return { statusCode, data, headers };
}

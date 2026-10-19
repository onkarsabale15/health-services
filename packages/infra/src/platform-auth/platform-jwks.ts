import { JWK, createLocalJWKSet, jwtVerify } from 'jose';
import { secrets } from '../secrets';
import { cache } from '../cache';

const PLATFORM_JWKS_SECRET = 'HS_PLATFORM_JWKS';
const JWKS_CACHE_KEY = 'platform:jwks:public';
const JWKS_CACHE_TTL = 3600;
const PRIVATE_KEY_FIELDS = ['d', 'p', 'q', 'dp', 'dq', 'qi'];

/** Claims carried by a platform-issued API token (`token_type: 'api'`). */
export interface PlatformApiClaims {
  /** Application id (token subject). */
  sub: string;
  org_id?: string;
  client_id?: string;
  scope?: string;
  /** EHR vendor names the app was granted access to (e.g. `['cerner']`). */
  ehr_access?: string[];
  app_type?: string;
  token_type?: string;
  exp?: number;
  [claim: string]: unknown;
}

function stripPrivateFields(jwk: JWK): JWK {
  const pub = { ...jwk };
  for (const field of PRIVATE_KEY_FIELDS) delete (pub as Record<string, unknown>)[field];
  return pub;
}

/**
 * Verifies platform-issued JWTs (the API tokens minted by admin-api's OAuth
 * token endpoint) against the platform JWKS. Shared by every service that
 * needs to authenticate platform API tokens — bridge-api and mcp-app — so the
 * verification + key handling lives in ONE place.
 *
 * Public keys are loaded from the `HS_PLATFORM_JWKS` secret, cached in Redis
 * (`platform:jwks:public`, 1h) and in-memory, with private fields stripped.
 */
class PlatformJwks {
  private cachedKeySet: ReturnType<typeof createLocalJWKSet> | null = null;
  private inMemoryPublicKeys: { keys: JWK[] } | null = null;

  /** Public JWKS — for `/.well-known/jwks.json` or verification. */
  async getPublicJwks(): Promise<{ keys: JWK[] }> {
    if (this.inMemoryPublicKeys) return this.inMemoryPublicKeys;

    try {
      const cached = await cache.get<{ keys: JWK[] }>(JWKS_CACHE_KEY);
      if (cached) {
        this.inMemoryPublicKeys = cached;
        return cached;
      }
    } catch {
      /* fall through to secrets */
    }

    const jwks = await secrets.getSecretValue<{ keys: JWK[] }>(PLATFORM_JWKS_SECRET);
    if (!jwks?.keys?.length) {
      throw new Error(`Platform JWKS not found in ${PLATFORM_JWKS_SECRET}`);
    }
    const publicKeys = { keys: jwks.keys.map(stripPrivateFields) };
    await cache.set(JWKS_CACHE_KEY, publicKeys, JWKS_CACHE_TTL).catch(() => {});
    this.inMemoryPublicKeys = publicKeys;
    return publicKeys;
  }

  /** jose key set for JWT verification (kid match + key rotation handled). */
  async getKeySet(): Promise<ReturnType<typeof createLocalJWKSet>> {
    if (this.cachedKeySet) return this.cachedKeySet;
    this.cachedKeySet = createLocalJWKSet(await this.getPublicJwks());
    return this.cachedKeySet;
  }

  /**
   * Verify a platform API token. Throws on invalid signature, wrong
   * issuer/audience, expiry, or a non-`api` token_type. Returns the claims.
   */
  async verifyApiToken(token: string, opts: { issuer: string }): Promise<PlatformApiClaims> {
    const keySet = await this.getKeySet();
    const { payload } = await jwtVerify(token, keySet, {
      issuer: opts.issuer,
      audience: `${opts.issuer}/api`,
    });
    if (payload.token_type !== 'api') {
      throw new Error('Invalid token type for API access');
    }
    return payload as PlatformApiClaims;
  }
}

/** Shared singleton — used by bridge-api + mcp-app to verify platform API tokens. */
export const platformJwks = new PlatformJwks();

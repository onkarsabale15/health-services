import { Injectable } from '@nestjs/common';
import { JWK, createLocalJWKSet } from 'jose';
import { secrets } from '@hs/infra';
import { cache } from '@hs/infra';
import { CacheKeys } from '../../../cache/cache-keys';
import { CacheTTL } from '../../../cache/cache-ttl';

const PRIVATE_KEY_FIELDS = ['d', 'p', 'q', 'dp', 'dq', 'qi'];

function stripPrivateFields(jwk: JWK): JWK {
  const pub = { ...jwk };
  for (const field of PRIVATE_KEY_FIELDS) {
    delete (pub as any)[field];
  }
  return pub;
}

@Injectable()
export class PlatformJwksService {
  private cachedKeySet: ReturnType<typeof createLocalJWKSet> | null = null;
  private inMemoryPublicKeys: { keys: JWK[] } | null = null;

  /**
   * Get a jose JWKS key set for JWT verification.
   * Handles kid matching, alg validation, and key rotation automatically.
   */
  async getKeySet(): Promise<ReturnType<typeof createLocalJWKSet>> {
    if (this.cachedKeySet) return this.cachedKeySet;

    const publicJwks = await this.getPublicJwks();
    this.cachedKeySet = createLocalJWKSet(publicJwks);
    return this.cachedKeySet;
  }

  /** Get public JWKS (for /.well-known/jwks.json or verification) */
  async getPublicJwks(): Promise<{ keys: JWK[] }> {
    if (this.inMemoryPublicKeys) return this.inMemoryPublicKeys;

    const redisCacheKey = CacheKeys.platformJwks();
    try {
      const cached = await cache.get<{ keys: JWK[] }>(redisCacheKey);
      if (cached) {
        this.inMemoryPublicKeys = cached;
        return cached;
      }
    } catch {
      /* fall through */
    }

    const jwks = await secrets.getSecretValue<{ keys: JWK[] }>('HS_PLATFORM_JWKS');
    if (!jwks?.keys?.length) {
      throw new Error('Platform JWKS not found in HS_PLATFORM_JWKS');
    }

    const publicKeys = { keys: jwks.keys.map(stripPrivateFields) };

    try {
      await cache.set(redisCacheKey, publicKeys, CacheTTL.PLATFORM_JWKS);
    } catch {
      /* non-fatal */
    }

    this.inMemoryPublicKeys = publicKeys;
    return publicKeys;
  }

  /** @deprecated Use getKeySet() instead */
  async getPublicKey(): Promise<JWK> {
    const jwks = await this.getPublicJwks();
    const key = jwks.keys.find((k) => k.use === 'sig');
    if (!key) throw new Error('No signing key found in JWKS');
    return key;
  }
}

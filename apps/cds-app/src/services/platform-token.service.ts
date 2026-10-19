import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SignJWT, importJWK } from 'jose';
import { v7 as uuidv7 } from 'uuid';
import { httpClient } from '@hs/infra';
import { logger } from '@hs/observability';
import { secrets } from '@hs/infra';

// ─── Platform Token Service ──────────────────────────────────────────────────
//
// Single source of truth for the platform access token CDS-app uses when
// calling bridge-api (or any other IB service). Implements the
// `urn:ietf:params:oauth:grant-type:jwt-bearer` flow: sign a short-lived
// client assertion with the platform JWKS private key, exchange it for an
// access token at admin-api, cache until a minute before expiry.
//
// Every bridge consumer (BridgeClientService, TerminologyClient, future
// admin-api clients, …) should inject this rather than re-implementing the
// token dance. Keeping the JWT flow in one place means:
//   - one cache, no duplicated token requests from concurrent callers
//   - one place to change the grant type, signing alg, or audience
//   - one place to add metrics / tracing around auth

const ALG = 'RS384';

/** Narrow shape of a JWK entry — only the fields used here. */
interface JwkSigningKey {
  kty: string;
  use?: string;
  alg?: string;
  kid?: string;
  n?: string;
  e?: string;
  d?: string;
  p?: string;
  q?: string;
  dp?: string;
  dq?: string;
  qi?: string;
}

/** Refresh 60s early to avoid edge-of-expiry races. */
const EXPIRY_SLACK_MS = 60_000;

@Injectable()
export class PlatformTokenService {
  private token: string | null = null;
  private expiresAt = 0;
  private inflight: Promise<string> | null = null;

  constructor(private readonly config: ConfigService) {}

  /**
   * Return a valid access token. Concurrent callers share a single
   * in-flight request so we never fire two token exchanges back-to-back.
   */
  async getToken(): Promise<string> {
    const now = Date.now();
    if (this.token && now < this.expiresAt) return this.token;

    if (!this.inflight) {
      this.inflight = this.fetchFreshToken().finally(() => {
        this.inflight = null;
      });
    }
    return this.inflight;
  }

  // ── Internal ───────────────────────────────────────────────────────────

  private async fetchFreshToken(): Promise<string> {
    const clientId = this.requireConfig('app.cdsClientId');
    const jwksSecret = this.requireConfig('app.platformJwksSecret');
    const oauthIssuer = this.requireConfig('app.oauthIssuer');
    const adminApiUrl = this.requireConfig('app.adminApiUrl');

    const assertion = await this.buildAssertion(clientId, jwksSecret, oauthIssuer);

    const response = await httpClient.request<{
      access_token: string;
      expires_in: number;
    }>({
      url: `${adminApiUrl}/api/oauth/token`,
      method: 'post',
      data: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }).toString(),
      contentType: 'application/x-www-form-urlencoded',
    });

    if (!response.data?.access_token) {
      throw new Error('Failed to obtain platform token via jwt-bearer');
    }

    this.token = response.data.access_token;
    this.expiresAt = Date.now() + response.data.expires_in * 1000 - EXPIRY_SLACK_MS;

    logger.info('CDS platform token obtained via jwt-bearer', {
      expiresInSec: response.data.expires_in,
    });

    return this.token;
  }

  private async buildAssertion(clientId: string, jwksSecret: string, oauthIssuer: string): Promise<string> {
    const jwks = await secrets.getSecretValue<{ keys: JwkSigningKey[] }>(jwksSecret);
    if (!jwks?.keys?.length) {
      throw new Error(`Platform JWKS not found in secret: ${jwksSecret}`);
    }

    const signingKey = jwks.keys.find((k) => k.use === 'sig' && k.alg === ALG);
    if (!signingKey) {
      throw new Error(`No signing key with use=sig and alg=${ALG}`);
    }

    const key = await importJWK(signingKey, ALG);
    return new SignJWT({ client_id: clientId })
      .setProtectedHeader({ alg: ALG, kid: signingKey.kid, typ: 'JWT' })
      .setIssuer(clientId)
      .setSubject(clientId)
      .setAudience(`${oauthIssuer}/oauth/token`)
      .setJti(uuidv7())
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(key);
  }

  private requireConfig(key: string): string {
    const value = this.config.get<string>(key);
    if (!value) throw new Error(`${key} must be configured`);
    return value;
  }
}

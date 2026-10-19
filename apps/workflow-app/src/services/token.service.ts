import { Injectable } from '@nestjs/common';
import { SignJWT, importJWK } from 'jose';
import { v7 as uuidv7 } from 'uuid';
import { httpClient } from '@hs/infra';
import { logger } from '@hs/observability';
import { cache } from '@hs/infra';
import { secrets } from '@hs/infra';

const ALG = 'RS384';
const OAUTH_ISSUER = process.env.OAUTH_ISSUER || 'http://localhost:3002';

@Injectable()
export class TokenService {
  private readonly adminApiUrl =
    process.env.ADMIN_API_INTERNAL_URL || process.env.ADMIN_API_URL || 'http://localhost:3002';

  private serviceToken: string | null = null;
  private serviceTokenExpiresAt = 0;

  /**
   * Get a platform JWT for an application.
   * Caches tokens per appId with TTL = token lifetime - 60s buffer.
   */
  async getTokenForApp(applicationId: string): Promise<string> {
    const cacheKey = `executor:token:${applicationId}`;

    const cached = await cache.get<string>(cacheKey).catch(() => null);
    if (cached) return cached;

    // Call admin-api internal endpoint with self-signed internal JWT
    const internalToken = await this.getServiceToken();
    const response = await httpClient.request({
      url: `${this.adminApiUrl}/api/oauth/service-token`,
      method: 'post',
      data: { applicationId },
      authType: 'Bearer',
      authToken: internalToken,
    });

    const { access_token, expires_in } = response.data as {
      access_token: string;
      expires_in: number;
    };

    const ttl = Math.max((expires_in || 3600) - 60, 60);
    await cache.set(cacheKey, access_token, ttl).catch(() => {});

    logger.info('Token obtained for app', { applicationId, expiresIn: expires_in });
    return access_token;
  }

  /**
   * Self-sign an internal service JWT using the shared platform JWKS.
   * Same pattern as bridge-api's AdminClientService and cds-app's BridgeClientService.
   */
  private async getServiceToken(): Promise<string> {
    const now = Date.now();
    if (this.serviceToken && now < this.serviceTokenExpiresAt) {
      return this.serviceToken;
    }

    const jwks = await secrets.getSecretValue<{ keys: any[] }>('HS_PLATFORM_JWKS');
    if (!jwks?.keys?.length) throw new Error('Platform JWKS not found in secrets');

    const signingKey = jwks.keys.find((k: any) => k.use === 'sig' && k.alg === ALG);
    if (!signingKey) throw new Error(`No signing key with use=sig and alg=${ALG}`);

    const key = await importJWK(signingKey, ALG);
    const expiresIn = 3600;

    const token = await new SignJWT({
      token_type: 'api',
      internal: true,
      client_id: 'workflow-executor',
      org_id: 'system',
      scope: 'internal',
      app_type: 'WORKFLOW',
    })
      .setProtectedHeader({ alg: ALG, kid: signingKey.kid, typ: 'JWT' })
      .setIssuer(OAUTH_ISSUER)
      .setSubject('workflow-executor')
      .setAudience(`${OAUTH_ISSUER}/api`)
      .setJti(uuidv7())
      .setIssuedAt()
      .setExpirationTime(`${expiresIn}s`)
      .sign(key);

    this.serviceToken = token;
    this.serviceTokenExpiresAt = now + (expiresIn - 60) * 1000;
    logger.info('Workflow-executor: self-signed internal service token');
    return token;
  }
}

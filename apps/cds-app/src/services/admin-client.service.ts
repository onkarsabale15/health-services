import { SignJWT, importJWK } from 'jose';
import { v7 as uuidv7 } from 'uuid';
import { httpClient } from '@hs/infra';
import { secrets } from '@hs/infra';
import { logger } from '@hs/observability';

const ADMIN_API_URL = process.env.ADMIN_API_URL || 'http://localhost:3002';
const OAUTH_ISSUER = process.env.OAUTH_ISSUER || 'http://localhost:3002';
const ALG = 'RS384';

/** Narrow shape of a JWK entry — only the fields we read here. */
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

/**
 * HTTP client for cds-app → admin-api internal calls.
 * Same pattern as bridge-api's admin-client: self-signs a JWT using
 * the shared platform JWKS with `internal: true` claim.
 */
class CdsAdminClient {
  private token: string | null = null;
  private tokenExpiresAt = 0;
  private refreshing: Promise<string> | null = null;

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

  private async signToken(): Promise<string> {
    const jwks = await secrets.getSecretValue<{ keys: JwkSigningKey[] }>('HS_PLATFORM_JWKS');
    if (!jwks?.keys?.length) throw new Error('Platform JWKS not found in secrets manager');

    const signingKey = jwks.keys.find((k) => k.use === 'sig' && k.alg === ALG);
    if (!signingKey) throw new Error(`No signing key with use=sig and alg=${ALG}`);

    const key = await importJWK(signingKey, ALG);
    const expiresIn = 3600;

    const token = await new SignJWT({
      token_type: 'api',
      internal: true,
      client_id: 'cds-service',
      org_id: 'system',
      scope: 'internal',
      app_type: 'CDS',
    })
      .setProtectedHeader({ alg: ALG, kid: signingKey.kid, typ: 'JWT' })
      .setIssuer(OAUTH_ISSUER)
      .setSubject('cds-service')
      .setAudience(`${OAUTH_ISSUER}/api`)
      .setJti(uuidv7())
      .setIssuedAt()
      .setExpirationTime(`${expiresIn}s`)
      .sign(key);

    this.token = token;
    this.tokenExpiresAt = Date.now() + expiresIn * 1000;
    logger.info('CDS internal service token signed', { expiresIn });
    return token;
  }

  /** List all EHR integrations configured for an application (with sites). */
  async listIntegrations(applicationId: string): Promise<EhrIntegration[]> {
    const token = await this.getServiceToken();
    const response = await httpClient.request<EhrIntegration[]>({
      url: `${ADMIN_API_URL}/api/applications/${applicationId}/ehr`,
      method: 'get',
      authType: 'Bearer',
      authToken: token,
    });
    return response.data || [];
  }
}

/** EHR integration record returned by admin-api. Narrow shape — fields cds-app reads. */
export interface EhrIntegration {
  id: string;
  ehrName: string;
  ehrAppType?: 'system' | 'provider-ehr' | 'provider-standalone' | string;
  ehrConfig?: Record<string, unknown>;
  sites?: Array<{ id: string; name?: string; isDefault?: boolean; isActive?: boolean }>;
}

export const cdsAdminClient = new CdsAdminClient();

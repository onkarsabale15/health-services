import { v7 as uuidv7 } from 'uuid';
import { SignJWT, importJWK, createLocalJWKSet, JWK } from 'jose';
import { secrets } from '@hs/infra';
import { logger } from '@hs/observability';

const PRIVATE_KEY_FIELDS = ['d', 'p', 'q', 'dp', 'dq', 'qi'];
const SIG_ALG_PREFERENCE = ['RS384', 'RS512', 'RS256'];

interface PlatformJwks {
  keys: JWK[];
}

let cachedJwks: PlatformJwks | null = null;
let cachedJwksVerify: ReturnType<typeof createLocalJWKSet> | null = null;

function stripPrivateFields(jwk: JWK): JWK {
  const pub = { ...jwk };
  for (const field of PRIVATE_KEY_FIELDS) {
    delete (pub as any)[field];
  }
  return pub;
}

async function getJwks(): Promise<PlatformJwks> {
  if (cachedJwks) return cachedJwks;

  const data = await secrets.getSecretValue<PlatformJwks>('HS_PLATFORM_JWKS');
  if (!data?.keys?.length) {
    throw new Error('JWKS secret HS_PLATFORM_JWKS is empty or missing keys');
  }
  cachedJwks = data;
  return cachedJwks;
}

/**
 * Get a jose JWKS key set for verification.
 * createLocalJWKSet handles kid matching, alg validation, and key selection automatically.
 */
async function getVerificationKeySet(): Promise<ReturnType<typeof createLocalJWKSet>> {
  if (cachedJwksVerify) return cachedJwksVerify;

  const jwks = await getJwks();
  const publicKeys = { keys: jwks.keys.map(stripPrivateFields) };
  cachedJwksVerify = createLocalJWKSet(publicKeys);
  return cachedJwksVerify;
}

/**
 * Pick the strongest signing key (sender's choice per RFC 7517).
 * Prefers RS384 > RS512 > RS256, requires private key material.
 */
function findStrongestSigningKey(keys: JWK[]): JWK {
  for (const alg of SIG_ALG_PREFERENCE) {
    const key = keys.find((k) => k.use === 'sig' && k.alg === alg && k.d);
    if (key) return key;
  }
  // No fallback — only accept keys with approved algorithms (RS384, RS512, RS256)
  throw new Error(`No signing key found in JWKS with approved algorithm (${SIG_ALG_PREFERENCE.join(', ')})`);
}

// ── Signing ──────────────────────────────────────────────────

/** Sign a session JWT for admin UI users (or end-user partner OIDC tokens). */
export async function signSessionToken(payload: {
  sub: string;
  email: string;
  orgId: string;
  role: string;
  /** Override audience — partner-issued end-user tokens use the RP's client_id. */
  audience?: string;
}): Promise<{ accessToken: string; expiresIn: number }> {
  const jwks = await getJwks();
  const signingKey = findStrongestSigningKey(jwks.keys);
  const alg = signingKey.alg || 'RS384';
  const key = await importJWK(signingKey, alg);

  const token = await new SignJWT({
    email: payload.email,
    org_id: payload.orgId,
    role: payload.role,
    token_type: 'session',
  })
    .setProtectedHeader({ alg, kid: signingKey.kid, typ: 'JWT' })
    .setIssuer(getIssuer())
    .setSubject(payload.sub)
    .setAudience(payload.audience ?? `${getIssuer()}/admin`)
    .setJti(uuidv7())
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(key);

  return { accessToken: token, expiresIn: 900 };
}

/** Sign an OAuth access token for API consumers (applications). */
export async function signOAuthToken(payload: {
  sub: string;
  clientId: string;
  orgId: string;
  scope: string;
  ehrAccess: string[];
  expiresIn: number;
  appType: string;
  appName?: string;
  internal?: boolean;
}): Promise<{ accessToken: string; expiresIn: number }> {
  const jwks = await getJwks();
  const signingKey = findStrongestSigningKey(jwks.keys);
  const alg = signingKey.alg || 'RS384';
  const key = await importJWK(signingKey, alg);

  const token = await new SignJWT({
    client_id: payload.clientId,
    org_id: payload.orgId,
    scope: payload.scope,
    ehr_access: payload.ehrAccess,
    app_type: payload.appType,
    app_name: payload.appName,
    token_type: 'api',
    ...(payload.internal && { internal: true }),
  })
    .setProtectedHeader({ alg, kid: signingKey.kid, typ: 'JWT' })
    .setIssuer(getIssuer())
    .setSubject(payload.sub)
    .setAudience(`${getIssuer()}/api`)
    .setJti(uuidv7())
    .setIssuedAt()
    .setExpirationTime(`${payload.expiresIn}s`)
    .sign(key);

  return { accessToken: token, expiresIn: payload.expiresIn };
}

/**
 * Sign an OIDC ID token. Distinct from `signSessionToken` because the
 * audience MUST be the relying-party `client_id` per OIDC Core 1.0 §3.1.3.7,
 * not `${issuer}/admin`. Issued only when `openid` is in the requested
 * scope; carries the standard identity claims plus `nonce` (when present
 * on the originating /authorize request, per §3.1.3.6).
 */
export async function signIdToken(payload: {
  sub: string;
  clientId: string;
  email: string;
  emailVerified: boolean;
  givenName?: string;
  familyName?: string;
  nonce?: string;
  authTime?: number;
  expiresIn: number;
}): Promise<{ idToken: string; expiresIn: number }> {
  const jwks = await getJwks();
  const signingKey = findStrongestSigningKey(jwks.keys);
  const alg = signingKey.alg || 'RS384';
  const key = await importJWK(signingKey, alg);
  const fullName = [payload.givenName, payload.familyName].filter(Boolean).join(' ') || undefined;

  const claims: Record<string, unknown> = {
    email: payload.email,
    email_verified: payload.emailVerified,
    token_type: 'id',
  };
  if (fullName) claims.name = fullName;
  if (payload.givenName) claims.given_name = payload.givenName;
  if (payload.familyName) claims.family_name = payload.familyName;
  if (payload.nonce) claims.nonce = payload.nonce;
  if (payload.authTime !== undefined) claims.auth_time = payload.authTime;

  const token = await new SignJWT(claims)
    .setProtectedHeader({ alg, kid: signingKey.kid, typ: 'JWT' })
    .setIssuer(getIssuer())
    .setSubject(payload.sub)
    .setAudience(payload.clientId)
    .setJti(uuidv7())
    .setIssuedAt()
    .setExpirationTime(`${payload.expiresIn}s`)
    .sign(key);

  return { idToken: token, expiresIn: payload.expiresIn };
}

// ── Verification ─────────────────────────────────────────────

/**
 * Verify any platform JWT (session or API).
 * Uses jose's createLocalJWKSet which automatically:
 * - Matches the kid from the JWT header to the right key
 * - Validates the alg matches the key's algorithm
 * - Handles key rotation (multiple keys in the set)
 */
export async function verifyToken(token: string, audience?: string): Promise<any> {
  const keySet = await getVerificationKeySet();
  const issuer = getIssuer();

  try {
    const { payload } = await (
      await import('jose')
    ).jwtVerify(token, keySet, {
      issuer,
      audience,
    });
    return payload;
  } catch (err) {
    throw err;
  }
}

// ── Public API ───────────────────────────────────────────────

/** Get public JWKS for /.well-known/jwks.json endpoint. */
export async function getPublicJwks(): Promise<{ keys: JWK[] }> {
  const jwks = await getJwks();
  return { keys: jwks.keys.map(stripPrivateFields) };
}

/** Sign a CDS provider token for system-mode platform launch. */
export async function signCdsProviderToken(payload: {
  sub: string;
  email: string;
  applicationId: string;
  siteId?: string;
  firstName: string;
  lastName: string;
  npi?: string;
  providerFhirId?: string;
  ehrName?: string;
}): Promise<{ token: string; expiresIn: number }> {
  const jwks = await getJwks();
  const signingKey = findStrongestSigningKey(jwks.keys);
  const alg = signingKey.alg || 'RS384';
  const key = await importJWK(signingKey, alg);
  const issuer = getIssuer();

  const token = await new SignJWT({
    email: payload.email,
    applicationId: payload.applicationId,
    siteId: payload.siteId,
    firstName: payload.firstName,
    lastName: payload.lastName,
    npi: payload.npi,
    providerFhirId: payload.providerFhirId,
    ehrName: payload.ehrName,
    token_type: 'cds_provider',
  })
    .setProtectedHeader({ alg, kid: signingKey.kid, typ: 'JWT' })
    .setIssuer(issuer)
    .setSubject(payload.sub)
    .setAudience(`${issuer}/cds`)
    .setJti(uuidv7())
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(key);

  return { token, expiresIn: 28800 };
}

export function getIssuer(): string {
  return process.env.OAUTH_ISSUER || 'http://localhost:3002';
}

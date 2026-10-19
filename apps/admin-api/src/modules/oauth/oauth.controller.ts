import { randomBytes, createHash, timingSafeEqual } from 'crypto';
import {
  Controller,
  Post,
  Get,
  Query,
  Req,
  Res,
  Body,
  Headers,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiSecurity, ApiHeader, ApiQuery } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import * as bcrypt from 'bcrypt';
import { jwtVerify, createLocalJWKSet } from 'jose';
import { db } from '@hs/infra';
import { cache } from '@hs/infra';
import { logger } from '@hs/observability';
import { getAllScopes } from '@hs/config';
import {
  signSessionToken,
  signOAuthToken,
  signIdToken,
  getPublicJwks,
  getIssuer,
  verifyToken,
} from '../auth/jwt.service';
import {
  TokenRequestDto,
  IntrospectRequestDto,
  RevokeRequestDto,
  TokenResponseDto,
  IntrospectResponseDto,
  OAuthErrorDto,
} from './oauth.dto';
import { Public } from '../../decorators/auth.decorator';
import { AdminCacheKeys } from '../../cache/cache-keys';
import { AdminCacheTTL } from '../../cache/cache-ttl';
import { validateRedirectUri } from '../../utils/redirect-uri.util';
import { ConsentService } from './consent.service';

/**
 * RFC 6749 §3.3 / OIDC Core §3.1.2.1 — `scope` is a space-delimited string;
 * presence of `openid` triggers OIDC behavior on the token endpoint.
 */
function hasOpenIdScope(scope: string | null | undefined): boolean {
  if (!scope) return false;
  return scope.split(/\s+/).includes('openid');
}

/** Default ID token lifetime (matches access-token 15-min lifetime). */
const ID_TOKEN_TTL_SECONDS = 900;

interface CachedAppMeta {
  id: string;
  name: string;
  clientId: string;
  organizationId: string;
  allowedGrantTypes: string[];
  scopes: string[];
  tokenLifetime: number;
  appType: string;
  status: string;
  ehrAccess: string[];
}

@ApiTags('OAuth 2.0')
@Controller()
@Public()
export class OAuthController {
  constructor(private readonly consentService: ConsentService) {}

  // ─── Discovery ───────────────────────────────────────────

  @Get('.well-known/openid-configuration')
  @ApiSecurity({})
  @ApiOperation({ summary: 'OpenID Connect Discovery' })
  getOpenIdConfig() {
    const issuer = getIssuer();
    return {
      issuer,
      authorization_endpoint: `${issuer}/oauth/authorize`,
      token_endpoint: `${issuer}/oauth/token`,
      token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post', 'private_key_jwt'],
      grant_types_supported: [
        'client_credentials',
        'urn:ietf:params:oauth:grant-type:jwt-bearer',
        'authorization_code',
        'refresh_token',
      ],
      jwks_uri: `${issuer}/.well-known/jwks.json`,
      userinfo_endpoint: `${issuer}/oauth/userinfo`,
      end_session_endpoint: `${issuer}/oauth/logout`,
      introspection_endpoint: `${issuer}/oauth/introspect`,
      introspection_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post'],
      revocation_endpoint: `${issuer}/oauth/revoke`,
      revocation_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post'],
      scopes_supported: getAllScopes(),
      response_types_supported: ['code'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['RS384'],
      token_endpoint_auth_signing_alg_values_supported: ['RS256', 'RS384'],
      code_challenge_methods_supported: ['S256'],
      claims_supported: [
        'sub',
        'iss',
        'aud',
        'exp',
        'iat',
        'auth_time',
        'nonce',
        'email',
        'email_verified',
        'name',
        'given_name',
        'family_name',
        'updated_at',
      ],
    };
  }

  @Get('.well-known/smart-configuration')
  @ApiSecurity({})
  @ApiOperation({ summary: 'SMART on FHIR Configuration' })
  getSmartConfig() {
    const issuer = getIssuer();
    return {
      ...this.getOpenIdConfig(),
      capabilities: [
        'launch-ehr',
        'launch-standalone',
        'client-public',
        'client-confidential-symmetric',
        'context-ehr-patient',
        'context-ehr-encounter',
        'permission-offline',
        'permission-patient',
        'permission-user',
        'sso-openid-connect',
      ],
    };
  }

  @Get('.well-known/jwks.json')
  @ApiSecurity({})
  @ApiOperation({ summary: 'JSON Web Key Set (public keys)' })
  async getJwks() {
    return getPublicJwks();
  }

  // ─── Authorization Endpoint (RFC 6749 + PKCE) ─────────────

  @Get('oauth/authorize')
  @ApiSecurity({})
  @ApiOperation({ summary: 'OAuth 2.0 Authorization Code with PKCE' })
  @ApiQuery({ name: 'response_type', required: true, description: 'Must be "code"' })
  @ApiQuery({ name: 'redirect_uri', required: true, description: 'Client redirect URI' })
  @ApiQuery({ name: 'state', required: true, description: 'CSRF protection state parameter' })
  @ApiQuery({ name: 'code_challenge', required: true, description: 'PKCE code challenge (S256)' })
  @ApiQuery({ name: 'code_challenge_method', required: true, description: 'Must be "S256"' })
  @ApiQuery({ name: 'scope', required: false, description: 'Requested scopes' })
  @ApiQuery({ name: 'client_id', required: false, description: 'Client identifier (RFC 6749 S4.1.1)' })
  @ApiQuery({ name: 'app_id', required: false, description: 'Application ID (alias for client_id)' })
  @ApiQuery({ name: 'sso_code', required: false, description: 'Short-lived SSO code (from /admin/auth/sso-code)' })
  @ApiQuery({
    name: 'nonce',
    required: false,
    description: 'OIDC nonce — echoed verbatim in id_token (OIDC Core §3.1.2.1)',
  })
  @ApiResponse({ status: 302, description: 'Redirects to redirect_uri with authorization code' })
  @ApiResponse({ status: 400, description: 'Invalid request parameters' })
  @ApiResponse({ status: 302, description: 'Redirects to admin-ui signin if no valid session' })
  async authorize(
    @Query('response_type') responseType: string,
    @Query('redirect_uri') redirectUri: string,
    @Query('state') state: string,
    @Query('code_challenge') codeChallenge: string,
    @Query('code_challenge_method') codeChallengeMethod: string,
    @Query('scope') scope: string | undefined,
    @Query('client_id') clientId: string | undefined,
    @Query('app_id') appIdParam: string | undefined,
    @Query('sso_code') ssoCode: string | undefined,
    @Query('nonce') nonce: string | undefined,
    @Req() req: any,
    @Res() res: any,
  ) {
    // Resolve client_id (RFC standard) or app_id (legacy alias)
    const appId = clientId || appIdParam;

    // 1. Validate required params
    if (responseType !== 'code') {
      throw new BadRequestException('response_type must be "code"');
    }
    if (!redirectUri) {
      throw new BadRequestException('redirect_uri is required');
    }
    if (!state) {
      throw new BadRequestException('state is required');
    }
    if (!codeChallenge) {
      throw new BadRequestException('code_challenge is required');
    }
    if (codeChallengeMethod !== 'S256') {
      throw new BadRequestException('code_challenge_method must be S256');
    }

    // 2. Validate redirect_uri against allowed origins (RFC 6749 Section 3.1.2.2)
    await validateRedirectUri(redirectUri, appId);

    // 3. Resolve user identity from SSO code or Authorization header
    const authHeader = req.headers['authorization'];
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    type SsoCodePayload = {
      userId: string;
      email: string;
      emailVerified: boolean;
      orgId: string;
      role: string;
      firstName: string;
      lastName: string;
      organizationName: string;
    };
    let userData: SsoCodePayload | null = null;

    // Try SSO code first (preferred — opaque, one-time, short-lived)
    if (ssoCode) {
      userData = await cache.getdel<SsoCodePayload>(AdminCacheKeys.ssoCode(ssoCode));
    }

    // Fall back to Bearer token (for direct API calls)
    if (!userData && bearerToken) {
      try {
        const verified = await this.verifySessionToken(bearerToken);
        const prisma = db.getClient();
        const dbUser = await prisma.user.findUnique({
          where: { id: verified.id },
          include: { organization: true },
        });
        if (dbUser && dbUser.status === 'ACTIVE') {
          userData = {
            userId: dbUser.id,
            email: dbUser.email,
            emailVerified: dbUser.emailVerified,
            orgId: dbUser.organizationId,
            role: dbUser.role,
            firstName: dbUser.firstName,
            lastName: dbUser.lastName,
            organizationName: dbUser.organization.name,
          };
        }
      } catch {
        // Invalid bearer token — fall through to redirect
      }
    }

    if (!userData) {
      // No valid authentication — redirect to admin-ui signin
      const adminUiUrl = process.env.ADMIN_UI_URL || 'http://localhost:3001';
      const adminApiUrl = process.env.ADMIN_API_URL || process.env.OAUTH_ISSUER || 'http://localhost:3002';
      // Build return_url from configured base URL (never from Host header)
      const returnUrl = `${adminApiUrl}${req.originalUrl}`;
      return res.redirect(`${adminUiUrl}/auth/signin?return_url=${encodeURIComponent(returnUrl)}`);
    }

    // 4. Verify user is still active. Re-pull `emailVerified` from the DB
    // here so the value is always fresh at code-issuance time regardless of
    // which auth path populated `userData` (bearer / SSO code).
    const prisma = db.getClient();
    const dbUser = await prisma.user.findUnique({
      where: { id: userData.userId },
      select: { id: true, status: true, emailVerified: true },
    });

    if (!dbUser || dbUser.status !== 'ACTIVE') {
      // RFC 6749 S4.1.2.1: redirect errors back to redirect_uri after it's been validated
      return this.redirectWithError(res, redirectUri, 'access_denied', 'User account is not active', state);
    }
    userData.emailVerified = dbUser.emailVerified;

    // 4b. Partner consent gate — when an external (PARTNER) app requests OIDC,
    // route through the consent screen unless an active ConsentGrant already
    // covers the requested scopes. First-party apps (admin/workflow/cds) skip.
    if (appId) {
      const [targetApp, endUser] = await Promise.all([
        prisma.application.findFirst({
          where: { OR: [{ clientId: appId }, { id: appId }] },
          select: { id: true, clientId: true, appType: true, organizationId: true },
        }),
        prisma.endUser.findUnique({ where: { email: userData.email } }),
      ]);
      if (targetApp?.appType === 'PARTNER' && hasOpenIdScope(scope ?? null)) {
        const requestedScopes = (scope ?? '').split(/\s+/).filter(Boolean);

        if (endUser) {
          const existing = await this.consentService.findActive(endUser.id, targetApp.clientId);
          if (existing && this.consentService.satisfiesScopes(existing.scopes, requestedScopes)) {
            await this.consentService.touch(endUser.id, targetApp.clientId);
            // Skip consent screen — fall through to issue code below.
          } else {
            return this.redirectToConsent(res, {
              endUserId: endUser.id,
              email: userData.email,
              clientId: targetApp.clientId,
              applicationId: targetApp.id,
              scopes: requestedScopes,
              redirectUri,
              state,
              codeChallenge,
              codeChallengeMethod,
              nonce,
            });
          }
        } else {
          // No EndUser yet — admin has not invited this human. Deny.
          return this.redirectWithError(
            res,
            redirectUri,
            'access_denied',
            'Your account is not authorized for this application',
            state,
          );
        }
      }
    }

    // 5. Generate one-time authorization code
    const code = randomBytes(32).toString('hex');

    // 6. Store in Redis with 60s TTL (critical — must not fail silently)
    await cache.set(
      AdminCacheKeys.oauthCode(code),
      {
        userId: userData.userId,
        email: userData.email,
        emailVerified: userData.emailVerified,
        orgId: userData.orgId,
        role: userData.role,
        firstName: userData.firstName,
        lastName: userData.lastName,
        organizationName: userData.organizationName,
        redirectUri,
        codeChallenge,
        codeChallengeMethod,
        appId: appId || null,
        scope: scope || null,
        nonce: nonce || null,
      },
      AdminCacheTTL.OAUTH_CODE,
    );

    logger.info('OAuth authorization code issued', {
      userId: userData.userId,
      orgId: userData.orgId,
      appId: appId || null,
    });

    // 7. Redirect to redirect_uri with code and state
    const redirectUrl = new URL(redirectUri);
    redirectUrl.searchParams.set('code', code);
    redirectUrl.searchParams.set('state', state);
    if (appId) redirectUrl.searchParams.set('app_id', appId);
    return res.redirect(redirectUrl.toString());
  }

  // ─── Token Endpoint (RFC 6749) ───────────────────────────

  @Post('oauth/token')
  @Throttle({ default: { limit: 60, ttl: 60000 } }) // 60/min per clientId (identity tracker extracts from Basic auth or body)
  @ApiSecurity({})
  @ApiOperation({ summary: 'OAuth 2.0 Token Endpoint' })
  @ApiHeader({
    name: 'authorization',
    required: false,
    description:
      'HTTP Basic auth: "Basic base64(client_id:client_secret)". Alternative to sending client_id/client_secret in the body.',
  })
  @ApiResponse({ status: 200, description: 'Token issued', type: TokenResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid request', type: OAuthErrorDto })
  @ApiResponse({ status: 401, description: 'Invalid client', type: OAuthErrorDto })
  async token(@Body() body: TokenRequestDto, @Headers('authorization') authHeader?: string) {
    const grantType = body.grant_type;

    if (grantType === 'client_credentials') {
      return this.handleClientCredentials(body, authHeader);
    }

    if (grantType === 'urn:ietf:params:oauth:grant-type:jwt-bearer') {
      return this.handleJwtBearer(body);
    }

    if (grantType === 'authorization_code') {
      return this.handleAuthorizationCode(body);
    }

    if (grantType === 'refresh_token') {
      return this.handleRefreshToken(body);
    }

    throw new BadRequestException({
      error: 'unsupported_grant_type',
      error_description: `Grant type '${grantType}' is not supported`,
    });
  }

  // ─── Token Introspection (RFC 7662) ──────────────────────

  @Post('oauth/introspect')
  @Throttle({ default: { limit: 300, ttl: 60000 } }) // 300/min — resource servers call this per-request
  @ApiSecurity({})
  @ApiOperation({ summary: 'Token Introspection (RFC 7662)' })
  @ApiHeader({
    name: 'authorization',
    required: false,
    description: 'Client authentication: "Basic base64(client_id:client_secret)"',
  })
  @ApiResponse({ status: 200, description: 'Introspection result', type: IntrospectResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid client credentials' })
  async introspect(@Body() body: IntrospectRequestDto, @Headers('authorization') authHeader?: string) {
    // RFC 7662 S2.1: "The authorization server MUST require client authentication"
    await this.validateClientAuth(body as any, authHeader);

    const token = body.token;
    if (!token) return { active: false };

    try {
      const payload = await verifyToken(token);

      // Check revocation in Redis
      const revoked = await cache.get(AdminCacheKeys.oauthRevoked(payload.jti as string));
      if (revoked) return { active: false };

      return {
        active: true,
        sub: payload.sub,
        client_id: payload.client_id,
        scope: payload.scope,
        iss: payload.iss,
        exp: payload.exp,
        iat: payload.iat,
        token_type: 'Bearer',
        ehr_access: payload.ehr_access,
        app_type: payload.app_type,
        app_name: payload.app_name,
      };
    } catch {
      return { active: false };
    }
  }

  // ─── Token Revocation (RFC 7009) ─────────────────────────

  @Post('oauth/revoke')
  @Throttle({ default: { limit: 30, ttl: 60000 } }) // 30/min per identity
  @ApiSecurity({})
  @ApiOperation({ summary: 'Token Revocation (RFC 7009)' })
  @ApiHeader({
    name: 'authorization',
    required: false,
    description: 'Client authentication: "Basic base64(client_id:client_secret)"',
  })
  @ApiResponse({ status: 200, description: 'Token revoked (always 200 per RFC)' })
  async revoke(@Body() body: RevokeRequestDto, @Headers('authorization') authHeader?: string) {
    // RFC 7009 S2.1: "The authorization server first validates the client credentials"
    await this.validateClientAuth(body as any, authHeader);

    const token = body.token;
    if (!token) return {};

    // Try revoking as JWT first
    try {
      const payload = await verifyToken(token);
      if (payload.jti && payload.exp) {
        const ttl = Math.max(0, (payload.exp as number) - Math.floor(Date.now() / 1000));
        if (ttl > 0) {
          await cache.set(AdminCacheKeys.oauthRevoked(payload.jti as string), '1', ttl);
        }
      }
      return {};
    } catch {
      // Not a valid JWT — try as opaque refresh token
    }

    // Try revoking as an opaque refresh token
    if (body.token_type_hint === 'refresh_token' || !body.token_type_hint) {
      await cache.del(AdminCacheKeys.sessionRefresh(token)).catch(() => {});
    }

    return {};
  }

  // ─── Private: Client Credentials ─────────────────────────

  private async handleClientCredentials(body: Record<string, any>, authHeader?: string) {
    let clientId: string;
    let clientSecret: string;

    // Support both Basic auth header and post body
    if (authHeader?.startsWith('Basic ')) {
      const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf-8');
      const colonIdx = decoded.indexOf(':');
      clientId = decoded.substring(0, colonIdx);
      clientSecret = decoded.substring(colonIdx + 1);
    } else if (body.client_id && body.client_secret) {
      clientId = body.client_id;
      clientSecret = body.client_secret;
    } else {
      throw new BadRequestException({
        error: 'invalid_request',
        error_description: 'Missing client credentials',
      });
    }

    const prisma = db.getClient();
    const app = await prisma.application.findUnique({
      where: { clientId },
      include: { ehrAccess: { where: { status: 'ACTIVE' } } },
    });

    if (!app || app.status !== 'ACTIVE') {
      throw new UnauthorizedException({ error: 'invalid_client', error_description: 'Unknown client' });
    }

    if (!app.clientSecretHash) {
      throw new UnauthorizedException({
        error: 'invalid_client',
        error_description: 'Client not configured for secret-based auth',
      });
    }

    const valid = await bcrypt.compare(clientSecret, app.clientSecretHash);
    if (!valid) {
      throw new UnauthorizedException({ error: 'invalid_client', error_description: 'Invalid client credentials' });
    }

    if (!app.allowedGrantTypes.includes('client_credentials')) {
      throw new BadRequestException({
        error: 'unauthorized_client',
        error_description: 'Client not authorized for client_credentials grant',
      });
    }

    const scope = this.resolveScopes(body.scope, app.scopes);
    const ehrAccess = app.ehrAccess.map((e) => e.ehrName);

    const token = await signOAuthToken({
      sub: app.id,
      clientId: app.clientId,
      orgId: app.organizationId,
      scope,
      ehrAccess,
      expiresIn: app.tokenLifetime,
      appType: app.appType,
      appName: app.name,
    });

    return {
      access_token: token.accessToken,
      token_type: 'Bearer',
      expires_in: token.expiresIn,
      scope,
    };
  }

  // ─── Private: JWT Bearer Assertion ───────────────────────

  private async handleJwtBearer(body: Record<string, any>) {
    const assertion = body.assertion;
    if (!assertion) {
      throw new BadRequestException({
        error: 'invalid_request',
        error_description: 'Missing assertion',
      });
    }

    // Per RFC 7523: extract client_id from the JWT's iss claim (body.client_id is optional)
    let clientId = body.client_id;
    if (!clientId) {
      try {
        const [headerB64, payloadB64] = assertion.split('.');
        const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
        clientId = payload.iss || payload.sub || payload.client_id;
      } catch {
        /* will fail below if clientId is still empty */
      }
    }

    if (!clientId) {
      throw new BadRequestException({
        error: 'invalid_request',
        error_description: 'Cannot determine client_id from assertion (missing iss claim)',
      });
    }

    // Try cache first for app metadata (excludes sensitive fields)
    let appMeta = await cache.get<CachedAppMeta>(AdminCacheKeys.appMeta(clientId));
    let jwks: any;

    if (!appMeta) {
      const prisma = db.getClient();
      const app = await prisma.application.findUnique({
        where: { clientId },
        include: { ehrAccess: { where: { status: 'ACTIVE' } } },
      });

      if (!app || app.status !== 'ACTIVE') {
        throw new UnauthorizedException({ error: 'invalid_client', error_description: 'Unknown client' });
      }

      appMeta = {
        id: app.id,
        name: app.name,
        clientId: app.clientId,
        organizationId: app.organizationId,
        allowedGrantTypes: app.allowedGrantTypes,
        scopes: app.scopes,
        tokenLifetime: app.tokenLifetime,
        appType: app.appType,
        status: app.status,
        ehrAccess: app.ehrAccess.map((e) => e.ehrName),
      };

      // Cache app metadata (no secret hash)
      await cache.set(AdminCacheKeys.appMeta(clientId), appMeta, AdminCacheTTL.APP_META).catch(() => {});

      // Cache JWKS separately
      jwks = app.jwks;
      if (jwks?.keys?.length) {
        await cache.set(AdminCacheKeys.appJwks(clientId), jwks, AdminCacheTTL.APP_JWKS).catch(() => {});
      }
    }

    if (!appMeta.allowedGrantTypes.includes('urn:ietf:params:oauth:grant-type:jwt-bearer')) {
      throw new BadRequestException({
        error: 'unauthorized_client',
        error_description: 'Client not authorized for jwt-bearer grant',
      });
    }

    // Load JWKS from cache if not already loaded from DB
    if (!jwks) {
      jwks = await cache.get(AdminCacheKeys.appJwks(clientId));
    }

    if (!jwks?.keys?.length) {
      // Fallback: fetch JWKS from DB if cache miss
      const prisma = db.getClient();
      const app = await prisma.application.findUnique({
        where: { clientId },
        select: { jwks: true },
      });
      jwks = app?.jwks as any;
      if (jwks?.keys?.length) {
        await cache.set(AdminCacheKeys.appJwks(clientId), jwks, AdminCacheTTL.APP_JWKS).catch(() => {});
      }
    }

    if (!jwks?.keys?.length) {
      throw new BadRequestException({
        error: 'invalid_client',
        error_description: 'Client has no JWKS configured for JWT assertion',
      });
    }

    try {
      // Use createLocalJWKSet for kid/alg matching (industry standard per RFC 7517)
      const keySet = createLocalJWKSet(jwks);
      await jwtVerify(assertion, keySet, { issuer: clientId, subject: clientId });
    } catch (err: any) {
      logger.warn('JWT bearer assertion verification failed', { error: err.message });
      throw new UnauthorizedException({
        error: 'invalid_grant',
        error_description: 'JWT assertion verification failed',
      });
    }

    const scope = this.resolveScopes(body.scope, appMeta.scopes);

    const token = await signOAuthToken({
      sub: appMeta.id,
      clientId: appMeta.clientId,
      orgId: appMeta.organizationId,
      scope,
      ehrAccess: appMeta.ehrAccess,
      expiresIn: appMeta.tokenLifetime,
      appType: appMeta.appType,
      appName: appMeta.name,
    });

    return {
      access_token: token.accessToken,
      token_type: 'Bearer',
      expires_in: token.expiresIn,
      scope,
    };
  }

  // ─── Private: Authorization Code (PKCE) ─────────────────

  private async handleAuthorizationCode(body: TokenRequestDto) {
    const { code, redirect_uri, code_verifier } = body;

    if (!code || !redirect_uri || !code_verifier) {
      throw new BadRequestException({
        error: 'invalid_request',
        error_description: 'code, redirect_uri, and code_verifier are required',
      });
    }

    // 1. Consume code atomically (one-time use via getdel)
    const codeData = await cache.getdel<Record<string, any>>(AdminCacheKeys.oauthCode(code));
    if (!codeData) {
      throw new UnauthorizedException({
        error: 'invalid_grant',
        error_description: 'Invalid or expired authorization code',
      });
    }

    // 2. Verify redirect_uri matches the one used during authorization
    if (codeData.redirectUri !== redirect_uri) {
      throw new BadRequestException({
        error: 'invalid_grant',
        error_description: 'redirect_uri mismatch',
      });
    }

    // 3. PKCE S256 verification using timing-safe comparison
    const expectedChallenge = createHash('sha256').update(code_verifier).digest('base64url');

    const challengeBuffer = Buffer.from(expectedChallenge);
    const storedBuffer = Buffer.from(codeData.codeChallenge);

    if (challengeBuffer.length !== storedBuffer.length || !timingSafeEqual(challengeBuffer, storedBuffer)) {
      throw new UnauthorizedException({
        error: 'invalid_grant',
        error_description: 'PKCE verification failed',
      });
    }

    // 4. Sign a session token for the authenticated user.
    // Partner-issued codes carry { principal: 'end-user', endUserId, clientId }
    // and no orgId/role — the access token's `aud` is the RP's client_id and
    // `sub` is the EndUser id. Operator-issued codes keep the existing shape.
    const isEndUserPrincipal = codeData.principal === 'end-user';
    const sub = isEndUserPrincipal ? codeData.endUserId : codeData.userId;
    const tokenAudience = isEndUserPrincipal ? codeData.clientId : undefined;
    const sessionToken = await signSessionToken({
      sub,
      email: codeData.email,
      orgId: codeData.orgId ?? '',
      role: codeData.role ?? 'end-user',
      audience: tokenAudience,
    });

    // 5. Create a refresh token. Persist `scope` + `appId` so subsequent
    // refreshes can mint a new id_token (with the right RP `aud`) only
    // when the original auth code had `openid`.
    const refreshToken = randomBytes(32).toString('hex');
    await cache.set(
      AdminCacheKeys.sessionRefresh(refreshToken),
      {
        sub,
        email: codeData.email,
        orgId: codeData.orgId ?? null,
        role: codeData.role ?? 'end-user',
        scope: codeData.scope || null,
        appId: codeData.appId || codeData.clientId || null,
        principal: isEndUserPrincipal ? 'end-user' : 'operator',
      },
      AdminCacheTTL.SESSION_REFRESH,
    );

    // 6. Mint an OIDC id_token when the requested scope includes `openid`.
    // `aud` is the relying-party `client_id`, NOT the admin-api audience —
    // OIDC Core §3.1.3.7 requires id_token.aud to match the RP. Falls back
    // to `userId` only if `appId` somehow wasn't recorded (defensive).
    let idToken: string | undefined;
    if (hasOpenIdScope(codeData.scope)) {
      const idTokenResult = await signIdToken({
        sub,
        clientId: codeData.appId || codeData.clientId || sub,
        email: codeData.email,
        emailVerified: !!codeData.emailVerified,
        givenName: codeData.firstName,
        familyName: codeData.lastName,
        nonce: codeData.nonce || undefined,
        authTime: Math.floor(Date.now() / 1000),
        expiresIn: ID_TOKEN_TTL_SECONDS,
      });
      idToken = idTokenResult.idToken;
    }

    logger.info('OAuth authorization_code token issued', {
      userId: codeData.userId,
      orgId: codeData.orgId,
      appId: codeData.appId || null,
      idTokenIssued: !!idToken,
    });

    return {
      access_token: sessionToken.accessToken,
      token_type: 'Bearer',
      expires_in: sessionToken.expiresIn,
      scope: codeData.scope || '',
      refresh_token: refreshToken,
      ...(idToken && { id_token: idToken }),
      app_id: codeData.appId || codeData.clientId,
      user: {
        id: sub,
        email: codeData.email,
        role: codeData.role ?? 'end-user',
        firstName: codeData.firstName,
        lastName: codeData.lastName,
        organizationName: codeData.organizationName,
      },
    };
  }

  // ─── Private: Refresh Token ─────────────────────────────

  private async handleRefreshToken(body: TokenRequestDto) {
    const refreshToken = body.refresh_token;

    if (!refreshToken) {
      throw new BadRequestException({
        error: 'invalid_request',
        error_description: 'refresh_token is required',
      });
    }

    // Consume atomically — one-time use (rotation)
    const userData = await cache.getdel<Record<string, any>>(AdminCacheKeys.sessionRefresh(refreshToken));
    if (!userData) {
      throw new UnauthorizedException({
        error: 'invalid_grant',
        error_description: 'Invalid or expired refresh token',
      });
    }
    // Existing refresh tokens issued before id_token support won't have a
    // `scope` field. Treat absence as "no openid" — backwards-safe.
    const originalScope: string | null = userData.scope ?? null;

    // Verify user is still active
    const prisma = db.getClient();
    const dbUser = await prisma.user.findUnique({
      where: { id: userData.sub },
      include: { organization: true },
    });

    if (!dbUser || dbUser.status !== 'ACTIVE') {
      throw new UnauthorizedException({
        error: 'invalid_grant',
        error_description: 'User account is no longer active',
      });
    }

    // Issue new access token
    const sessionToken = await signSessionToken({
      sub: dbUser.id,
      email: dbUser.email,
      orgId: dbUser.organizationId,
      role: dbUser.role,
    });

    // Issue new refresh token (rotation — old one was consumed above).
    // Carry forward `scope` + `appId` so future refreshes keep id_token
    // issuance consistent with the originating authorization request.
    const newRefreshToken = randomBytes(32).toString('hex');
    await cache.set(
      AdminCacheKeys.sessionRefresh(newRefreshToken),
      {
        sub: dbUser.id,
        email: dbUser.email,
        orgId: dbUser.organizationId,
        role: dbUser.role,
        scope: originalScope,
        appId: userData.appId || null,
      },
      AdminCacheTTL.SESSION_REFRESH,
    );

    // Mint a fresh id_token if the original authorization included `openid`.
    // The refresh blob doesn't carry `client_id` — derive from the access
    // token's `aud` indirectly: we don't have it here. Fallback: omit the
    // id_token if appId can't be reconstructed. For first-party flows
    // (admin-ui / workflow-ui), the access token alone is sufficient.
    // Partner apps that need id_token continuity should re-authorize.
    let idToken: string | undefined;
    if (hasOpenIdScope(originalScope) && userData.appId) {
      const idTokenResult = await signIdToken({
        sub: dbUser.id,
        clientId: userData.appId,
        email: dbUser.email,
        emailVerified: dbUser.emailVerified,
        givenName: dbUser.firstName,
        familyName: dbUser.lastName,
        authTime: Math.floor(Date.now() / 1000),
        expiresIn: ID_TOKEN_TTL_SECONDS,
      });
      idToken = idTokenResult.idToken;
    }

    logger.info('OAuth refresh_token exchanged', {
      userId: dbUser.id,
      orgId: dbUser.organizationId,
      idTokenIssued: !!idToken,
    });

    return {
      access_token: sessionToken.accessToken,
      token_type: 'Bearer',
      expires_in: sessionToken.expiresIn,
      scope: originalScope || '',
      refresh_token: newRefreshToken,
      ...(idToken && { id_token: idToken }),
      user: {
        id: dbUser.id,
        email: dbUser.email,
        role: dbUser.role,
        firstName: dbUser.firstName,
        lastName: dbUser.lastName,
        organizationName: dbUser.organization.name,
      },
    };
  }

  // ─── Private: Session Token Verification ───────────────────

  private async verifySessionToken(token: string): Promise<{
    id: string;
    email: string;
    orgId: string;
    role: string;
  }> {
    const payload = await verifyToken(token, `${getIssuer()}/admin`);
    if (payload.token_type !== 'session') {
      throw new UnauthorizedException('Invalid token type');
    }
    return {
      id: payload.sub as string,
      email: payload.email as string,
      orgId: payload.org_id as string,
      role: payload.role as string,
    };
  }

  // ─── Private: Authorize Error Redirect (RFC 6749 S4.1.2.1) ───

  /**
   * Redirect errors back to redirect_uri per RFC 6749 Section 4.1.2.1.
   * Used only AFTER redirect_uri has been validated.
   */
  private redirectWithError(res: any, redirectUri: string, error: string, description: string, state?: string): void {
    const url = new URL(redirectUri);
    url.searchParams.set('error', error);
    url.searchParams.set('error_description', description);
    if (state) url.searchParams.set('state', state);
    return res.redirect(url.toString());
  }

  /** Mint a consent ticket and redirect the browser to admin-ui's consent screen. */
  private async redirectToConsent(
    res: any,
    payload: {
      endUserId: string;
      email: string;
      clientId: string;
      applicationId: string;
      scopes: string[];
      redirectUri: string;
      state: string;
      codeChallenge: string;
      codeChallengeMethod: string;
      nonce?: string;
    },
  ): Promise<void> {
    const ticket = randomBytes(32).toString('hex');
    await cache.set(AdminCacheKeys.consentTicket(ticket), payload, AdminCacheTTL.CONSENT_TICKET);
    const adminUiUrl = process.env.ADMIN_UI_URL || 'http://localhost:3001';
    return res.redirect(`${adminUiUrl}/consent?ticket=${encodeURIComponent(ticket)}`);
  }

  // ─── Private: Client Authentication (RFC 7662/7009) ─────

  /**
   * Validate client credentials for introspection and revocation endpoints.
   * Accepts Basic auth header or client_id + client_secret in body.
   * Required by RFC 7662 S2.1 and RFC 7009 S2.1.
   */
  private async validateClientAuth(body: Record<string, any>, authHeader?: string): Promise<void> {
    let clientId: string | undefined;
    let clientSecret: string | undefined;

    if (authHeader?.startsWith('Basic ')) {
      const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf-8');
      const colonIdx = decoded.indexOf(':');
      clientId = decoded.substring(0, colonIdx);
      clientSecret = decoded.substring(colonIdx + 1);
    } else if (body.client_id && body.client_secret) {
      clientId = body.client_id;
      clientSecret = body.client_secret;
    }

    if (!clientId || !clientSecret) {
      throw new UnauthorizedException({
        error: 'invalid_client',
        error_description: 'Client authentication required (Basic auth or client_id/client_secret in body)',
      });
    }

    const prisma = db.getClient();
    const app = await prisma.application.findUnique({
      where: { clientId },
      select: { clientSecretHash: true, status: true },
    });

    if (!app || app.status !== 'ACTIVE' || !app.clientSecretHash) {
      throw new UnauthorizedException({ error: 'invalid_client', error_description: 'Unknown client' });
    }

    const valid = await bcrypt.compare(clientSecret, app.clientSecretHash);
    if (!valid) {
      throw new UnauthorizedException({ error: 'invalid_client', error_description: 'Invalid client credentials' });
    }
  }

  // ─── Private: Redirect URI Validation ───────────────────

  /**
   * Redirect-URI validation has been extracted to
   * `apps/admin-api/src/utils/redirect-uri.util.ts` so other endpoints
   * (logout, future consent flow) can reuse the same allowlist semantics.
   */

  // ─── Private: Scope Resolution ───────────────────────────

  private resolveScopes(requestedScope: string | undefined, appScopes: string[]): string {
    if (!appScopes || appScopes.length === 0) {
      throw new BadRequestException({
        error: 'invalid_scope',
        error_description: 'Application has no scopes configured. Configure FHIR platform scopes in the admin portal.',
      });
    }

    if (!requestedScope) {
      return [...appScopes].sort().join(' ');
    }

    const requested = requestedScope.split(/\s+/).filter(Boolean);
    const appScopeSet = new Set(appScopes);
    const unauthorized = requested.filter((s) => !appScopeSet.has(s));

    if (unauthorized.length > 0) {
      throw new BadRequestException({
        error: 'invalid_scope',
        error_description: `Requested scope(s) not granted to this application: ${unauthorized.join(', ')}`,
      });
    }

    return requested.sort().join(' ');
  }
}

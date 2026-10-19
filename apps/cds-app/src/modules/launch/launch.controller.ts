import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Req,
  Res,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { compactDecrypt, importJWK, createLocalJWKSet, jwtVerify } from 'jose';
import { logger } from '@hs/observability';
import { secrets } from '@hs/infra';
import { SessionService, type LaunchMode } from '../../services/session.service';
import { COOKIE_NAME } from '../../guards/session.guard';
import { computeProviderCapabilities } from '../../services/provider-role';

const PLATFORM_JWKS_SECRET = 'HS_PLATFORM_JWKS';
const COOKIE_MAX_AGE = 8 * 60 * 60 * 1000; // 8 hours

/** Narrow JWK shape — fields we read when picking signing/encryption keys. */
interface JwkKey {
  kty: string;
  use?: string;
  alg?: string;
  kid?: string;
  d?: string;
  [key: string]: unknown;
}

interface FhirContextEntry {
  reference?: string;
  type?: string;
  role?: string;
}

interface LaunchTokenPayload {
  sessionId: string;
  applicationId?: string;
  ehrName?: string;
  siteId?: string;
  patient?: string;
  encounter?: string;
  scope?: string;
  launchMode?: 'ehr' | 'standalone';
  providerFhirId?: string;
  providerName?: string;
  providerNpi?: string;
  providerSpecialty?: string;
  /** Canonical EndUser id resolved by admin-api during bridge SMART launch. Phase C. */
  endUserId?: string;
  fhirContext?: FhirContextEntry[];
  [key: string]: unknown;
}

/** System-mode CDS provider JWT payload — fields cds-app reads. */
interface SystemTokenPayload {
  applicationId?: string;
  ehrName?: string;
  siteId?: string;
  providerFhirId?: string;
  firstName?: string;
  lastName?: string;
  npi?: string;
  sub?: string;
  token_type?: string;
  [key: string]: unknown;
}

@ApiTags('Launch')
@Controller('launch')
export class LaunchController {
  constructor(
    private readonly config: ConfigService,
    private readonly sessionService: SessionService,
  ) {}

  // ── Mode 1 + 2: EHR / Standalone SMART Launch ──────────────

  @Get()
  @ApiOperation({ summary: 'CDS SMART launch entry point (EHR + standalone)' })
  @ApiQuery({ name: 'launch_token', required: true })
  @ApiResponse({ status: 302, description: 'Sets session cookie and redirects to CDS frontend' })
  async launch(@Query('launch_token') launchToken: string, @Req() req: Request, @Res() res: Response) {
    if (!launchToken) throw new BadRequestException('launch_token query parameter is required');

    const payload = await this.decryptLaunchToken(launchToken);
    if (!payload.sessionId) throw new BadRequestException('No sessionId in launch token');

    const applicationId = payload.applicationId || '';
    const ehrName = payload.ehrName || 'unknown';
    const launchMode: LaunchMode = payload.launchMode || (payload.patient ? 'ehr' : 'standalone');

    logger.info('CDS launch: JWE decrypted', {
      bridgeSessionId: payload.sessionId,
      applicationId,
      launchMode,
      hasPatient: !!payload.patient,
      hasEncounter: !!payload.encounter,
    });

    // Default role to 'support' — closed by default. The role is hydrated
    // lazily on the FE's first /clinical-data/practitioner call (which
    // happens on every layout mount), where cds-app derives the role from
    // FHIR Practitioner.qualification and writes it back to the Redis
    // session. Keeping launch off the role-derivation critical path keeps
    // it fast and tolerant of bridge slowness.
    const providerRole = 'support';
    const providerCapabilities = computeProviderCapabilities(providerRole);

    // Always create a fresh session on launch (prevents mode fixation).
    // Store bridgeSessionId at the provider session level so FHIR calls work
    // even before a patient is selected (e.g., standalone patient search).
    const providerSession = await this.sessionService.createProviderSession({
      applicationId,
      ehrName,
      siteId: payload.siteId,
      launchMode,
      bridgeSessionId: payload.sessionId,
      providerFhirId: payload.providerFhirId,
      providerName: payload.providerName,
      providerNpi: payload.providerNpi,
      providerSpecialty: payload.providerSpecialty,
      endUserId: payload.endUserId,
      providerRole,
      providerCapabilities,
    });
    const providerSessionId = providerSession.providerSessionId;

    logger.info('CDS provider session created', { providerSessionId, launchMode });

    // Set patient context if patient is available (EHR launch)
    if (payload.patient) {
      await this.sessionService.setPatientContext(providerSessionId, {
        bridgeSessionId: payload.sessionId,
        patientId: payload.patient,
        encounterId: payload.encounter,
        scope: payload.scope,
      });
    }

    this.setCookie(res, providerSessionId);

    // Redirect based on launch mode:
    // EHR launch (has encounter) → clinical view directly
    // Standalone (has patient but no encounter) → context picker (appointment → encounter)
    // No patient → patient search
    const frontendUrl = this.config.get<string>('app.cdsFrontendUrl');
    let redirectPath: string;
    if (payload.patient && payload.encounter) {
      // EHR launch — encounter already scoped, go straight to clinical view
      redirectPath = `/app/patient/${payload.patient}`;
    } else if (payload.patient) {
      // Standalone — patient known but no encounter, let user pick appointment/encounter
      redirectPath = `/app/patient/${payload.patient}/select-context`;
    } else {
      // System / no patient — search first
      redirectPath = '/app/patient-search';
    }

    return res.redirect(`${frontendUrl}${redirectPath}`);
  }

  // ── Mode 2: Standalone entry point ─────────────────────────

  @Get('standalone/:ehrName')
  @ApiOperation({ summary: 'Initiate standalone SMART launch (redirects to bridge → EHR)' })
  async standaloneEntry(@Req() req: Request, @Res() res: Response) {
    const ehrName = (req.params as Record<string, string | undefined>).ehrName;
    if (!ehrName) throw new BadRequestException('ehrName is required');

    const applicationId = this.config.get<string>('app.cdsClientId');
    const bridgeApiUrl = this.config.get<string>('app.bridgeApiUrl');

    // Accept iss from query, or look up the configured baseUrl for this EHR integration
    let iss = (req.query as Record<string, string | undefined>).iss;
    if (!iss) {
      // Resolve ISS from admin-api's configured integration. Prefer a
      // dedicated `provider-standalone` config; fall back to `provider-ehr`
      // only when no standalone config exists. The two types may carry
      // different `baseUrl` overrides (e.g. a sandbox vs. provider-launch
      // tenant), and the standalone flow should always use the standalone
      // config when one is configured.
      try {
        const { cdsAdminClient } = await import('../../services/admin-client.service');
        const integrations = await cdsAdminClient.listIntegrations(applicationId!);
        const ehrIntegrations = integrations.filter((i) => i.ehrName === ehrName);
        const integration =
          ehrIntegrations.find((i) => i.ehrAppType === 'provider-standalone') ??
          ehrIntegrations.find((i) => i.ehrAppType === 'provider-ehr');
        const config = integration?.ehrConfig as { baseUrl?: string } | undefined;
        // Use the single-value baseUrl override, or fall back to catalog default
        if (config?.baseUrl) {
          iss = config.baseUrl;
        }
      } catch (err: unknown) {
        logger.warn('Failed to resolve ISS from admin config', {
          ehrName,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Build redirect: bridge SMART launch without `launch` param → standalone mode
    const url = new URL(`${bridgeApiUrl}/v1/smart/launch/${applicationId}/${ehrName}`);
    if (iss) url.searchParams.set('iss', iss);

    logger.info('CDS standalone launch initiated', { applicationId, ehrName, iss: iss || 'not-resolved' });
    return res.redirect(url.toString());
  }

  // ── Mode 3: System/Platform Launch ─────────────────────────

  @Post('system')
  @ApiOperation({ summary: 'System mode launch — accepts CDS provider JWT from OTP auth' })
  @ApiResponse({ status: 200, description: 'Session created, returns redirect URL' })
  async systemLaunch(@Body() body: { token: string }, @Res() res: Response) {
    if (!body.token) throw new BadRequestException('token is required');

    // Verify JWT using platform JWKS
    const payload = await this.verifySystemToken(body.token);

    // Validate applicationId matches this CDS app (strict — reject missing too)
    const expectedAppId = this.config.get<string>('app.cdsClientId');
    if (!payload.applicationId || payload.applicationId !== expectedAppId) {
      throw new UnauthorizedException('Token was not issued for this application');
    }

    const providerSession = await this.sessionService.createProviderSession({
      applicationId: payload.applicationId || expectedAppId || '',
      ehrName: payload.ehrName || 'system',
      siteId: payload.siteId,
      launchMode: 'system',
      linkedSiteId: payload.siteId,
      providerFhirId: payload.providerFhirId,
      providerName: `${payload.firstName} ${payload.lastName}`.trim(),
      providerNpi: payload.npi,
      // System mode = trusted machine-to-machine. The integrating system is
      // already authorized at the JWT/JWKS layer; granting sign-off
      // authority matches how other clinical writes behave for system-mode
      // tokens.
      providerRole: 'system',
      providerCapabilities: computeProviderCapabilities('system'),
    });

    logger.info('CDS system launch', {
      providerSessionId: providerSession.providerSessionId,
      providerId: payload.sub,
      siteId: payload.siteId,
    });

    this.setCookie(res, providerSession.providerSessionId);

    const frontendUrl = this.config.get<string>('app.cdsFrontendUrl');
    return res.json({ redirectUrl: `${frontendUrl}/app/patient-search` });
  }

  // ── Shared helpers ─────────────────────────────────────────

  private setCookie(res: Response, providerSessionId: string): void {
    const isProd = this.config.get('app.nodeEnv') === 'production';
    res.cookie(COOKIE_NAME, providerSessionId, {
      httpOnly: true,
      // SameSite: None requires Secure: true
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      path: '/',
      maxAge: COOKIE_MAX_AGE,
    });
  }

  private async verifySystemToken(token: string): Promise<SystemTokenPayload> {
    const jwks = await secrets.getSecretValue<{ keys: JwkKey[] }>(PLATFORM_JWKS_SECRET);
    if (!jwks?.keys?.length) throw new UnauthorizedException('Platform JWKS not configured');

    const oauthIssuer = this.config.get<string>('app.oauthIssuer');
    const jwkSet = createLocalJWKSet(jwks);

    try {
      const { payload } = await jwtVerify(token, jwkSet, {
        issuer: oauthIssuer,
        audience: `${oauthIssuer}/cds`,
      });

      if (payload.token_type !== 'cds_provider') {
        throw new UnauthorizedException('Invalid token type');
      }

      return payload as SystemTokenPayload;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const code = (err as { code?: string } | null)?.code;
      logger.warn('System token verification failed', { error: message, code });
      throw new UnauthorizedException('Invalid or expired system token');
    }
  }

  private async decryptLaunchToken(jwe: string): Promise<LaunchTokenPayload> {
    const [headerB64] = jwe.split('.');
    let headerAlg: string | undefined;
    let headerKid: string | undefined;
    try {
      const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString());
      headerAlg = header.alg;
      headerKid = header.kid;
    } catch {
      /* will fail below */
    }

    // Asymmetric: kid match in platform JWKS
    if (headerAlg && headerAlg !== 'dir') {
      try {
        const jwks = await secrets.getSecretValue<{ keys: JwkKey[] }>(PLATFORM_JWKS_SECRET);
        if (jwks?.keys?.length) {
          const privateKey =
            (headerKid && jwks.keys.find((k) => k.kid === headerKid && k.d)) ||
            jwks.keys.find((k) => k.use === 'enc' && k.alg === headerAlg && k.d) ||
            jwks.keys.find((k) => k.use === 'enc' && k.d);

          if (privateKey) {
            const key = await importJWK(privateKey, headerAlg);
            const { plaintext } = await compactDecrypt(jwe, key);
            return JSON.parse(new TextDecoder().decode(plaintext)) as LaunchTokenPayload;
          }
        }
      } catch (err: unknown) {
        logger.warn('JWE asymmetric decryption failed', {
          error: err instanceof Error ? err.message : String(err),
          kid: headerKid,
          alg: headerAlg,
        });
      }
    }

    // Symmetric fallback: dir + A256GCM
    if (headerAlg === 'dir') {
      const clientSecret = this.config.get<string>('app.cdsClientSecret');
      if (clientSecret) {
        try {
          const secretBytes = new TextEncoder().encode(clientSecret);
          const keyBytes = await crypto.subtle.digest('SHA-256', secretBytes);
          const jwk = { kty: 'oct' as const, k: Buffer.from(keyBytes).toString('base64url') };
          const key = await importJWK(jwk, 'dir');
          const { plaintext } = await compactDecrypt(jwe, key);
          return JSON.parse(new TextDecoder().decode(plaintext)) as LaunchTokenPayload;
        } catch (err: unknown) {
          logger.warn('JWE symmetric decryption failed', {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    throw new BadRequestException('Invalid or expired launch token — decryption failed');
  }
}

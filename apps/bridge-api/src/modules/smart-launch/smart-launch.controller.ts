import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  Headers,
  Res,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam, ApiHeader } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import * as bcrypt from 'bcrypt';
import { jwtVerify, createLocalJWKSet } from 'jose';
import { logger } from '@hs/observability';
import {
  resolveEhrFromIss,
  resolveEndpoints,
  resolveCredentials,
  getEhrDefinition,
  isProdDeployment,
} from '@hs/config';
import { secrets } from '@hs/infra';
import { Public } from '../auth/decorators/public.decorator';
import { smartLaunchService } from './smart-launch.service';
import { adminClient } from '../../services/admin-client.service';
import type { SmartLaunchConfig } from './smart-launch.service';

const BRIDGE_API_URL = process.env.BRIDGE_API_URL || 'http://localhost:3000/api';

@ApiTags('SMART Launch')
@Throttle({ default: { limit: 30, ttl: 60000 } })
@Controller('v1/smart')
export class SmartLaunchController {
  // ─── Step 1: EHR Fires Launch ────────────────────────────

  @Get('launch/:applicationId/:ehrName')
  @Public()
  @ApiOperation({
    summary: 'SMART on FHIR launch entry point',
    description:
      'EHR calls this URL when user launches the app. ehrName in the path identifies the EHR vendor (works with custom-hosted EHRs). Redirects to EHR authorization endpoint with PKCE.',
  })
  @ApiParam({ name: 'applicationId', description: 'Application UUID (registered in admin portal)' })
  @ApiParam({ name: 'ehrName', description: 'EHR vendor name (e.g., epic, cerner, athenanet)' })
  @ApiQuery({ name: 'iss', required: true, description: 'FHIR server base URL (provided by EHR)' })
  @ApiQuery({ name: 'launch', required: false, description: 'Opaque launch context token (EHR launch only)' })
  @ApiResponse({ status: 302, description: 'Redirects to EHR authorization endpoint' })
  @ApiResponse({ status: 400, description: 'Missing or invalid configuration' })
  async launch(
    @Param('applicationId') applicationId: string,
    @Param('ehrName') ehrName: string,
    @Query('iss') iss: string,
    @Query('launch') launch: string | undefined,
    @Res() res: Response,
  ) {
    if (!iss) {
      throw new BadRequestException('iss query parameter is required');
    }

    // 1. Load Application via admin-api — accept either UUID or clientId
    const isUuid = /^[0-9a-f]{8}-/.test(applicationId);
    const app = isUuid
      ? await adminClient.getApplication(applicationId)
      : await adminClient.getApplicationByClientId(applicationId);
    if (!app) throw new BadRequestException('Application not found or not active');

    // Use the resolved UUID for all subsequent lookups
    const appId = app.id;

    // 3. Load AppEhrAccess with sites — prefer the right appType for the launch mode.
    //    EHR launch (has launch param) → prefer provider-ehr
    //    Standalone (no launch param) → prefer provider-standalone, fall back to provider-ehr
    const tryIntegration = async (...appTypes: (string | undefined)[]) => {
      for (const at of appTypes) {
        try {
          return await adminClient.getIntegration(appId, ehrName, at);
        } catch {
          /* try next */
        }
      }
      return null;
    };
    const ehrAccess = launch
      ? await tryIntegration('provider-ehr', undefined)
      : await tryIntegration('provider-standalone', 'provider-ehr', undefined);
    if (!ehrAccess) throw new BadRequestException(`EHR "${ehrName}" is not configured for this application`);

    const config = ehrAccess.ehrConfig as Record<string, any>;
    const appType = config.appType || (launch ? 'provider-ehr' : 'provider-standalone');
    const isProd = isProdDeployment();
    const creds = resolveCredentials(config);

    // 3b. Resolve site from ISS — match or auto-create pending
    let issUrl: URL;
    try {
      issUrl = new URL(iss);
    } catch {
      throw new BadRequestException('Invalid ISS URL format');
    }

    let resolvedSite = this.resolveSiteFromIss(iss, ehrName, ehrAccess.sites);
    if (!resolvedSite) {
      // Only auto-create if ISS matches the resolved EHR vendor's domain (prevent spam)
      const ehrFromIss = resolveEhrFromIss(iss);
      if (!ehrFromIss || ehrFromIss !== ehrName) {
        throw new BadRequestException(`ISS hostname does not match EHR vendor ${ehrName}`);
      }

      // Rate limit: max 5 pending sites per app to prevent abuse
      const pendingSites = ehrAccess.sites.filter((s: any) => !s.isApproved);
      if (pendingSites.length >= 5) {
        throw new BadRequestException('Too many pending site approvals. Contact your administrator.');
      }

      // Auto-create unapproved site via admin-api (microservice boundary)
      // Extract vendor-specific identifiers from the ISS URL
      const siteName = issUrl.hostname;
      const siteIdentifiers = this.extractIdentifiersFromIss(iss, ehrName);
      try {
        resolvedSite = await adminClient.createSite(appId, ehrName, {
          name: siteName,
          siteIdentifiers,
          isApproved: false,
        });
      } catch (createErr: any) {
        logger.error('Failed to auto-create site via admin-api', createErr, { appId, ehrName, iss });
        throw new BadRequestException('Unable to register new practice. Please contact your administrator.');
      }
      throw new BadRequestException(
        `New practice "${siteName}" detected from SMART launch. It has been queued for admin approval.`,
      );
    }
    if (!resolvedSite.isApproved) {
      throw new BadRequestException(
        `Practice "${resolvedSite.name}" is pending admin approval. Contact your administrator to approve it.`,
      );
    }
    if (!resolvedSite.isActive) {
      throw new BadRequestException(
        `Practice "${resolvedSite.name}" is deactivated. Contact your administrator to reactivate it.`,
      );
    }

    // 3c. Validate launchUrl (after site check so approval errors take priority)
    const launchUrl = config.launchUrl || app.smartLaunchUrl;
    if (!launchUrl)
      throw new BadRequestException('Application Launch URL not configured. Set it in the EHR integration settings.');

    // 4. Discover authorize/token URLs from ISS, use ISS as FHIR base URL
    const baseUrl = iss;
    let authorizeUrl: string;
    let tokenUrl: string;

    try {
      const discovered = await smartLaunchService.discoverSmartConfig(iss);
      authorizeUrl = discovered.authorizeUrl;
      tokenUrl = discovered.tokenUrl;
    } catch (discoveryErr: any) {
      // Fall back to configured endpoints if discovery fails (pick deployment-env side of catalog).
      logger.warn('SMART discovery failed, falling back to configured endpoints', { iss, error: discoveryErr.message });
      const endpoints = resolveEndpoints(ehrName, appType, config);
      const envSuffix = isProd ? 'Prod' : 'Test';
      authorizeUrl = endpoints[`authorizeUrl${envSuffix}`] || endpoints.authorizeUrlTest || '';
      tokenUrl = endpoints[`authUrl${envSuffix}`] || endpoints.authUrlTest || '';
    }

    if (!authorizeUrl) throw new BadRequestException(`Cannot discover authorize URL for ${ehrName} from ${iss}`);
    if (!tokenUrl) throw new BadRequestException(`Cannot discover token URL for ${ehrName} from ${iss}`);

    // 5. Load JWKS from Secrets Manager if JWT assertion vendor
    let clientSecret: any = creds.clientSecret;
    const definition = getEhrDefinition(ehrName);
    const hasJwkField = definition?.fields?.some((f: any) => f.type === 'jwk');
    if (hasJwkField) {
      const safeAppId = appId.replace(/-/g, '_').toUpperCase();
      const safeEhrName = ehrName.replace(/-/g, '_').toUpperCase();
      try {
        const jwks = await secrets.getSecretValue<{ keys: any[] }>(`EHR_JWKS__${safeAppId}__${safeEhrName}`);
        if (jwks?.keys?.length > 0) clientSecret = jwks;
      } catch {
        throw new BadRequestException(`JWK private key not configured for ${ehrName}. Upload it via the admin portal.`);
      }
    }

    // 6. Build scope — ensure correct launch scope for the mode.
    // EHR launch: needs `launch` scope (Cerner requires the opaque launch code alongside it).
    // Standalone: needs `launch/patient` scope; MUST NOT include bare `launch` (Cerner rejects it without a code).
    let scopeParts = ehrAccess.ehrTokenScopes.filter((s: string) => s !== 'launch' && !s.startsWith('launch/'));
    if (launch) {
      scopeParts.unshift('launch');
    } else {
      scopeParts.unshift('launch/patient');
    }
    let scope = scopeParts.join(' ');

    // 7. Build redirect_uri (bridge-api's own callback, not from config)
    const redirectUri = `${BRIDGE_API_URL}/v1/smart/callback/${appId}/${ehrName}`;

    // URL overrides from config (single-value `*Url` keys per deployment env)
    const urlOverrides: Record<string, string> = {};
    for (const key of Object.keys(config)) {
      if (key.match(/Url$/) && config[key]) urlOverrides[key] = config[key];
    }

    // Build flat siteData for session storage (used by interceptor for FHIR calls).
    // `resolvedBaseUrl: iss` pins the FHIR base URL to the SMART launch ISS —
    // this is the authorized endpoint for the access token that Cerner issued.
    // Without this, downstream FHIR calls may fall back to catalog defaults that
    // point at a different Cerner server, causing `unknown_kid` 401s.
    const siteIdentifiers = (resolvedSite.siteIdentifiers as Record<string, any>) || {};
    const siteData = {
      integrationId: ehrAccess.id,
      siteId: resolvedSite.id,
      organizationId: app.organizationId,
      ehrName,
      appType,
      ehrTokenScopes: ehrAccess.ehrTokenScopes,
      ...config,
      ...siteIdentifiers,
      resolvedBaseUrl: iss,
    };

    const launchConfig: SmartLaunchConfig = {
      ehrName,
      appType,
      clientId: creds.clientId,
      clientSecret,
      scope,
      redirectUri,
      launchUrl,
      tenant: siteIdentifiers.tenant || config.tenant,
      accountId: siteIdentifiers.accountId || config.accountId,
      siteId: resolvedSite.id,
      authorizeUrl,
      tokenUrl,
      resolvedBaseUrl: baseUrl || iss,
      // Extra metadata for callback
      applicationId: appId,
      integrationId: ehrAccess.id,
      clientType: app.clientType,
      jwks: app.jwks as any, // App's public JWKS for asymmetric JWE (if configured)
      siteData,
      ...urlOverrides,
    };

    const redirectUrl = await smartLaunchService.buildAuthorizeRedirect(launchConfig, launch);

    logger.info('SMART launch redirect', { appId, ehrName, appType, hasLaunchToken: !!launch });
    return res.redirect(redirectUrl);
  }

  // ─── Step 2: EHR Callback ───────────────────────────────

  @Get('callback/:applicationId/:ehrName')
  @Public()
  @ApiOperation({
    summary: 'SMART on FHIR OAuth callback',
    description:
      'EHR redirects here after user authorization. Exchanges code for token, then redirects to the configured launch URL with JWE or session token.',
  })
  @ApiParam({ name: 'applicationId', description: 'Application UUID' })
  @ApiParam({ name: 'ehrName', description: 'EHR vendor name' })
  @ApiQuery({ name: 'code', required: true, description: 'Authorization code from EHR' })
  @ApiQuery({ name: 'state', required: true, description: 'State parameter for CSRF protection' })
  @ApiResponse({ status: 302, description: 'Redirects to launch URL' })
  async callback(
    @Param('applicationId') applicationId: string,
    @Param('ehrName') _ehrName: string,
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    if (!code || !state) {
      throw new BadRequestException('code and state query parameters are required');
    }

    try {
      const { redirectUrl } = await smartLaunchService.handleCallback(code, state, applicationId);
      logger.info('SMART callback successful', { applicationId });
      return res.redirect(redirectUrl);
    } catch (error: any) {
      logger.error('SMART callback failed', error, { applicationId });
      throw new BadRequestException(error.message || 'SMART callback failed');
    }
  }

  // ─── Step 3a: Confidential App Exchanges Code ───────────

  @Post('token')
  @Public()
  @ApiOperation({
    summary: 'Exchange SMART launch code for token (RFC 6749 compliant)',
    description:
      'Confidential clients authenticate via Basic auth or JWT assertion. Public clients send client_id only. Body: grant_type=authorization_code&code={launch_code}',
  })
  @ApiHeader({ name: 'authorization', required: false, description: 'Basic auth: base64(client_id:client_secret)' })
  @ApiHeader({
    name: 'content-type',
    required: true,
    description: 'application/x-www-form-urlencoded or application/json',
  })
  @ApiResponse({ status: 200, description: 'Token response with SMART context' })
  @ApiResponse({ status: 401, description: 'Invalid client credentials' })
  async exchangeToken(@Body() body: any, @Headers('authorization') authHeader?: string) {
    const grantType = body.grant_type || body.grantType;
    const code = body.code;

    if (grantType !== 'authorization_code') {
      throw new BadRequestException('grant_type must be authorization_code');
    }
    if (!code) {
      throw new BadRequestException('code is required');
    }

    // Authenticate the client and verify grant type is allowed
    const { clientId, app } = await this.authenticateClientWithApp(body, authHeader);

    if (!app.allowedGrantTypes?.includes('authorization_code')) {
      throw new BadRequestException({
        error: 'unauthorized_client',
        error_description: 'This client is not authorized for the authorization_code grant type',
      });
    }

    try {
      return await smartLaunchService.exchangeLaunchCode(code, clientId);
    } catch (error: any) {
      logger.error('SMART token exchange failed', error);
      throw new BadRequestException(error.message || 'Invalid or expired launch code');
    }
  }

  // ─── Step 3b: Public App Fetches Session ─────────────────

  @Post('session')
  @Public()
  @ApiOperation({
    summary: 'Exchange SMART session token for context (public apps)',
    description:
      'Public apps (no backend secret) exchange the opaque session token received in the launch URL for the full token + SMART context.',
  })
  @ApiResponse({ status: 200, description: 'Token response with SMART context' })
  @ApiResponse({ status: 401, description: 'Invalid client_id or session' })
  async fetchSession(@Body() body: { client_id?: string; session?: string }) {
    if (!body.client_id || !body.session) {
      throw new BadRequestException('client_id and session are required');
    }

    // Validate client_id exists and is PUBLIC type
    const app = await adminClient.getApplicationByClientId(body.client_id);

    if (!app || app.status !== 'ACTIVE') {
      throw new UnauthorizedException({ error: 'invalid_client', error_description: 'Unknown client' });
    }
    if (app.clientType !== 'PUBLIC') {
      throw new BadRequestException(
        'This endpoint is for PUBLIC clients only. Confidential clients must use POST /v1/smart/token',
      );
    }

    try {
      return await smartLaunchService.exchangeSessionToken(body.session, app.id);
    } catch (error: any) {
      logger.error('SMART session exchange failed', error);
      throw new BadRequestException(error.message || 'Invalid or expired session');
    }
  }

  // ─── Private: Client Authentication ──────────────────────

  private async authenticateClientWithApp(body: any, authHeader?: string): Promise<{ clientId: string; app: any }> {
    let clientId: string | undefined;
    let clientSecret: string | undefined;

    // Basic auth header
    if (authHeader?.startsWith('Basic ')) {
      const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf-8');
      const colonIdx = decoded.indexOf(':');
      clientId = decoded.substring(0, colonIdx);
      clientSecret = decoded.substring(colonIdx + 1);
    }
    // Post body
    else if (body.client_id) {
      clientId = body.client_id;
      clientSecret = body.client_secret;
    }

    if (!clientId) {
      throw new UnauthorizedException({ error: 'invalid_client', error_description: 'client_id is required' });
    }

    const app = await adminClient.getApplicationByClientId(clientId);

    if (!app || app.status !== 'ACTIVE') {
      throw new UnauthorizedException({ error: 'invalid_client', error_description: 'Unknown client' });
    }

    // PUBLIC clients: no secret required, just verify client_id exists
    if (app.clientType === 'PUBLIC') {
      return { clientId, app };
    }

    // CONFIDENTIAL clients: verify secret or JWT assertion
    // Check JWT assertion first
    if (
      body.client_assertion_type === 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer' &&
      body.client_assertion
    ) {
      const jwks = app.jwks as any;
      if (!jwks?.keys?.length) {
        throw new UnauthorizedException({
          error: 'invalid_client',
          error_description: 'Client has no JWKS configured',
        });
      }
      try {
        // Selects key by `kid` so clients that rotate without removing the old key still verify.
        const keySet = createLocalJWKSet(jwks);
        await jwtVerify(body.client_assertion, keySet, { issuer: clientId, subject: clientId });
        return { clientId, app };
      } catch {
        throw new UnauthorizedException({
          error: 'invalid_client',
          error_description: 'JWT assertion verification failed',
        });
      }
    }

    // Check client_secret
    if (!clientSecret || !app.clientSecretHash) {
      throw new UnauthorizedException({ error: 'invalid_client', error_description: 'Client authentication required' });
    }

    const valid = await bcrypt.compare(clientSecret, app.clientSecretHash);
    if (!valid) {
      throw new UnauthorizedException({ error: 'invalid_client', error_description: 'Invalid client credentials' });
    }

    return { clientId, app };
  }

  /**
   * Resolve a site from ISS by matching against configured site identifiers.
   * Tries: exact ISS match, hostname match, tenant/accountId in ISS path.
   */
  private resolveSiteFromIss(iss: string, ehrName: string, sites: any[]): any | null {
    if (!sites?.length) return null;

    let issUrl: URL;
    try {
      issUrl = new URL(iss);
    } catch {
      return null;
    }
    const issHostname = issUrl.hostname;
    const issPathSegments = issUrl.pathname.split('/').filter(Boolean);

    for (const site of sites) {
      const identifiers = (site.siteIdentifiers as Record<string, any>) || {};

      // Match by tenant as a path segment or subdomain (minimum 3 chars to prevent false positives)
      if (identifiers.tenant && identifiers.tenant.length >= 3) {
        if (issPathSegments.includes(identifiers.tenant)) return site;
        if (issHostname.split('.').includes(identifiers.tenant)) return site;
      }

      // Match by accountId as a path segment (minimum 3 chars)
      if (identifiers.accountId && identifiers.accountId.length >= 3) {
        if (issPathSegments.includes(identifiers.accountId)) return site;
      }
    }

    // No identifier match found — return null so the caller can auto-create
    // (Don't fall back to default site — ISS must explicitly match a site's identifiers)
    return null;
  }

  /**
   * Extract vendor-specific identifiers from the ISS URL.
   * e.g., Cerner ISS: https://fhir-ehr-code.cerner.com/r4/ec2458f2-... → tenant = ec2458f2-...
   *        AthenaNet ISS: https://api.platform.athenahealth.com/fhir/r4 → no tenant (just ISS)
   */
  private extractIdentifiersFromIss(iss: string, ehrName: string): Record<string, any> {
    const identifiers: Record<string, any> = {};

    try {
      const url = new URL(iss);
      const pathSegments = url.pathname.split('/').filter(Boolean);

      switch (ehrName) {
        case 'cerner':
          // Cerner ISS: /r4/{tenant} — tenant is the UUID after /r4/
          const r4Index = pathSegments.indexOf('r4');
          if (r4Index >= 0 && pathSegments[r4Index + 1]) {
            identifiers.tenant = pathSegments[r4Index + 1];
          }
          break;
        case 'athenanet':
          // AthenaNet ISS: /fhir/r4 or /v1/{accountId}
          const v1Index = pathSegments.indexOf('v1');
          if (v1Index >= 0 && pathSegments[v1Index + 1]) {
            identifiers.accountId = pathSegments[v1Index + 1];
          }
          break;
        case 'eclinicalworks':
          // eCW ISS: /fhir/r4/{tenant}
          const fhirIdx = pathSegments.indexOf('r4');
          if (fhirIdx >= 0 && pathSegments[fhirIdx + 1]) {
            identifiers.tenant = pathSegments[fhirIdx + 1];
          }
          break;
      }
    } catch {
      /* keep just the ISS if parsing fails */
    }

    return identifiers;
  }
}

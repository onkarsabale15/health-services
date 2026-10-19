import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { secrets } from '@hs/infra';
import { cache } from '@hs/infra';
import { logger } from '@hs/observability';
import { getEhrDefinition } from '@hs/config';
import type { SiteData } from '@hs/ehr-data-service';
import { adminClient } from '../../../services/admin-client.service';

/**
 * Resolves integration context from explicit headers:
 * - X-Session-Id → SMART launched app, loads session from Redis
 * - X-Site-Id → system app, loads site from admin-api
 *
 * Two separate headers avoids unnecessary Redis/HTTP fallback calls.
 */
@Injectable()
export class IntegrationDataInterceptor implements NestInterceptor {
  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();

    const sessionId = request.headers['x-session-id'];
    const siteId = request.headers['x-site-id'];

    if (sessionId) {
      // SMART session flow — direct Redis lookup, no fallback
      const session = await cache.get<any>(`smart:launch:${sessionId}`);
      if (!session) {
        logger.warn('SMART session not found in Redis', { sessionId, url: request.url });
        throw new UnauthorizedException('SMART session expired or invalid');
      }

      const user = request.user;
      if (
        user?.organizationId &&
        session.siteData?.organizationId &&
        user.organizationId !== session.siteData.organizationId
      ) {
        throw new UnauthorizedException('Session does not belong to your organization');
      }

      // Diagnostic: log session + token info on every FHIR request (helps debug stale-token issues)
      const tokenAgeMs = session.createdAt ? Date.now() - session.createdAt : -1;
      const tokenAgeSec = Math.floor(tokenAgeMs / 1000);
      const timeToExpirySec = session.expiresIn - tokenAgeSec;
      logger.info('SMART session loaded for FHIR call', {
        sessionId,
        ehrName: session.ehrName,
        url: request.url,
        tokenPrefix: session.accessToken?.slice(0, 16),
        tokenSuffix: session.accessToken?.slice(-8),
        tokenLength: session.accessToken?.length ?? 0,
        tokenAgeSec,
        expiresInSec: session.expiresIn,
        timeToExpirySec,
        expired: timeToExpirySec < 0,
        hasRefreshToken: !!session.refreshToken,
      });

      request.siteData = {
        ...session.siteData,
        _sessionId: sessionId,
        _sessionToken: session.accessToken,
        _sessionRefreshToken: session.refreshToken,
        _tokenUrl: session.tokenUrl,
      };

      request.smartContext = {
        patient: session.patient,
        encounter: session.encounter,
        fhirContext: session.fhirContext,
        scope: session.scope,
      };

      return next.handle();
    }

    if (siteId) {
      // System app flow — direct admin-api lookup, no fallback
      const siteData = await this.loadSiteData(siteId, request.user);
      request.siteData = siteData;
      return next.handle();
    }

    throw new BadRequestException('X-Session-Id or X-Site-Id header is required');
  }

  private async loadSiteData(siteId: string, user: any): Promise<SiteData> {
    // Load pre-merged flat siteData from admin-api
    const siteData = await adminClient.getSite(siteId);

    if (!siteData) {
      throw new UnauthorizedException('Site not found or not active');
    }

    // Org boundary check: verify the site belongs to the authenticated user's org
    if (user?.organizationId && siteData.organizationId && user.organizationId !== siteData.organizationId) {
      throw new UnauthorizedException('Site does not belong to your organization');
    }

    // Load JWKS for JWT-assertion vendors (reads from secrets, not DB)
    const definition = getEhrDefinition(siteData.ehrName);
    const hasJwkField = definition?.fields?.some((f: any) => f.type === 'jwk');
    if (hasJwkField) {
      const jwks = await this.loadJwks(siteData.applicationId || siteData.integrationId, siteData.ehrName);
      if (jwks) {
        siteData.jwks = jwks;
      }
    }

    logger.debug('SiteData resolved', {
      siteId: siteData.siteId,
      integrationId: siteData.integrationId,
      ehrName: siteData.ehrName,
      appType: siteData.appType,
      hasClientId: !!siteData.clientId,
      hasClientSecret: !!siteData.clientSecret,
    });

    return siteData;
  }

  private async loadJwks(applicationId: string, ehrName: string): Promise<any> {
    const safeAppId = applicationId.replace(/-/g, '_').toUpperCase();
    const safeEhrName = ehrName.replace(/-/g, '_').toUpperCase();
    const secretKey = `EHR_JWKS__${safeAppId}__${safeEhrName}`;

    const cacheKey = `ehr:jwks:${applicationId}:${ehrName}`;
    const cached = await cache.get<any>(cacheKey).catch(() => null);
    if (cached) return cached;

    try {
      const jwks = await secrets.getSecretValue<{ keys: any[] }>(secretKey);
      if (jwks?.keys?.length > 0) {
        await cache.set(cacheKey, jwks, 300).catch(() => {});
        return jwks;
      }
    } catch {}

    logger.warn('JWK not found for integration', { applicationId, ehrName });
    return undefined;
  }
}

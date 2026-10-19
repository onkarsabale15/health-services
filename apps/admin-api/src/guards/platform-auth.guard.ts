import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { trace } from '@hs/observability';
import { logger } from '@hs/observability';
import { verifyToken, getIssuer } from '../modules/auth/jwt.service';

/** Metadata key for @Public() decorator */
export const IS_PUBLIC_KEY = 'isPublic';

/** Metadata key for @AllowTokenTypes() decorator */
export const ALLOWED_TOKEN_TYPES_KEY = 'allowedTokenTypes';

/**
 * Unified global auth guard for admin-api.
 *
 * Replaces SessionGuard, DualAuthGuard, and InternalOrAuthGuard with a single guard.
 *
 * Token resolution order:
 * 1. Skip if @Public()
 * 2. Try session token (audience: {issuer}/admin, token_type: 'session')
 * 3. Try API token (audience: {issuer}/api, token_type: 'api')
 *    - Detects `internal: true` claim for internal services
 * 4. If @AllowTokenTypes() is set, reject if token type doesn't match
 *
 * Sets a unified request.user object for all downstream consumers.
 */
@Injectable()
export class PlatformAuthGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. Check @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;
    const token = authHeader?.replace('Bearer ', '').trim();

    if (!token) throw new UnauthorizedException('Missing authorization token');

    const issuer = getIssuer();

    // 2. Try session token
    try {
      const payload = await verifyToken(token, `${issuer}/admin`);
      if (payload.token_type === 'session') {
        request.user = {
          id: payload.sub,
          email: payload.email,
          orgId: payload.org_id,
          role: payload.role,
          tokenType: 'session',
          isSessionToken: true,
          isApiToken: false,
          isInternalService: false,
        };
        trace.getActiveSpan()?.setAttributes({ 'enduser.id': payload.sub as string });
        return this.checkAllowedTokenTypes(context, 'session');
      }
    } catch {
      /* wrong audience or not a session token — try API next */
    }

    // 3. Try API token
    try {
      const payload = await verifyToken(token, `${issuer}/api`);
      if (payload.token_type === 'api') {
        const isInternal = !!payload.internal;
        request.user = {
          id: payload.sub,
          appId: payload.sub,
          orgId: payload.org_id,
          clientId: payload.client_id,
          appType: payload.app_type,
          scope: payload.scope,
          ehrAccess: payload.ehr_access,
          role: 'APP',
          tokenType: 'api',
          isSessionToken: false,
          isApiToken: true,
          isInternalService: isInternal,
        };
        trace.getActiveSpan()?.setAttributes({ 'enduser.id': payload.sub as string });
        return this.checkAllowedTokenTypes(context, 'api');
      }
    } catch {
      /* invalid or expired token */
    }

    throw new UnauthorizedException('Invalid or expired token');
  }

  /**
   * If @AllowTokenTypes('session') or @AllowTokenTypes('session', 'api') is set,
   * reject tokens that don't match. If no decorator is set, allow any authenticated token.
   */
  private checkAllowedTokenTypes(context: ExecutionContext, actualType: string): boolean {
    const allowed = this.reflector.getAllAndOverride<string[]>(ALLOWED_TOKEN_TYPES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No restriction — any valid token is accepted
    if (!allowed || allowed.length === 0) return true;

    if (!allowed.includes(actualType)) {
      throw new UnauthorizedException(`This endpoint requires a ${allowed.join(' or ')} token`);
    }

    return true;
  }
}

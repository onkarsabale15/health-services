import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { trace } from '@hs/observability';
import { verifyToken, getIssuer } from '../modules/auth/jwt.service';

/**
 * Accepts Bearer JWT tokens and distinguishes between:
 * - **Internal service tokens** (claim `internal: true`) — set by /internal/token-for-app
 * - **Session tokens** (token_type: 'session') — admin-ui users
 * - **API tokens** (token_type: 'api', no internal claim) — external client apps
 *
 * Only admin-api signs JWTs, so external apps can never forge the `internal` claim.
 *
 * request.user includes `isInternalService: true` for internal tokens, allowing
 * endpoints to skip org boundary checks for cross-org operations.
 *
 * This guard extends DualAuthGuard logic but adds `internal` claim detection.
 * If DualAuthGuard's logic changes, update the API token branch here too.
 */
@Injectable()
export class InternalOrAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;
    const token = authHeader?.replace('Bearer ', '').trim();

    if (!token) throw new UnauthorizedException('Missing authorization token');

    const issuer = getIssuer();

    // Try session token (admin-ui)
    try {
      const payload = await verifyToken(token, `${issuer}/admin`);
      if (payload.token_type === 'session') {
        request.user = {
          id: payload.sub,
          email: payload.email,
          orgId: payload.org_id,
          role: payload.role,
          isSessionToken: true,
        };
        trace.getActiveSpan()?.setAttributes({ 'enduser.id': payload.sub as string });
        return true;
      }
    } catch {
      /* wrong audience — try API token */
    }

    // Try API token
    try {
      const payload = await verifyToken(token, `${issuer}/api`);
      if (payload.token_type === 'api') {
        request.user = {
          id: payload.sub,
          appId: payload.sub,
          orgId: payload.org_id,
          clientId: payload.client_id,
          appType: payload.app_type,
          role: 'APP',
          isApiToken: true,
          isInternalService: !!payload.internal,
        };
        trace.getActiveSpan()?.setAttributes({ 'enduser.id': payload.sub as string });
        return true;
      }
    } catch {
      /* invalid or expired */
    }

    throw new UnauthorizedException('Invalid or expired token');
  }
}

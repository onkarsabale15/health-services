import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { trace } from '@hs/observability';
import { verifyToken } from '../modules/auth/jwt.service';

/**
 * Validates partner-issued end-user access tokens. Distinct from `SessionGuard`
 * (which is operator-only): an end-user session token has
 *   token_type === 'session'
 *   aud         === <client_id of the partner application>
 *   sub         === EndUser.id
 *
 * Used by the connections page (C6) and any future end-user-facing controllers.
 * Operator (admin-ui) tokens are intentionally rejected — they have a different
 * audience (`{issuer}/admin`) and `verifyToken` enforces it.
 */
@Injectable()
export class EndUserSessionGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;
    const token = authHeader?.replace('Bearer ', '').trim();

    if (!token) throw new UnauthorizedException('Missing authorization token');

    try {
      // No `audience` argument — accept any aud and verify the principal claim
      // ourselves (the alternative is per-RP guards which doesn't scale).
      const payload = await verifyToken(token);
      if (payload.token_type !== 'session') {
        throw new UnauthorizedException('Invalid token type');
      }
      // End-user tokens carry role='end-user' (operator tokens carry OWNER/ADMIN/MEMBER).
      if (payload.role !== 'end-user') {
        throw new UnauthorizedException('Operator session tokens cannot access end-user endpoints');
      }
      const audience = Array.isArray(payload.aud) ? payload.aud[0] : payload.aud;
      if (!audience || typeof audience !== 'string') {
        throw new UnauthorizedException('Token missing audience');
      }

      request.endUser = {
        id: payload.sub,
        email: payload.email,
        clientId: audience,
      };
      trace.getActiveSpan()?.setAttributes({
        'enduser.id': payload.sub as string,
        'enduser.email': payload.email as string,
        'enduser.audience': audience,
      });
      return true;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}

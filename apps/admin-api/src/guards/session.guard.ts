import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { trace } from '@hs/observability';
import { verifyToken, getIssuer } from '../modules/auth/jwt.service';

@Injectable()
export class SessionGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;
    const token = authHeader?.replace('Bearer ', '').trim();

    if (!token) throw new UnauthorizedException('Missing authorization token');

    try {
      const payload = await verifyToken(token, `${getIssuer()}/admin`);
      if (payload.token_type !== 'session') {
        throw new UnauthorizedException('Invalid token type');
      }
      request.user = {
        id: payload.sub,
        email: payload.email,
        orgId: payload.org_id,
        role: payload.role,
      };
      trace.getActiveSpan()?.setAttributes({
        'enduser.id': payload.sub as string,
        'enduser.email': payload.email as string,
      });
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}

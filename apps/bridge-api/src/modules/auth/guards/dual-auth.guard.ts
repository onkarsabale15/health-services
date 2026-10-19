import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { platformJwks } from '@hs/infra';
import { trace } from '@hs/observability';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

const PLATFORM_ISSUER = process.env.OAUTH_ISSUER || 'http://localhost:3002';

@Injectable()
export class DualAuthGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;
    const token = authHeader?.replace('Bearer ', '').trim();

    if (!token) {
      throw new UnauthorizedException('Please pass bearer token');
    }

    // Shared platform-JWKS verification (also used by mcp-app). Throws on bad
    // signature / issuer / audience / expiry, and on a non-`api` token_type.
    let payload: Awaited<ReturnType<typeof platformJwks.verifyApiToken>>;
    try {
      payload = await platformJwks.verifyApiToken(token, { issuer: PLATFORM_ISSUER });
    } catch (err) {
      if (err instanceof Error && err.message === 'Invalid token type for API access') {
        throw new UnauthorizedException('Invalid token type for API access');
      }
      throw new UnauthorizedException('Invalid or expired token');
    }

    const appType = payload.app_type as string | undefined;
    const ALLOWED_APP_TYPES = ['BRIDGE', 'CDS', 'WORKFLOW'];
    if (appType && !ALLOWED_APP_TYPES.includes(appType)) {
      throw new UnauthorizedException(`App type '${appType}' is not authorized for Bridge API`);
    }

    request.user = {
      appId: payload.sub,
      organizationId: payload.org_id,
      clientId: payload.client_id,
      scope: payload.scope,
      ehrAccess: payload.ehr_access,
      appType: payload.app_type,
      role: 'platform-app',
      expiresAt: new Date((payload.exp as number) * 1000).toUTCString(),
      isPlatformToken: true,
    };

    trace.getActiveSpan()?.setAttributes({
      'enduser.id': payload.sub as string,
      'enduser.name': payload.client_id as string,
    });
    return true;
  }
}

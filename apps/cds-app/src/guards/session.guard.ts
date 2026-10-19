import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { tracing, setAuditContext } from '@hs/observability';
import { SessionService } from '../services/session.service';

const COOKIE_NAME = 'cds_provider_session';

/**
 * Guards CDS endpoints by validating the provider session cookie.
 * Attaches providerSession + patientContext to the request.
 * Sets OTel audit context for trace correlation.
 */
@Injectable()
export class CdsSessionGuard implements CanActivate {
  constructor(private readonly sessionService: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const providerSessionId = request.cookies?.[COOKIE_NAME];

    if (!providerSessionId) {
      throw new UnauthorizedException('No active session — please launch from your EHR or sign in');
    }

    const session = await this.sessionService.getFullSession(providerSessionId);
    if (!session) {
      throw new UnauthorizedException('Session expired — please re-launch or sign in again');
    }

    request.cdsSession = session;

    // Set tracing identity + audit context for all spans in this request
    const ps = session.providerSession;
    tracing.setUser({ id: ps.providerSessionId, username: ps.providerName || undefined });
    setAuditContext({
      action: 'read',
      launchMode: ps.launchMode,
      ehrName: ps.ehrName,
      applicationId: ps.applicationId,
      providerId: ps.providerFhirId,
      providerNpi: ps.providerNpi,
    });

    return true;
  }
}

export { COOKIE_NAME };

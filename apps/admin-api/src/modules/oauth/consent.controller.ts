import { BadRequestException, Body, Controller, Get, NotFoundException, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';
import { randomBytes } from 'crypto';
import { cache, db } from '@hs/infra';
import { logger } from '@hs/observability';
import { AdminCacheKeys } from '../../cache/cache-keys';
import { AdminCacheTTL } from '../../cache/cache-ttl';
import { ConsentService } from './consent.service';

interface ConsentTicket {
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
  pkceState?: string;
}

class ConsentDecisionDto {
  @IsString()
  ticket!: string;

  @IsIn(['approve', 'deny'])
  decision!: 'approve' | 'deny';
}

/**
 * Partner-OIDC consent flow.
 *
 *   GET  /oauth/consent/context?ticket=...    → returns app metadata + scopes for the consent screen
 *   POST /oauth/consent/decision              → approve (issue auth code) or deny (return error to RP)
 *
 * The "ticket" is a short-lived opaque token created by `OAuthController.authorize()` when it
 * detects a partner client requesting `openid` without an active ConsentGrant. The ticket
 * carries everything needed to issue the authorization code post-approval — never put a JWT in it.
 */
@ApiTags('OAuth Consent')
@ApiSecurity({})
@Controller('oauth/consent')
export class ConsentController {
  constructor(private readonly consentService: ConsentService) {}

  @Get('context')
  @ApiOperation({ summary: 'Fetch consent screen context (app metadata + requested scopes)' })
  @ApiResponse({ status: 200, description: 'Context returned' })
  @ApiResponse({ status: 404, description: 'Ticket invalid or expired' })
  async context(@Query('ticket') ticket: string) {
    if (!ticket) throw new BadRequestException('ticket is required');

    // Peek without consuming — multiple GETs (e.g. user refreshing page) must succeed.
    const data = await cache.get<ConsentTicket>(AdminCacheKeys.consentTicket(ticket));
    if (!data) throw new NotFoundException({ error: 'consent_ticket_invalid' });

    const prisma = db.getClient();
    const app = await prisma.application.findFirst({
      where: { clientId: data.clientId, status: 'ACTIVE' },
      select: { id: true, name: true, appType: true, organization: { select: { name: true } } },
    });
    if (!app) throw new NotFoundException({ error: 'unknown_client' });

    return {
      app: {
        name: app.name,
        appType: app.appType,
        organizationName: app.organization?.name,
      },
      user: { email: data.email },
      scopes: data.scopes,
      redirectUri: data.redirectUri,
    };
  }

  @Post('decision')
  @ApiOperation({ summary: 'Approve or deny consent — backend issues auth code or error redirect' })
  @ApiResponse({ status: 200, description: 'Returns { redirect } URL the FE should navigate to' })
  async decision(@Body() body: ConsentDecisionDto) {
    // Atomic consume — one ticket = one decision.
    const data = await cache.getdel<ConsentTicket>(AdminCacheKeys.consentTicket(body.ticket));
    if (!data) throw new NotFoundException({ error: 'consent_ticket_invalid' });

    const url = new URL(data.redirectUri);
    url.searchParams.set('state', data.state);

    if (body.decision === 'deny') {
      url.searchParams.set('error', 'access_denied');
      url.searchParams.set('error_description', 'User denied consent');
      logger.info('Consent denied', { clientId: data.clientId, endUserId: data.endUserId });
      return { redirect: url.toString() };
    }

    // Approve: persist ConsentGrant + issue authorization code bound to the EndUser.
    await this.consentService.grant(data.endUserId, data.clientId, data.scopes);

    const code = randomBytes(32).toString('hex');
    await cache.set(
      AdminCacheKeys.oauthCode(code),
      {
        endUserId: data.endUserId,
        email: data.email,
        clientId: data.clientId,
        applicationId: data.applicationId,
        scope: data.scopes.join(' '),
        redirectUri: data.redirectUri,
        codeChallenge: data.codeChallenge,
        codeChallengeMethod: data.codeChallengeMethod,
        nonce: data.nonce ?? null,
        // The token endpoint will mint a session token with sub=endUserId, aud=clientId.
        principal: 'end-user',
      },
      AdminCacheTTL.OAUTH_CODE,
    );

    url.searchParams.set('code', code);
    logger.info('Consent approved + auth code issued', {
      clientId: data.clientId,
      endUserId: data.endUserId,
      scopes: data.scopes,
    });
    return { redirect: url.toString() };
  }
}

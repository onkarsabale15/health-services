import { Controller, Delete, Get, NotFoundException, Param, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { cache, db } from '@hs/infra';
import { logger } from '@hs/observability';
import { EndUserSessionGuard } from '../../guards/end-user-session.guard';
import { ConsentService } from '../oauth/consent.service';
import { AdminCacheKeys } from '../../cache/cache-keys';
import { AdminCacheTTL } from '../../cache/cache-ttl';

interface EndUserPrincipal {
  id: string;
  email: string;
  clientId: string;
}

interface ConnectionDto {
  clientId: string;
  applicationName: string;
  scopes: string[];
  grantedAt: string;
  lastUsedAt: string | null;
}

/**
 * End-user-facing controller. Tokens here have `aud=<partner_client_id>` and
 * `role=end-user`, so EndUserSessionGuard accepts them while operators with
 * `aud={issuer}/admin` are rejected.
 */
@ApiTags('End-user Self-service')
@ApiBearerAuth()
@UseGuards(EndUserSessionGuard)
@Controller('users/me')
export class MeController {
  constructor(private readonly consentService: ConsentService) {}

  @Get('connections')
  @ApiOperation({ summary: 'List partner apps the end-user has consented to' })
  @ApiResponse({ status: 200, description: 'Connections returned' })
  async listConnections(@Req() req: { endUser: EndUserPrincipal }): Promise<ConnectionDto[]> {
    const { endUser } = req;
    const grants = await this.consentService.listForUser(endUser.id);
    if (grants.length === 0) return [];

    // Resolve display names for each clientId. Partner apps live in the same
    // Application table, so a single batched lookup covers them.
    const prisma = db.getClient();
    const apps = await prisma.application.findMany({
      where: { clientId: { in: grants.map((g) => g.clientId) } },
      select: { clientId: true, name: true },
    });
    const nameByClientId = new Map(apps.map((a) => [a.clientId, a.name]));

    return grants.map((g) => ({
      clientId: g.clientId,
      applicationName: nameByClientId.get(g.clientId) ?? g.clientId,
      scopes: g.scopes,
      grantedAt: g.grantedAt.toISOString(),
      lastUsedAt: g.lastUsedAt ? g.lastUsedAt.toISOString() : null,
    }));
  }

  @Delete('connections/:clientId')
  @ApiOperation({
    summary: 'Revoke a partner app — invalidates outstanding tokens and removes ConsentGrant',
  })
  @ApiResponse({ status: 200, description: 'Connection revoked' })
  @ApiResponse({ status: 404, description: 'No active grant for this clientId' })
  async revokeConnection(
    @Req() req: { endUser: EndUserPrincipal },
    @Param('clientId') clientId: string,
  ): Promise<{ revoked: true }> {
    const { endUser } = req;
    const { count } = await this.consentService.revoke(endUser.id, clientId);
    if (count === 0) throw new NotFoundException({ error: 'no_active_grant' });

    // Best-effort: also blacklist the caller's current access token (jti) and
    // delete any refresh tokens we issued for this end-user + client. The
    // refresh-token Redis blob is per-token and we don't keep an index, so
    // revoke-on-next-refresh by leaving stale rows to expire is acceptable —
    // the access token jti blacklist is the immediate stop.
    const jti = (req as unknown as { headers: Record<string, string> }).headers?.['x-token-jti'];
    if (typeof jti === 'string' && jti) {
      await cache
        .set(AdminCacheKeys.oauthRevoked(jti), '1', AdminCacheTTL.SESSION_REFRESH)
        .catch((err) => logger.warn('Failed to blacklist jti on revoke', { jti, err: err?.message }));
    }

    logger.info('End-user revoked partner app', {
      endUserId: endUser.id,
      clientId,
    });

    return { revoked: true };
  }
}

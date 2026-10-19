import { Controller, Post, Body, UnauthorizedException, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';
import { db } from '@hs/infra';
import { logger } from '@hs/observability';
import { signOAuthToken } from '../auth/jwt.service';

class TokenForAppDto {
  @ApiProperty({ description: 'Application UUID to mint a token for' })
  @IsString()
  @IsNotEmpty()
  applicationId!: string;
}

/**
 * Service-to-service endpoint used by workflow-executor and bridge-api to mint
 * platform JWTs scoped to a given application. URL lives in the regular API
 * surface; access is gated by the `internal: true` JWT claim asserted at
 * runtime, not by URL namespace.
 */
@ApiTags('OAuth 2.0')
@Controller('oauth')
export class InternalTokenController {
  @Post('service-token')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mint platform JWT for an application (internal services only)' })
  @ApiResponse({ status: 200, description: 'Token issued' })
  @ApiResponse({ status: 401, description: 'Invalid or missing internal service token' })
  async tokenForApp(@Req() req: any, @Body() body: TokenForAppDto) {
    // Only internal services can call this endpoint
    if (!req.user?.isInternalService) {
      throw new UnauthorizedException('This endpoint is restricted to internal services');
    }

    // Load application with active EHR access
    const prisma = db.getClient();
    const app = await prisma.application.findFirst({
      where: { id: body.applicationId, status: 'ACTIVE' },
      include: {
        ehrAccess: {
          where: { status: 'ACTIVE' },
          select: { ehrName: true },
        },
      },
    });

    if (!app) {
      throw new UnauthorizedException('Application not found or disabled');
    }

    // Sign an OAuth/platform JWT — same format as client_credentials grant
    const ehrAccess = app.ehrAccess.map((e) => e.ehrName);
    const scope = app.scopes?.length ? app.scopes.sort().join(' ') : '';

    const token = await signOAuthToken({
      sub: app.id,
      clientId: app.clientId,
      orgId: app.organizationId,
      scope,
      ehrAccess,
      expiresIn: app.tokenLifetime || 3600,
      appType: app.appType,
      appName: app.name,
      internal: true,
    });

    // Cross-org mint is allowed (internal services may operate across orgs)
    // but is audit-relevant — escalate the log level on mismatch.
    const callerOrgId: string | undefined = req.user?.orgId;
    const crossOrg = !!(callerOrgId && callerOrgId !== app.organizationId);
    const logFields = {
      applicationId: app.id,
      clientId: app.clientId,
      callerOrgId,
      targetOrgId: app.organizationId,
    };
    if (crossOrg) {
      logger.warn('Internal token mint crosses organization boundary', logFields);
    } else {
      logger.info('Internal token issued for application', logFields);
    }

    return {
      access_token: token.accessToken,
      token_type: 'Bearer',
      expires_in: token.expiresIn,
    };
  }
}

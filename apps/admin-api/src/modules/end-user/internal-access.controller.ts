import { Body, Controller, ForbiddenException, Post, Req, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { logger } from '@hs/observability';
import type { ResolveAction } from '@hs/config';
import { resolveOrAutoProvision } from '../../utils/identity-resolver';

class CheckAccessDto {
  @IsString()
  @IsOptional()
  ehrName?: string;

  @IsString()
  @IsOptional()
  fhirId?: string;

  /** Optional — real email from EHR id_token or Practitioner.telecom. Omitted when bridge could not resolve one. */
  @IsString()
  @IsOptional()
  email?: string;

  @IsUUID()
  applicationId!: string;

  @IsUUID()
  @IsOptional()
  siteId?: string;
}

interface CheckAccessResponse {
  endUserId?: string;
  allowed: boolean;
  action?: ResolveAction;
  reason?: string;
}

/**
 * Service-to-service endpoint used by bridge-api (SMART launch) and cds-app
 * (system launch) to resolve an EHR-vouched / OTP-verified user to an
 * `EndUser` and check `EndUserAppAccess`. URL lives in the regular API
 * surface; access is gated by the `internal: true` JWT claim asserted at
 * runtime, not by URL namespace.
 */
@ApiTags('OAuth 2.0')
@Controller('oauth')
export class InternalAccessController {
  @Post('access-check')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Resolve EHR/OTP user to EndUser + check app access (internal services only)' })
  @ApiResponse({ status: 200, description: 'Access decision returned' })
  @ApiResponse({ status: 401, description: 'Caller is not an internal service' })
  @ApiResponse({ status: 403, description: 'Access denied (closed policy / disabled / site mismatch)' })
  async check(@Req() req: any, @Body() body: CheckAccessDto): Promise<CheckAccessResponse> {
    if (!req.user?.isInternalService) {
      throw new UnauthorizedException('This endpoint is restricted to internal services');
    }

    try {
      const result = await resolveOrAutoProvision({
        ehrName: body.ehrName,
        fhirId: body.fhirId,
        email: body.email,
        applicationId: body.applicationId,
        siteId: body.siteId,
      });
      logger.info('Internal access check resolved', {
        applicationId: body.applicationId,
        endUserId: result.endUserId,
        action: result.action,
      });
      return { endUserId: result.endUserId, allowed: true, action: result.action };
    } catch (err) {
      if (err instanceof ForbiddenException) {
        const detail = err.getResponse() as { error?: string; message?: string } | string;
        const reason = typeof detail === 'object' ? detail.error || detail.message : String(detail);
        logger.warn('Internal access check denied', { applicationId: body.applicationId, email: body.email, reason });
        return { allowed: false, reason };
      }
      throw err;
    }
  }
}

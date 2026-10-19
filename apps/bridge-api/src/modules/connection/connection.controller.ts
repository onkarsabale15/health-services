import { Controller, Post, Get, Delete, Body, Headers, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
// Legacy: direct import from ehr-data-service internal core
import { connectionService } from '@hs/ehr-data-service/dist/core/domain/connection.service';
import { logger } from '@hs/observability';
import { secrets } from '@hs/infra';
import { getEhrDefinition, resolveGrantType, resolveCredentials } from '@hs/config';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateConnectionDto, ConnectionResponseDto, DeleteConnectionResponseDto } from '../../dto';
import { OperationOutcomeResponse } from '../../dto';
import { getAppEhrConfig } from './saas-config.service';

@ApiTags('Connection')
@ApiBearerAuth()
@Throttle({ default: { limit: 60, ttl: 60000 } }) // 60/min per clientId — connections are long-lived
@Controller('v1/Connection')
export class ConnectionController {
  @Post()
  @ApiOperation({
    summary: 'Create OAuth connection to EHR',
    description:
      'Only ehrName is required. All credentials, URLs, and configuration are loaded from the stored application EHR config. Pass "code" only for authorization_code grant type flows.',
  })
  @ApiResponse({ status: 201, description: 'Connection created', type: ConnectionResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error / EHR not configured', type: OperationOutcomeResponse })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: OperationOutcomeResponse })
  async createConnection(@Body() body: CreateConnectionDto, @CurrentUser() user: any) {
    logger.info('Creating connection', { ehrName: body.ehrName });

    // Fetch stored config for this app + EHR
    const stored = await getAppEhrConfig(user.clientId, body.ehrName);
    if (!stored?.ehrConfig) {
      throw new BadRequestException(
        `EHR "${body.ehrName}" is not configured for this application. Configure it via the admin portal first.`,
      );
    }

    const config = stored.ehrConfig;
    const creds = resolveCredentials(config);

    // Build payload entirely from stored config — no overrides from request body.
    // URL resolution happens inside connection.service.ts using the deployment env.
    const payload: Record<string, any> = {
      ehrName: body.ehrName,
      appType: config.appType || 'system',
      grantType: resolveGrantType(config.appType || 'system'),
      clientId: creds.clientId,
      clientSecret: creds.clientSecret,
      scope: stored.ehrTokenScopes.join(' '),
      siteId: config.siteId,
      accountId: config.accountId,
      tenant: config.tenant,
      enterpriseId: config.enterpriseId,
      applicationName: config.applicationName,
    };

    // Include authorization code if provided (runtime value for auth_code flows)
    if (body.code) {
      payload.code = body.code;
    }

    // Carry through any URL override fields from stored config (single-value `*Url` keys)
    for (const key of Object.keys(config)) {
      if (key.match(/Url$/) && config[key]) {
        payload[key] = config[key];
      }
    }

    // Load JWK from Secrets Manager for EHRs that require private key signing
    const definition = getEhrDefinition(body.ehrName);
    const hasJwkField = definition?.fields.some((f) => f.type === 'jwk');
    if (hasJwkField) {
      try {
        const safeAppId = (user.appId || user.clientId).replace(/-/g, '_').toUpperCase();
        const safeEhrName = body.ehrName.replace(/-/g, '_').toUpperCase();
        const jwks = await secrets.getSecretValue<{ keys: any[] }>(`EHR_JWKS__${safeAppId}__${safeEhrName}`);
        if (jwks?.keys?.length > 0) {
          payload.clientSecret = jwks;
        } else {
          throw new BadRequestException(
            `JWK private key not configured for ${body.ehrName}. Upload it via the admin portal.`,
          );
        }
      } catch (error: any) {
        if (error instanceof BadRequestException) throw error;
        throw new BadRequestException(`JWK private key not found for ${body.ehrName}. Upload it via the admin portal.`);
      }
    }

    logger.info('Connection payload built from stored config', {
      ehrName: body.ehrName,
      clientId: user.clientId,
      appType: payload.appType,
      grantType: payload.grantType,
    });

    // URL resolution + caching of all credentials happens in connectionService
    return connectionService.createConnection(payload, user);
  }

  @Get()
  @ApiOperation({ summary: 'Get connection details' })
  @ApiHeader({ name: 'connectionid', required: true, description: 'EHR connection ID' })
  @ApiResponse({ status: 200, description: 'Connection details', type: ConnectionResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid connection ID', type: OperationOutcomeResponse })
  async getConnection(@Headers('connectionid') connectionId: string) {
    return connectionService.getConnection(connectionId);
  }

  @Delete()
  @ApiOperation({ summary: 'Delete/revoke connection' })
  @ApiHeader({ name: 'connectionid', required: true, description: 'EHR connection ID' })
  @ApiResponse({ status: 200, description: 'Connection deleted', type: DeleteConnectionResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid connection ID', type: OperationOutcomeResponse })
  async deleteConnection(@Headers('connectionid') connectionId: string) {
    const connectionData = await connectionService.getConnection(connectionId);
    return connectionService.deleteConnection(connectionId, connectionData);
  }
}

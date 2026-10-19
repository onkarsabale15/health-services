import {
  Controller,
  Get,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';
import { db } from '@hs/infra';
import { secrets } from '@hs/infra';
import { logger } from '@hs/observability';
import { LLM_PROVIDERS } from '@hs/ai';
import { RolesGuard, Roles } from '../../guards/roles.guard';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { AllowTokenTypes } from '../../decorators/auth.decorator';

// ─── DTO ────────────────────────────────────────────────────────────────────

class SetApiKeyDto {
  @ApiProperty({ description: 'LLM provider API key', example: 'sk-...' })
  @IsString()
  @IsNotEmpty()
  apiKey!: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const VALID_PROVIDERS = Object.keys(LLM_PROVIDERS);

function toSecretName(appId: string, provider: string): string {
  const safeAppId = appId.replace(/-/g, '_').toUpperCase();
  const safeProvider = provider.toUpperCase();
  return `LLM_KEY__${safeAppId}__${safeProvider}`;
}

@Controller('applications/:appId/llm-keys')
@AllowTokenTypes('session')
@ApiTags('LLM Configuration')
@ApiBearerAuth()
export class LlmConfigController {
  // ─── Set API Key ──────────────────────────────────────────────

  @Put(':provider')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Store a custom LLM API key for an application' })
  @ApiResponse({ status: 200, description: 'API key stored' })
  async setKey(
    @Param('appId') appId: string,
    @Param('provider') provider: string,
    @Body() body: SetApiKeyDto,
    @CurrentUser() user: any,
  ) {
    // Validate provider
    if (!VALID_PROVIDERS.includes(provider)) {
      throw new BadRequestException(`Invalid provider. Must be one of: ${VALID_PROVIDERS.join(', ')}`);
    }

    const providerInfo = LLM_PROVIDERS[provider];
    if (providerInfo.noKeyRequired) {
      throw new BadRequestException(`Provider '${provider}' does not require an API key`);
    }

    const prisma = db.getClient();

    // Verify app belongs to user's org
    const app = await prisma.application.findFirst({
      where: { id: appId, organizationId: user.orgId },
      select: { id: true, appType: true },
    });
    if (!app) throw new NotFoundException('Application not found');

    // Only WORKFLOW and CDS apps support LLM keys
    if (app.appType !== 'WORKFLOW' && app.appType !== 'CDS') {
      throw new BadRequestException('LLM keys can only be configured for WORKFLOW or CDS applications');
    }

    // Store key in Secrets Manager — NEVER in DB
    const secretName = toSecretName(appId, provider);
    await secrets.putSecretValue(secretName, body.apiKey);

    // NEVER log the key value
    logger.info('LLM API key configured', {
      applicationId: appId,
      provider,
      userId: user.id,
    });

    return { provider, status: 'configured' };
  }

  // ─── Remove API Key ───────────────────────────────────────────

  @Delete(':provider')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Remove a custom LLM API key for an application' })
  async removeKey(@Param('appId') appId: string, @Param('provider') provider: string, @CurrentUser() user: any) {
    if (!VALID_PROVIDERS.includes(provider)) {
      throw new BadRequestException(`Invalid provider. Must be one of: ${VALID_PROVIDERS.join(', ')}`);
    }

    const prisma = db.getClient();

    const app = await prisma.application.findFirst({
      where: { id: appId, organizationId: user.orgId },
      select: { id: true },
    });
    if (!app) throw new NotFoundException('Application not found');

    const secretName = toSecretName(appId, provider);

    try {
      await secrets.deleteSecretValue(secretName);
    } catch {
      // Key may not exist — that's fine
    }

    logger.info('LLM API key removed', {
      applicationId: appId,
      provider,
      userId: user.id,
    });

    return { provider, status: 'removed' };
  }

  // ─── Get Key Status ───────────────────────────────────────────

  @Get('status')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Check which LLM providers have custom API keys configured (no values returned)' })
  async getKeyStatus(@Param('appId') appId: string, @CurrentUser() user: any) {
    const prisma = db.getClient();

    const app = await prisma.application.findFirst({
      where: { id: appId, organizationId: user.orgId },
      select: { id: true },
    });
    if (!app) throw new NotFoundException('Application not found');

    // Check each key-required provider for custom keys
    const keyRequiredProviders = VALID_PROVIDERS.filter((p) => !LLM_PROVIDERS[p].noKeyRequired);

    const statuses: Record<string, boolean> = {};
    await Promise.all(
      keyRequiredProviders.map(async (provider) => {
        const secretName = toSecretName(appId, provider);
        try {
          const value = await secrets.getSecretValue<string>(secretName);
          statuses[provider] = !!value;
        } catch {
          statuses[provider] = false;
        }
      }),
    );

    return statuses;
  }
}

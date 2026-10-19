import { Controller, Get, Post, Put, Delete, Param, Query, Body, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { db } from '@hs/infra';
import { logger } from '@hs/observability';
import { secrets } from '@hs/infra';
import {
  getAllEnrichedDefinitions,
  getEnrichedDefinition,
  validateEhrConfig,
  getScopesForEhr,
  getCapabilitiesForEhr,
  getAllScopes,
  getAllCapabilities,
  getDefaultEndpoints,
  getTokenScopeConfig,
  getMaxEhrAccess,
  getAppTypeDefinition,
  supportsMultiSite,
  getPerSiteFields,
  buildSiteKey,
} from '@hs/config';
import { RolesGuard, Roles } from '../../guards/roles.guard';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { Public, AllowTokenTypes } from '../../decorators/auth.decorator';

/**
 * Doppler secret key for EHR JWK storage (must be UPPER_SNAKE_CASE).
 * One JWK per (app, ehr) — the deployment env is implicit from the instance.
 */
function jwkSecretKey(appId: string, ehrName: string): string {
  const safeAppId = appId.replace(/-/g, '_').toUpperCase();
  const safeEhrName = ehrName.replace(/-/g, '_').toUpperCase();
  return `EHR_JWKS__${safeAppId}__${safeEhrName}`;
}

/**
 * Auto-heal legacy AppEhrAccess records where the DB `ehrAppType` column
 * is out of sync with `ehrConfig.appType`. This handles records saved before
 * the admin UI correctly sent `ehrAppType` to the backend.
 *
 * If a stale record is found where `ehrConfig.appType === targetAppType` but
 * the column is different, the column is migrated to match.
 */
async function healLegacyAppEhrAccess(
  prisma: ReturnType<typeof db.getClient>,
  appId: string,
  ehrName: string,
  targetAppType: string,
): Promise<void> {
  const records = await prisma.appEhrAccess.findMany({
    where: { applicationId: appId, ehrName },
    select: { id: true, ehrAppType: true, ehrConfig: true },
  });
  const stale = records.find((r) => {
    const configAppType = (r.ehrConfig as any)?.appType;
    return configAppType === targetAppType && r.ehrAppType !== targetAppType;
  });
  if (stale) {
    await prisma.appEhrAccess.update({
      where: { id: stale.id },
      data: { ehrAppType: targetAppType },
    });
    logger.info('Auto-healed legacy EHR access record', {
      id: stale.id,
      from: stale.ehrAppType,
      to: targetAppType,
    });
  }
}

@ApiTags('EHR Configuration')
@Controller()
export class EhrConfigController {
  // ─── Public: Field Definitions (no auth needed) ──────────

  @Get('ehr/definitions')
  @Public()
  @ApiOperation({ summary: 'Get all EHR field definitions with resolved defaults (public, for UI rendering)' })
  getDefinitions() {
    return getAllEnrichedDefinitions();
  }

  @Get('ehr/definitions/:ehrName')
  @Public()
  @ApiOperation({ summary: 'Get field definitions for a specific EHR, enriched with URL defaults and scope options' })
  getDefinition(@Param('ehrName') ehrName: string, @Query('appType') appType?: string) {
    const def = getEnrichedDefinition(ehrName, appType);
    if (!def) throw new BadRequestException(`Unknown EHR: ${ehrName}`);
    return def;
  }

  @Get('ehr/scopes')
  @Public()
  @ApiOperation({ summary: 'Get all FHIR platform scopes across all EHRs (for app-level scope selection)' })
  getAllPlatformScopes() {
    return {
      scopes: getAllScopes(),
      capabilities: getAllCapabilities(),
    };
  }

  @Get('ehr/definitions/:ehrName/scopes')
  @Public()
  @ApiOperation({ summary: 'Get available FHIR platform scopes for a specific EHR' })
  getScopes(@Param('ehrName') ehrName: string) {
    return {
      ehrName,
      scopes: getScopesForEhr(ehrName),
      capabilities: getCapabilitiesForEhr(ehrName),
    };
  }

  @Get('ehr/definitions/:ehrName/endpoints')
  @Public()
  @ApiOperation({ summary: 'Get default EHR endpoint URLs for a specific appType' })
  getEndpoints(@Param('ehrName') ehrName: string, @Query('appType') appType?: string) {
    const endpoints = getDefaultEndpoints(ehrName, appType || 'system');
    if (!endpoints) throw new BadRequestException(`No endpoints found for ${ehrName}/${appType || 'system'}`);
    return endpoints;
  }

  @Get('ehr/definitions/:ehrName/token-scopes')
  @Public()
  @ApiOperation({ summary: 'Get EHR-specific OAuth token scope options for a specific appType' })
  getTokenScopes(@Param('ehrName') ehrName: string, @Query('appType') appType?: string) {
    const config = getTokenScopeConfig(ehrName, appType || 'system');
    return config || { defaultScope: '', options: [], allowCustom: true };
  }

  // ─── Per-App EHR Access (session-authenticated) ──────────

  @Get('applications/:appId/ehr')
  @AllowTokenTypes('session')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List EHR access entries for an application' })
  async listEhrAccess(@Param('appId') appId: string, @CurrentUser() user: any) {
    const prisma = db.getClient();
    const app = await prisma.application.findFirst({
      where: { id: appId, organizationId: user.orgId },
      select: { id: true },
    });
    if (!app) throw new BadRequestException('Application not found');

    return prisma.appEhrAccess.findMany({
      where: { applicationId: appId },
      orderBy: { ehrName: 'asc' },
      include: { sites: { orderBy: { isDefault: 'desc' } } },
    });
  }

  @Put('applications/:appId/ehr/:ehrName')
  @AllowTokenTypes('session')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upsert EHR access config for an application' })
  async upsertEhrAccess(
    @Param('appId') appId: string,
    @Param('ehrName') ehrName: string,
    @Body() body: { ehrAppType?: string; ehrTokenScopes?: string[]; ehrConfig: Record<string, any> },
    @CurrentUser() user: any,
  ) {
    const prisma = db.getClient();

    const app = await prisma.application.findFirst({
      where: { id: appId, organizationId: user.orgId },
      select: { id: true, appType: true },
    });
    if (!app) throw new BadRequestException('Application not found');

    // Enforce max EHR access per app type (e.g., WORKFLOW apps support only 1 EHR)
    const maxEhr = getMaxEhrAccess(app.appType);
    if (maxEhr !== -1) {
      const existing = await prisma.appEhrAccess.findFirst({
        where: { applicationId: appId, ehrName },
      });
      // Only check limit for new EHR connections (not updates to existing ones)
      if (!existing) {
        const activeCount = await prisma.appEhrAccess.count({
          where: { applicationId: appId, status: 'ACTIVE' },
        });
        if (activeCount >= maxEhr) {
          throw new BadRequestException(`${app.appType} applications support a maximum of ${maxEhr} EHR connection(s)`);
        }
      }
    }

    // Validate EHR name
    const definition = getEnrichedDefinition(ehrName, body.ehrConfig?.appType);
    if (!definition) throw new BadRequestException(`Unknown EHR: ${ehrName}`);

    // Validate the launch mode is supported by this EHR
    const requestedAppType = body.ehrAppType || body.ehrConfig?.appType || 'system';
    if (!definition.supportedAppTypes.includes(requestedAppType)) {
      throw new BadRequestException(
        `${ehrName} does not support app type "${requestedAppType}". Supported: ${definition.supportedAppTypes.join(', ')}`,
      );
    }

    // Validate the launch mode is allowed for this application's type
    // (e.g. MCP apps are headless — system/client_credentials only).
    const appTypeDef = getAppTypeDefinition(app.appType);
    if (
      appTypeDef &&
      !appTypeDef.allowedEhrAppTypes.includes(requestedAppType as (typeof appTypeDef.allowedEhrAppTypes)[number])
    ) {
      throw new BadRequestException(
        `${app.appType} applications do not support the "${requestedAppType}" launch mode. Allowed: ${appTypeDef.allowedEhrAppTypes.join(', ')}`,
      );
    }

    // Validate ehrConfig fields
    const configErrors = validateEhrConfig(ehrName, body.ehrConfig);
    if (configErrors.length > 0) {
      throw new BadRequestException({
        message: 'EHR configuration validation failed',
        errors: configErrors,
      });
    }

    // Strip JWK-type fields and per-site fields from ehrConfig
    const cleanConfig = { ...body.ehrConfig };
    const siteIdentifiers: Record<string, any> = {};
    if (definition) {
      for (const field of definition.fields) {
        if (field.type === 'jwk') {
          delete cleanConfig[field.key];
        }
        if (field.perSite && cleanConfig[field.key] !== undefined) {
          siteIdentifiers[field.key] = cleanConfig[field.key];
          delete cleanConfig[field.key];
        }
      }
    }

    // Check if this is a create (new) vs update (existing)
    const ehrAppType = body.ehrAppType || 'system';

    await healLegacyAppEhrAccess(prisma, appId, ehrName, ehrAppType);

    const existing = await prisma.appEhrAccess.findFirst({
      where: { applicationId: appId, ehrName, ehrAppType },
      select: { id: true },
    });

    const result = await prisma.appEhrAccess.upsert({
      where: { applicationId_ehrName_ehrAppType: { applicationId: appId, ehrName, ehrAppType } },
      create: {
        applicationId: appId,
        ehrName,
        ehrAppType,
        ehrTokenScopes: body.ehrTokenScopes || [],
        ehrConfig: cleanConfig,
        // Auto-create a default site on new integration
        sites: {
          create: {
            name: 'Default',
            siteKey: buildSiteKey(ehrName, siteIdentifiers),
            siteIdentifiers,
            isDefault: true,
          },
        },
      },
      update: {
        ehrTokenScopes: body.ehrTokenScopes || [],
        ehrConfig: cleanConfig,
        status: 'ACTIVE',
      },
      include: { sites: true },
    });

    logger.info('EHR access upserted', { appId, ehrName, isNew: !existing });
    return result;
  }

  @Post('applications/:appId/ehr/:ehrName/enable')
  @AllowTokenTypes('session')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Re-enable EHR access for an application' })
  async enableEhrAccess(
    @Param('appId') appId: string,
    @Param('ehrName') ehrName: string,
    @Query('appType') ehrAppType: string | undefined,
    @CurrentUser() user: any,
  ) {
    const prisma = db.getClient();

    const app = await prisma.application.findFirst({
      where: { id: appId, organizationId: user.orgId },
      select: { id: true },
    });
    if (!app) throw new BadRequestException('Application not found');

    const ehr = await prisma.appEhrAccess.findFirst({
      where: { applicationId: appId, ehrName, ...(ehrAppType ? { ehrAppType } : {}) },
      select: { id: true },
    });
    if (!ehr) throw new BadRequestException('EHR access not found');

    await prisma.appEhrAccess.update({
      where: { id: ehr.id },
      data: { status: 'ACTIVE' },
    });

    logger.info('EHR access re-enabled', { appId, ehrName, ehrAppType });
    return { message: `EHR access for ${ehrName} enabled` };
  }

  @Delete('applications/:appId/ehr/:ehrName')
  @AllowTokenTypes('session')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disable EHR access for an application' })
  async removeEhrAccess(
    @Param('appId') appId: string,
    @Param('ehrName') ehrName: string,
    @Query('appType') ehrAppType: string | undefined,
    @CurrentUser() user: any,
  ) {
    const prisma = db.getClient();

    const app = await prisma.application.findFirst({
      where: { id: appId, organizationId: user.orgId },
      select: { id: true },
    });
    if (!app) throw new BadRequestException('Application not found');

    const ehr = await prisma.appEhrAccess.findFirst({
      where: { applicationId: appId, ehrName, ...(ehrAppType ? { ehrAppType } : {}) },
      select: { id: true },
    });
    if (!ehr) throw new BadRequestException('EHR access not found');

    await prisma.appEhrAccess.update({
      where: { id: ehr.id },
      data: { status: 'DISABLED' },
    });

    logger.info('EHR access disabled', { appId, ehrName, ehrAppType });
    return { message: `EHR access for ${ehrName} disabled` };
  }

  // ─── Site/Practice Management ───────────────────────────────

  @Get('applications/:appId/ehr/:ehrName/sites')
  @AllowTokenTypes('session', 'api')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List sites/practices for an EHR integration (session or API token)' })
  async listSites(
    @Param('appId') appId: string,
    @Param('ehrName') ehrName: string,
    @Query('appType') ehrAppType: string | undefined,
    @CurrentUser() user: any,
  ) {
    const prisma = db.getClient();
    return prisma.ehrSiteConfig.findMany({
      where: {
        ehrAccess: {
          applicationId: appId,
          ehrName,
          ...(ehrAppType ? { ehrAppType } : {}),
          application: { organizationId: user.orgId },
        },
      },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  @Post('applications/:appId/ehr/:ehrName/sites')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a new site/practice to an EHR integration (session, API token, or internal key)' })
  async createSite(
    @Param('appId') appId: string,
    @Param('ehrName') ehrName: string,
    @Query('appType') ehrAppType: string | undefined,
    @Body()
    body: {
      name: string;
      siteIdentifiers: Record<string, any>;
      siteCredentials?: Record<string, any>;
      siteUrls?: Record<string, any>;
      isApproved?: boolean;
    },
    @CurrentUser() user: any,
  ) {
    const prisma = db.getClient();
    const isInternalCall = !!user?.isInternalService;

    // Session tokens: only OWNER and ADMIN can create sites (MEMBER cannot)
    if (user?.isSessionToken && !['OWNER', 'ADMIN'].includes(user.role)) {
      throw new BadRequestException('Insufficient permissions — only OWNER or ADMIN can create sites');
    }

    // External API tokens must match the target app. Internal services bypass this.
    if (user.isApiToken && !isInternalCall && user.appId !== appId) {
      throw new BadRequestException('Access denied — token does not belong to this application');
    }

    if (!body.name?.trim()) {
      throw new BadRequestException('Site name is required');
    }

    // Internal calls (bridge auto-creating sites): skip multi-site check and org boundary
    // External calls: enforce org boundary and validate field definitions
    let access: any;
    if (isInternalCall) {
      access = await prisma.appEhrAccess.findFirst({
        where: { applicationId: appId, ehrName, status: 'ACTIVE', ...(ehrAppType ? { ehrAppType } : {}) },
        select: { id: true },
      });
      if (!access) throw new BadRequestException('EHR access not found or not active');
    } else {
      if (!supportsMultiSite(ehrName)) {
        throw new BadRequestException(`${ehrName} does not support multiple sites`);
      }
      const perSiteFields = getPerSiteFields(ehrName);
      for (const field of perSiteFields) {
        if (field.required && !body.siteIdentifiers?.[field.key]) {
          throw new BadRequestException(`${field.label} is required for each site`);
        }
      }
      access = await this.findEhrAccess(prisma, appId, ehrName, user.orgId, ehrAppType);
    }

    const siteIdentifiers = body.siteIdentifiers || {};
    const site = await prisma.ehrSiteConfig.create({
      data: {
        ehrAccessId: access.id,
        name: body.name.trim(),
        siteKey: buildSiteKey(ehrName, siteIdentifiers),
        siteIdentifiers,
        siteCredentials: body.siteCredentials || undefined,
        siteUrls: body.siteUrls || undefined,
        isDefault: false,
        isApproved: isInternalCall || user?.isSessionToken ? (body.isApproved ?? true) : true,
      },
    });

    logger.info('EHR site created', { appId, ehrName, siteId: site.id, siteName: site.name });
    return site;
  }

  @Put('applications/:appId/ehr/:ehrName/sites/:siteId')
  @AllowTokenTypes('session', 'api')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a site/practice configuration (session or API token)' })
  async updateSite(
    @Param('appId') appId: string,
    @Param('ehrName') ehrName: string,
    @Param('siteId') siteId: string,
    @Query('appType') ehrAppType: string | undefined,
    @Body()
    body: {
      name?: string;
      siteIdentifiers?: Record<string, any>;
      siteCredentials?: Record<string, any>;
      siteUrls?: Record<string, any>;
      isActive?: boolean;
      isApproved?: boolean;
    },
    @CurrentUser() user: any,
  ) {
    const prisma = db.getClient();

    const site = await prisma.ehrSiteConfig.findFirst({
      where: {
        id: siteId,
        ehrAccess: {
          applicationId: appId,
          ehrName,
          ...(ehrAppType ? { ehrAppType } : {}),
          application: { organizationId: user.orgId },
        },
      },
    });
    if (!site) throw new BadRequestException('Site not found');

    // Validate siteIdentifiers if provided
    if (body.siteIdentifiers && supportsMultiSite(ehrName)) {
      const perSiteFields = getPerSiteFields(ehrName);
      for (const field of perSiteFields) {
        if (field.required && !body.siteIdentifiers[field.key]) {
          throw new BadRequestException(`${field.label} is required for each site`);
        }
      }
    }

    const data: Record<string, any> = {};
    if (body.name !== undefined) data.name = body.name.trim();
    if (body.siteIdentifiers !== undefined) data.siteIdentifiers = body.siteIdentifiers;
    if (body.siteCredentials !== undefined) data.siteCredentials = body.siteCredentials;
    if (body.siteUrls !== undefined) data.siteUrls = body.siteUrls;
    if (body.isActive !== undefined) data.isActive = body.isActive;
    if (body.isApproved !== undefined) data.isApproved = body.isApproved;

    const updated = await prisma.ehrSiteConfig.update({
      where: { id: siteId },
      data,
    });

    logger.info('EHR site updated', { appId, ehrName, siteId });
    return updated;
  }

  @Delete('applications/:appId/ehr/:ehrName/sites/:siteId')
  @AllowTokenTypes('session', 'api')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Deactivate a site/practice (session or API token)' })
  async removeSite(
    @Param('appId') appId: string,
    @Param('ehrName') ehrName: string,
    @Param('siteId') siteId: string,
    @Query('appType') ehrAppType: string | undefined,
    @CurrentUser() user: any,
  ) {
    const prisma = db.getClient();

    // Find site directly and verify it belongs to this app + org
    const site = await prisma.ehrSiteConfig.findFirst({
      where: {
        id: siteId,
        ehrAccess: {
          applicationId: appId,
          ehrName,
          ...(ehrAppType ? { ehrAppType } : {}),
          application: { organizationId: user.orgId },
        },
      },
      include: { ehrAccess: { select: { id: true } } },
    });
    if (!site) throw new BadRequestException('Site not found');

    // Unapproved sites (denied): hard delete — no soft delete needed
    if (!site.isApproved) {
      await prisma.ehrSiteConfig.delete({ where: { id: siteId } });
      logger.info('EHR site denied and deleted', { appId, ehrName, siteId, siteName: site.name });
      return { message: `Site "${site.name}" denied and permanently deleted` };
    }

    // Approved sites: soft deactivate
    // Prevent deactivating last active site
    const activeCount = await prisma.ehrSiteConfig.count({
      where: { ehrAccessId: site.ehrAccessId, isActive: true },
    });
    if (activeCount <= 1) {
      throw new BadRequestException(
        'Cannot deactivate the last active site. An integration must have at least one active site.',
      );
    }

    await prisma.ehrSiteConfig.update({
      where: { id: siteId },
      data: { isActive: false },
    });

    // If the deactivated site was default, promote another active site
    if (site.isDefault) {
      const nextDefault = await prisma.ehrSiteConfig.findFirst({
        where: { ehrAccessId: site.ehrAccessId, isActive: true, id: { not: siteId } },
        orderBy: { createdAt: 'asc' },
      });
      if (nextDefault) {
        await prisma.ehrSiteConfig.update({
          where: { id: nextDefault.id },
          data: { isDefault: true },
        });
      }
    }

    logger.info('EHR site deactivated', { appId, ehrName, siteId });
    return { message: `Site "${site.name}" deactivated` };
  }

  @Post('applications/:appId/ehr/:ehrName/sites/:siteId/default')
  @AllowTokenTypes('session', 'api')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Set a site as the default for this integration (session or API token)' })
  async setDefaultSite(
    @Param('appId') appId: string,
    @Param('ehrName') ehrName: string,
    @Param('siteId') siteId: string,
    @Query('appType') ehrAppType: string | undefined,
    @CurrentUser() user: any,
  ) {
    const prisma = db.getClient();

    const site = await prisma.ehrSiteConfig.findFirst({
      where: {
        id: siteId,
        isActive: true,
        ehrAccess: {
          applicationId: appId,
          ehrName,
          ...(ehrAppType ? { ehrAppType } : {}),
          application: { organizationId: user.orgId },
        },
      },
    });
    if (!site) throw new BadRequestException('Site not found or not active');

    // Unset current default, set new one
    await prisma.$transaction([
      prisma.ehrSiteConfig.updateMany({
        where: { ehrAccessId: site.ehrAccessId, isDefault: true },
        data: { isDefault: false },
      }),
      prisma.ehrSiteConfig.update({
        where: { id: siteId },
        data: { isDefault: true },
      }),
    ]);

    logger.info('EHR site set as default', { appId, ehrName, siteId });
    return { message: `Site "${site.name}" set as default` };
  }

  /** Helper: find AppEhrAccess with org boundary check */
  private async findEhrAccess(prisma: any, appId: string, ehrName: string, orgId: string, ehrAppType?: string) {
    const app = await prisma.application.findFirst({
      where: { id: appId, organizationId: orgId },
      select: { id: true },
    });
    if (!app) throw new BadRequestException('Application not found');

    const access = await prisma.appEhrAccess.findFirst({
      where: { applicationId: appId, ehrName, ...(ehrAppType ? { ehrAppType } : {}) },
      select: { id: true },
    });
    if (!access) throw new BadRequestException('EHR access not found');

    return access;
  }

  // ─── JWK Management (Secrets Manager) ──────────────────────
  // One JWK per (app, ehr) — deployment env is implicit from the running instance.

  @Put('applications/:appId/ehr/:ehrName/jwks')
  @AllowTokenTypes('session')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload JWK private key set for an EHR (stored in AWS Secrets Manager)' })
  async uploadJwks(
    @Param('appId') appId: string,
    @Param('ehrName') ehrName: string,
    @Body() body: { jwks: any },
    @CurrentUser() user: any,
  ) {
    const prisma = db.getClient();
    const app = await prisma.application.findFirst({
      where: { id: appId, organizationId: user.orgId },
      select: { id: true },
    });
    if (!app) throw new BadRequestException('Application not found');

    // Validate JWKS structure
    const jwks = body.jwks;
    if (!jwks || !jwks.keys || !Array.isArray(jwks.keys) || jwks.keys.length === 0) {
      throw new BadRequestException('Invalid JWKS: must be a JSON object with a non-empty "keys" array');
    }

    // Validate first key has required private key fields
    const firstKey = jwks.keys[0];
    if (!firstKey.kty) {
      throw new BadRequestException('Invalid JWK: missing "kty" (key type) field');
    }
    if (firstKey.kty === 'RSA' && !firstKey.d) {
      throw new BadRequestException('Invalid JWK: RSA key is missing private key component "d"');
    }
    if (firstKey.kty === 'EC' && !firstKey.d) {
      throw new BadRequestException('Invalid JWK: EC key is missing private key component "d"');
    }

    const secretKey = jwkSecretKey(appId, ehrName);
    await secrets.putSecretValue(secretKey, JSON.stringify(jwks));

    logger.info('JWK uploaded to Secrets Manager', { appId, ehrName });
    return { message: 'JWK private key set uploaded successfully' };
  }

  @Get('applications/:appId/ehr/:ehrName/jwks/status')
  @AllowTokenTypes('session')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check if JWK is configured for an EHR (does not return the key)' })
  async getJwksStatus(@Param('appId') appId: string, @Param('ehrName') ehrName: string, @CurrentUser() user: any) {
    const prisma = db.getClient();
    const app = await prisma.application.findFirst({
      where: { id: appId, organizationId: user.orgId },
      select: { id: true },
    });
    if (!app) throw new BadRequestException('Application not found');

    const secretKey = jwkSecretKey(appId, ehrName);
    try {
      const jwks = await secrets.getSecretValue<{ keys: any[] }>(secretKey);
      const firstKey = jwks?.keys?.[0];
      return {
        configured: true,
        keyType: firstKey?.kty || 'unknown',
        algorithm: firstKey?.alg || 'unknown',
        keyId: firstKey?.kid || null,
      };
    } catch {
      return { configured: false };
    }
  }

  @Delete('applications/:appId/ehr/:ehrName/jwks')
  @AllowTokenTypes('session')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete JWK private key set for an EHR from Secrets Manager' })
  async deleteJwks(@Param('appId') appId: string, @Param('ehrName') ehrName: string, @CurrentUser() user: any) {
    const prisma = db.getClient();
    const app = await prisma.application.findFirst({
      where: { id: appId, organizationId: user.orgId },
      select: { id: true },
    });
    if (!app) throw new BadRequestException('Application not found');

    const secretKey = jwkSecretKey(appId, ehrName);
    await secrets.deleteSecretValue(secretKey);

    logger.info('JWK deleted from Secrets Manager', { appId, ehrName });
    return { message: 'JWK private key set deleted' };
  }

  // ─── Unified Lookup (internal services + external clients with org boundary) ──

  /**
   * Unified site lookup. Accepts different query params:
   *   ?siteId=xxx                          — direct site lookup
   *   ?integrationId=xxx&tenant=yyy        — find by integration + tenant (Cerner, eCW, Greenways)
   *   ?integrationId=xxx&accountId=yyy     — find by integration + accountId (AthenaNet, MEDENT)
   *   ?integrationId=xxx&siteId_ehr=yyy    — find by integration + NextGen siteId
   *
   * Returns flat merged siteData ready for FHIR calls.
   */
  @Get('lookup/site')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lookup site by siteId or integration + vendor identifier' })
  async lookupSite(
    @Query('siteId') siteId: string | undefined,
    @Query('integrationId') integrationId: string | undefined,
    @Query('tenant') tenant: string | undefined,
    @Query('accountId') accountId: string | undefined,
    @CurrentUser() user: any,
  ) {
    const prisma = db.getClient();
    const orgAppFilter = user?.isInternalService
      ? { status: 'ACTIVE' as const }
      : { status: 'ACTIVE' as const, organizationId: user?.orgId };

    const siteSelect = {
      id: true,
      name: true,
      siteIdentifiers: true,
      siteCredentials: true,
      siteUrls: true,
      isDefault: true,
      isActive: true,
      isApproved: true,
      ehrAccess: {
        select: {
          id: true,
          ehrName: true,
          ehrConfig: true,
          ehrTokenScopes: true,
          applicationId: true,
          application: { select: { organizationId: true } },
        },
      },
    };

    let site: any = null;

    if (siteId) {
      // Direct lookup by siteId
      site = await prisma.ehrSiteConfig.findFirst({
        where: {
          id: siteId,
          isActive: true,
          isApproved: true,
          status: 'ACTIVE',
          ehrAccess: { status: 'ACTIVE', application: orgAppFilter },
        },
        select: siteSelect,
      });
    } else if (integrationId && (tenant || accountId)) {
      // Lookup by integration + vendor identifier in siteIdentifiers JSON
      const identifierFilter: any[] = [];
      if (tenant) identifierFilter.push({ siteIdentifiers: { path: ['tenant'], equals: tenant } });
      if (accountId) identifierFilter.push({ siteIdentifiers: { path: ['accountId'], equals: accountId } });

      site = await prisma.ehrSiteConfig.findFirst({
        where: {
          ehrAccessId: integrationId,
          isActive: true,
          isApproved: true,
          status: 'ACTIVE',
          OR: identifierFilter,
          ehrAccess: { status: 'ACTIVE', application: orgAppFilter },
        },
        select: siteSelect,
      });
    } else {
      throw new BadRequestException('Provide siteId, or integrationId with tenant/accountId');
    }

    if (!site) throw new BadRequestException('Site not found');

    // Build flat merged siteData
    const ehrConfig = site.ehrAccess.ehrConfig as Record<string, any>;
    return {
      integrationId: site.ehrAccess.id,
      siteId: site.id,
      organizationId: site.ehrAccess.application.organizationId,
      ehrName: site.ehrAccess.ehrName,
      appType: ehrConfig.appType || 'system',
      ehrTokenScopes: site.ehrAccess.ehrTokenScopes,
      applicationId: site.ehrAccess.applicationId,
      ...ehrConfig,
      ...(site.siteIdentifiers as Record<string, any>),
      ...(site.siteCredentials ? (site.siteCredentials as Record<string, any>) : {}),
      ...(site.siteUrls ? (site.siteUrls as Record<string, any>) : {}),
    };
  }

  /**
   * Unified application lookup. Accepts:
   *   ?id=xxx         — lookup by application UUID
   *   ?clientId=xxx   — lookup by OAuth client_id
   */
  @Get('lookup/application')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lookup application by id or clientId' })
  async lookupApplication(
    @Query('id') id: string | undefined,
    @Query('clientId') clientId: string | undefined,
    @CurrentUser() user: any,
  ) {
    if (!id && !clientId) throw new BadRequestException('Provide id or clientId');

    const prisma = db.getClient();
    const orgFilter = user?.isInternalService ? {} : { organizationId: user?.orgId };

    const app = await prisma.application.findFirst({
      where: { ...(id ? { id } : { clientId }), status: 'ACTIVE', ...orgFilter },
      select: {
        id: true,
        organizationId: true,
        clientType: true,
        smartLaunchUrl: true,
        jwks: true,
        clientId: true,
        clientSecretHash: true,
        status: true,
        allowedGrantTypes: true,
        scopes: true,
        tokenLifetime: true,
        name: true,
      },
    });
    if (!app) throw new BadRequestException('Application not found');
    return app;
  }

  /**
   * Unified integration lookup. Accepts:
   *   ?applicationId=xxx&ehrName=yyy   — by app + EHR
   *   ?clientId=xxx&ehrName=yyy        — by clientId + EHR
   */
  @Get('lookup/integration')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lookup integration by applicationId/clientId + ehrName' })
  async lookupIntegration(
    @Query('applicationId') applicationId: string | undefined,
    @Query('clientId') clientId: string | undefined,
    @Query('ehrName') ehrName: string,
    @Query('ehrAppType') ehrAppType: string | undefined,
    @CurrentUser() user: any,
  ) {
    if (!ehrName) throw new BadRequestException('ehrName is required');

    const prisma = db.getClient();
    const orgFilter = user?.isInternalService ? {} : { organizationId: user?.orgId };

    // Resolve applicationId from clientId if needed
    let appId = applicationId;
    if (!appId && clientId) {
      const app = await prisma.application.findFirst({
        where: { clientId, ...orgFilter },
        select: { id: true },
      });
      if (!app) throw new BadRequestException('Application not found');
      appId = app.id;
    }
    if (!appId) throw new BadRequestException('Provide applicationId or clientId');

    const appFilter = user?.isInternalService ? {} : { application: { organizationId: user?.orgId } };
    const ehrAccess = await prisma.appEhrAccess.findFirst({
      where: { applicationId: appId, ehrName, status: 'ACTIVE', ...(ehrAppType ? { ehrAppType } : {}), ...appFilter },
      select: {
        id: true,
        ehrConfig: true,
        ehrTokenScopes: true,
        sites: {
          select: {
            id: true,
            name: true,
            siteIdentifiers: true,
            siteCredentials: true,
            siteUrls: true,
            isActive: true,
            isApproved: true,
            isDefault: true,
          },
        },
      },
    });
    if (!ehrAccess) throw new BadRequestException('Integration not found');
    return ehrAccess;
  }

  // ─── Provider Access Management (app + site level) ─────────
  // Providers are scoped to sites. Apps (API tokens) can read their own
  // sites + providers (without credentials). Session users manage access.

  @Get('applications/:appId/sites/:siteId/providers')
  @AllowTokenTypes('session', 'api')
  @ApiOperation({ summary: 'List providers for a site' })
  async listProviders(@Param('appId') appId: string, @Param('siteId') siteId: string, @CurrentUser() user: any) {
    const prisma = db.getClient();
    // External API tokens must match the target app. Internal services bypass this.
    if (user.isApiToken && !user.isInternalService && user.appId !== appId) {
      throw new BadRequestException('Access denied — token does not belong to this application');
    }
    const orgFilter = user.isInternalService
      ? {}
      : user.isApiToken
        ? {} // already verified appId matches above
        : { application: { organizationId: user.orgId } };

    const site = await prisma.ehrSiteConfig.findFirst({
      where: { id: siteId, ehrAccess: { applicationId: appId, ...orgFilter } },
      include: { ehrAccess: { select: { providerRestriction: true } } },
    });
    if (!site) throw new BadRequestException('Site not found');

    const providers = await prisma.ehrProviderAccess.findMany({
      where: { siteId, isActive: true },
      select: {
        id: true,
        providerFhirId: true,
        providerName: true,
        providerEmail: true,
        providerNpi: true,
        isApproved: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return { providerRestriction: site.ehrAccess.providerRestriction, providers };
  }

  @Post('applications/:appId/sites/:siteId/providers')
  @ApiOperation({ summary: 'Add a provider to a site (internal auto-create or admin manual)' })
  async createProvider(
    @Param('appId') appId: string,
    @Param('siteId') siteId: string,
    @Body()
    body: {
      providerFhirId: string;
      providerName?: string;
      providerEmail?: string;
      providerNpi?: string;
      isApproved?: boolean;
    },
    @CurrentUser() user: any,
  ) {
    const prisma = db.getClient();
    // External API tokens must match the target app. Internal services bypass this.
    if (user.isApiToken && !user.isInternalService && user.appId !== appId) {
      throw new BadRequestException('Access denied — token does not belong to this application');
    }
    const orgFilter = user.isInternalService
      ? {}
      : user.isApiToken
        ? {}
        : { application: { organizationId: user.orgId } };

    const site = await prisma.ehrSiteConfig.findFirst({
      where: { id: siteId, ehrAccess: { applicationId: appId, ...orgFilter } },
      select: { id: true, ehrAccessId: true },
    });
    if (!site) throw new BadRequestException('Site not found');

    return prisma.ehrProviderAccess.upsert({
      where: {
        ehrAccessId_siteId_providerFhirId: {
          ehrAccessId: site.ehrAccessId,
          siteId,
          providerFhirId: body.providerFhirId,
        },
      },
      create: {
        ehrAccessId: site.ehrAccessId,
        siteId,
        providerFhirId: body.providerFhirId,
        providerName: body.providerName,
        providerEmail: body.providerEmail,
        providerNpi: body.providerNpi,
        isApproved: user.isInternalService ? false : (body.isApproved ?? true),
      },
      update: {
        ...(body.providerName && { providerName: body.providerName }),
        ...(body.providerEmail && { providerEmail: body.providerEmail }),
        ...(body.providerNpi && { providerNpi: body.providerNpi }),
        ...(body.isApproved !== undefined && { isApproved: body.isApproved }),
      },
    });
  }

  @Put('applications/:appId/sites/:siteId/providers/:providerId')
  @AllowTokenTypes('session')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Approve or update a provider' })
  async updateProvider(
    @Param('appId') appId: string,
    @Param('siteId') siteId: string,
    @Param('providerId') providerId: string,
    @Body() body: { isApproved?: boolean; isActive?: boolean },
    @CurrentUser() user: any,
  ) {
    const prisma = db.getClient();
    const provider = await prisma.ehrProviderAccess.findFirst({
      where: {
        id: providerId,
        siteId,
        ehrAccess: { applicationId: appId, application: { organizationId: user.orgId } },
      },
    });
    if (!provider) throw new BadRequestException('Provider not found');

    return prisma.ehrProviderAccess.update({
      where: { id: providerId },
      data: {
        ...(body.isApproved !== undefined && { isApproved: body.isApproved }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
      },
    });
  }

  @Delete('applications/:appId/sites/:siteId/providers/:providerId')
  @AllowTokenTypes('session')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Remove a provider (hard delete)' })
  async removeProvider(
    @Param('appId') appId: string,
    @Param('siteId') siteId: string,
    @Param('providerId') providerId: string,
    @CurrentUser() user: any,
  ) {
    const prisma = db.getClient();
    const provider = await prisma.ehrProviderAccess.findFirst({
      where: {
        id: providerId,
        siteId,
        ehrAccess: { applicationId: appId, application: { organizationId: user.orgId } },
      },
    });
    if (!provider) throw new BadRequestException('Provider not found');

    await prisma.ehrProviderAccess.delete({ where: { id: providerId } });
    return { deleted: true };
  }
}

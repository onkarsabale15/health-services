import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import * as bcrypt from 'bcrypt';
import { db } from '@hs/infra';
import { cache } from '@hs/infra';
import { logger } from '@hs/observability';
import { getAppTypeDefinition } from '@hs/config';
import { AdminCacheKeys } from '../../cache/cache-keys';
import { AdminCacheTTL } from '../../cache/cache-ttl';
import { JwksService } from './jwks.service';

const VALID_APP_TYPES = ['BRIDGE', 'CDS', 'WORKFLOW', 'CUSTOM', 'PARTNER', 'MCP'] as const;

export class CreateApplicationDto {
  @ApiProperty({ example: 'My Application' })
  name!: string;

  @ApiPropertyOptional({ example: ['authorization_code', 'refresh_token'] })
  allowedGrantTypes?: string[];

  @ApiPropertyOptional({ example: ['openid', 'profile'] })
  scopes?: string[];

  @ApiPropertyOptional({ example: 3600 })
  tokenLifetime?: number;

  @ApiPropertyOptional({ example: 'BRIDGE' })
  appType?: string;

  @ApiPropertyOptional({ example: 'public' })
  clientType?: string;

  @ApiPropertyOptional({ example: 'https://app.example.com/launch' })
  smartLaunchUrl?: string;

  @ApiPropertyOptional({ example: ['https://app.example.com/callback'] })
  redirectUris?: string[];

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  cdsConfig?: Record<string, any>;
}

export class UpdateApplicationDto {
  @ApiPropertyOptional({ example: 'Updated Application Name' })
  name?: string;

  @ApiPropertyOptional({ example: ['authorization_code'] })
  allowedGrantTypes?: string[];

  @ApiPropertyOptional({ example: ['openid'] })
  scopes?: string[];

  @ApiPropertyOptional({ example: 7200 })
  tokenLifetime?: number;

  @ApiPropertyOptional({ example: 'BRIDGE' })
  appType?: string;

  @ApiPropertyOptional({ example: 'confidential' })
  clientType?: string;

  @ApiPropertyOptional({ example: 'https://app.example.com/launch' })
  smartLaunchUrl?: string;

  @ApiPropertyOptional({ example: ['https://app.example.com/callback'] })
  redirectUris?: string[];

  @ApiPropertyOptional({ example: 'open', enum: ['closed', 'open', 'domain-locked'] })
  autoProvisioningPolicy?: 'closed' | 'open' | 'domain-locked';

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  cdsConfig?: Record<string, any>;
}

@Injectable()
export class ApplicationService {
  constructor(private readonly jwksService: JwksService) {}

  private generateClientId(): string {
    return `ci_${randomBytes(16).toString('hex')}`;
  }

  private generateClientSecret(): string {
    return `cs_${randomBytes(32).toString('hex')}`;
  }

  async listApplications(user: any, page = 1, limit = 50) {
    const prisma = db.getClient();
    const take = Math.min(limit, 200);
    const skip = (page - 1) * take;

    if (user.role === 'OWNER' || user.role === 'ADMIN') {
      const where = { organizationId: user.orgId };
      const [apps, total] = await Promise.all([
        prisma.application.findMany({
          where,
          include: { ehrAccess: true },
          orderBy: { createdAt: 'desc' },
          take,
          skip,
        }),
        prisma.application.count({ where }),
      ]);
      return {
        data: apps.map((app) => ({ ...app, userAccessLevel: 'FULL' })),
        total,
        page,
        limit: take,
      };
    }

    const where = { userId: user.id, application: { organizationId: user.orgId } };
    const [accessEntries, total] = await Promise.all([
      prisma.userAppAccess.findMany({
        where,
        include: { application: { include: { ehrAccess: true } } },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      prisma.userAppAccess.count({ where }),
    ]);

    return {
      data: accessEntries.map((a) => ({ ...a.application, userAccessLevel: a.accessLevel })),
      total,
      page,
      limit: take,
    };
  }

  async createApplication(params: CreateApplicationDto, user: any) {
    const prisma = db.getClient();

    const existing = await prisma.application.findFirst({
      where: { name: params.name, organizationId: user.orgId },
    });
    if (existing) {
      throw new BadRequestException('An application with this name already exists');
    }

    const appType = params.appType || 'BRIDGE';
    if (!VALID_APP_TYPES.includes(appType as any)) {
      throw new BadRequestException(`Invalid appType. Must be one of: ${VALID_APP_TYPES.join(', ')}`);
    }

    const typeDef = getAppTypeDefinition(appType);
    if (typeDef?.requiresSmartLaunchUrl && !params.smartLaunchUrl) {
      throw new BadRequestException(`smartLaunchUrl is required for ${appType} applications`);
    }

    const grantTypes = params.allowedGrantTypes || typeDef?.defaultGrantTypes || ['client_credentials'];
    if (typeDef) {
      const invalid = grantTypes.filter((g) => !typeDef.allowedGrantTypes.includes(g));
      if (invalid.length > 0) {
        throw new BadRequestException(`Grant type(s) not allowed for ${appType}: ${invalid.join(', ')}`);
      }
    }

    const hasClientCreds = grantTypes.includes('client_credentials');
    const hasJwtBearer = grantTypes.includes('urn:ietf:params:oauth:grant-type:jwt-bearer');
    if (hasClientCreds && hasJwtBearer) {
      throw new BadRequestException(
        'Choose one auth method: Client Secret (client_credentials) or JWKS (JWT Bearer). Both cannot be used simultaneously.',
      );
    }

    const clientType = params.clientType || 'CONFIDENTIAL';
    if (!['PUBLIC', 'CONFIDENTIAL'].includes(clientType)) {
      throw new BadRequestException('clientType must be PUBLIC or CONFIDENTIAL');
    }

    const needsSecret = clientType === 'CONFIDENTIAL' && grantTypes.includes('client_credentials');

    const clientId = this.generateClientId();
    let clientSecret: string | undefined;
    let clientSecretHash: string | undefined;

    if (needsSecret) {
      clientSecret = this.generateClientSecret();
      clientSecretHash = await bcrypt.hash(clientSecret, 12);
    }

    const app = await prisma.application.create({
      data: {
        name: params.name,
        organizationId: user.orgId,
        clientId,
        clientSecretHash: clientSecretHash || null,
        allowedGrantTypes: grantTypes,
        scopes: params.scopes || [],
        tokenLifetime: params.tokenLifetime || 3600,
        redirectUris: params.redirectUris || [],
        appType: appType as any,
        clientType: (params.clientType as any) || 'CONFIDENTIAL',
        smartLaunchUrl: params.smartLaunchUrl,
        cdsConfig: params.cdsConfig,
      },
    });

    logger.info('Application created', { appId: app.id, orgId: user.orgId, appType });

    return {
      id: app.id,
      name: app.name,
      clientId: app.clientId,
      ...(clientSecret ? { clientSecret } : {}),
      allowedGrantTypes: app.allowedGrantTypes,
      appType: app.appType,
      smartLaunchUrl: app.smartLaunchUrl,
      tokenLifetime: app.tokenLifetime,
      createdAt: app.createdAt,
    };
  }

  async getApplicationDetail(id: string, user: any) {
    const prisma = db.getClient();
    const app = await prisma.application.findFirst({
      where: { id, organizationId: user.orgId },
      include: { ehrAccess: true },
    });
    if (!app) throw new BadRequestException('Application not found');

    let accessLevel: 'FULL' | 'READONLY' = 'FULL';

    if (user.role !== 'OWNER' && user.role !== 'ADMIN') {
      const access = await prisma.userAppAccess.findUnique({
        where: { userId_applicationId: { userId: user.id, applicationId: id } },
      });
      if (!access) {
        throw new ForbiddenException('You do not have access to this application');
      }
      accessLevel = access.accessLevel as 'FULL' | 'READONLY';
    }

    const result: Record<string, any> = {
      app: { ...app, userAccessLevel: accessLevel },
      ehrAccess: app.ehrAccess,
    };

    if (accessLevel === 'FULL') {
      const [userAccess, orgUsers] = await Promise.all([
        prisma.userAppAccess.findMany({
          where: { applicationId: id },
          include: {
            user: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.user.findMany({
          where: { organizationId: user.orgId, status: 'ACTIVE' },
          select: { id: true, email: true, firstName: true, lastName: true, role: true, status: true },
          orderBy: { firstName: 'asc' },
        }),
      ]);
      result.userAccess = userAccess;
      result.orgUsers = orgUsers;
    }

    return result;
  }

  async getApplication(id: string, user: any) {
    const prisma = db.getClient();
    const app = await prisma.application.findFirst({
      where: { id, organizationId: user.orgId },
      include: { ehrAccess: true },
    });
    if (!app) throw new BadRequestException('Application not found');

    if (user.role === 'OWNER' || user.role === 'ADMIN') {
      return { ...app, userAccessLevel: 'FULL' };
    }

    const access = await prisma.userAppAccess.findUnique({
      where: { userId_applicationId: { userId: user.id, applicationId: id } },
    });
    if (!access) {
      throw new ForbiddenException('You do not have access to this application');
    }

    return { ...app, userAccessLevel: access.accessLevel };
  }

  async updateApplication(id: string, params: UpdateApplicationDto, user: any) {
    const prisma = db.getClient();

    if (params.name) {
      const duplicate = await prisma.application.findFirst({
        where: { name: params.name, organizationId: user.orgId, id: { not: id } },
      });
      if (duplicate) {
        throw new BadRequestException('An application with this name already exists');
      }
    }

    if (params.appType && !VALID_APP_TYPES.includes(params.appType as any)) {
      throw new BadRequestException(`Invalid appType. Must be one of: ${VALID_APP_TYPES.join(', ')}`);
    }

    if (params.appType === 'WORKFLOW') {
      const ehrCount = await prisma.appEhrAccess.count({
        where: { applicationId: id, status: 'ACTIVE' },
      });
      if (ehrCount > 1) {
        throw new BadRequestException(
          'Cannot change to WORKFLOW type: application has more than 1 EHR connection. Remove extra EHR connections first.',
        );
      }
    }

    if (params.allowedGrantTypes) {
      const hasClientCreds = params.allowedGrantTypes.includes('client_credentials');
      const hasJwtBearer = params.allowedGrantTypes.includes('urn:ietf:params:oauth:grant-type:jwt-bearer');
      if (hasClientCreds && hasJwtBearer) {
        throw new BadRequestException(
          'Choose one auth method: Client Secret (client_credentials) or JWKS (JWT Bearer). Both cannot be used simultaneously.',
        );
      }
    }

    const app = await prisma.application.findFirst({
      where: { id, organizationId: user.orgId },
      select: { id: true },
    });
    if (!app) throw new BadRequestException('Application not found');

    const updated = await prisma.application.update({
      where: { id: app.id },
      data: {
        ...(params.name && { name: params.name }),
        ...(params.allowedGrantTypes && { allowedGrantTypes: params.allowedGrantTypes }),
        ...(params.scopes && { scopes: params.scopes }),
        ...(params.tokenLifetime && { tokenLifetime: params.tokenLifetime }),
        ...(params.appType && { appType: params.appType as any }),
        ...(params.clientType && { clientType: params.clientType as any }),
        ...(params.smartLaunchUrl !== undefined && { smartLaunchUrl: params.smartLaunchUrl }),
        ...(params.redirectUris !== undefined && { redirectUris: params.redirectUris }),
        ...(params.autoProvisioningPolicy !== undefined && {
          autoProvisioningPolicy: params.autoProvisioningPolicy,
        }),
        ...(params.cdsConfig !== undefined && { cdsConfig: params.cdsConfig }),
      },
    });

    if (updated.clientId) {
      await cache.del(AdminCacheKeys.appMeta(updated.clientId)).catch(() => {});
      await cache.del(AdminCacheKeys.appJwks(updated.clientId)).catch(() => {});
    }

    return updated;
  }

  async rotateSecret(id: string, user: any) {
    const prisma = db.getClient();
    const app = await prisma.application.findFirst({
      where: { id, organizationId: user.orgId },
      select: { id: true },
    });
    if (!app) throw new BadRequestException('Application not found');

    const clientSecret = this.generateClientSecret();
    const clientSecretHash = await bcrypt.hash(clientSecret, 12);

    await prisma.application.update({
      where: { id: app.id },
      data: { clientSecretHash },
    });

    return { clientSecret };
  }

  async updateJwks(id: string, jwksUri: string, user: any) {
    if (!jwksUri) {
      throw new BadRequestException('jwksUri is required');
    }

    const jwksData = await this.jwksService.fetchJwksFromUri(jwksUri);

    const prisma = db.getClient();
    const app = await prisma.application.findFirst({
      where: { id, organizationId: user.orgId },
      select: { clientId: true },
    });
    if (!app) throw new BadRequestException('Application not found');

    await prisma.application.update({
      where: { id },
      data: { jwks: jwksData as any },
    });

    await cache.set(AdminCacheKeys.appJwks(app.clientId), jwksData, AdminCacheTTL.APP_JWKS);

    logger.info('JWKS updated from URI', { appId: id, uri: jwksUri, keyCount: jwksData.keys.length });

    return {
      message: 'JWKS fetched and stored',
      uri: jwksData.uri,
      keyCount: jwksData.keys.length,
      keys: jwksData.keys.map((k: any, i: number) => ({
        index: i,
        kty: k.kty,
        alg: k.alg,
        kid: k.kid,
        use: k.use,
      })),
    };
  }

  async refreshJwks(id: string, user: any) {
    const prisma = db.getClient();
    const app = await prisma.application.findFirst({
      where: { id, organizationId: user.orgId },
    });
    if (!app) throw new BadRequestException('Application not found');

    const currentJwks = app.jwks as any;
    if (!currentJwks?.uri) {
      throw new BadRequestException('No JWKS URI configured. Set one first via PATCH /jwks');
    }

    const jwksData = await this.jwksService.fetchJwksFromUri(currentJwks.uri);

    await prisma.application.update({
      where: { id },
      data: { jwks: jwksData as any },
    });

    await cache.set(AdminCacheKeys.appJwks(app.clientId), jwksData, AdminCacheTTL.APP_JWKS);

    logger.info('JWKS refreshed from URI', { appId: id, uri: currentJwks.uri, keyCount: jwksData.keys.length });

    return {
      message: 'JWKS refreshed',
      uri: jwksData.uri,
      keyCount: jwksData.keys.length,
    };
  }

  async removeJwks(id: string, user: any) {
    const prisma = db.getClient();
    const app = await prisma.application.findFirst({
      where: { id, organizationId: user.orgId },
      select: { clientId: true },
    });
    if (!app) throw new BadRequestException('Application not found');

    await prisma.application.update({
      where: { id },
      data: { jwks: {} as any },
    });

    await cache.del(AdminCacheKeys.appJwks(app.clientId));

    logger.info('JWKS removed', { appId: id });
    return { message: 'JWKS removed' };
  }

  async enableApplication(id: string, user: any) {
    const prisma = db.getClient();
    const app = await prisma.application.findFirst({
      where: { id, organizationId: user.orgId, status: 'DISABLED' },
      select: { id: true },
    });
    if (!app) throw new BadRequestException('Application not found or already active');

    await prisma.application.update({
      where: { id: app.id },
      data: { status: 'ACTIVE' },
    });
    logger.info('Application re-enabled', { appId: id });
    return { message: 'Application enabled' };
  }

  async listAppAccess(id: string, user: any) {
    const prisma = db.getClient();
    const app = await prisma.application.findFirst({
      where: { id, organizationId: user.orgId },
    });
    if (!app) throw new BadRequestException('Application not found');

    return prisma.userAppAccess.findMany({
      where: { applicationId: id },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async disableApplication(id: string, user: any) {
    const prisma = db.getClient();
    const app = await prisma.application.findFirst({
      where: { id, organizationId: user.orgId },
      select: { id: true },
    });
    if (!app) throw new BadRequestException('Application not found');

    await prisma.application.update({
      where: { id: app.id },
      data: { status: 'DISABLED' },
    });
    return { message: 'Application disabled' };
  }
}

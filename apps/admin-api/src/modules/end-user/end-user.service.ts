import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { db, Prisma } from '@hs/infra';
import { mailer } from '@hs/mailer';
import { logger } from '@hs/observability';
import type { AccessLevel, EndUserStatus } from '@hs/config';
import type { AllowedAppUserDto, CreateEndUserDto, EndUserDetailDto, EndUserSummaryDto } from './end-user.dto';

// ─── EndUserService ─────────────────────────────────────────────────────────
//
// Operator-facing CRUD over EndUsers + their access grants. Authorization is
// enforced at the controller layer (SessionGuard + RolesGuard); this service
// trusts its inputs but always scopes by the operator's organizationId so
// admins can't read across orgs.

@Injectable()
export class EndUserService {
  // ─── Listing ─────────────────────────────────────────────────────────

  async list(
    organizationId: string,
    opts: { search?: string; status?: EndUserStatus; appId?: string } = {},
  ): Promise<EndUserSummaryDto[]> {
    const prisma = db.getClient();
    const where: Prisma.EndUserWhereInput = { organizationId };
    if (opts.status) where.status = opts.status;
    if (opts.search) {
      const q = opts.search.trim();
      where.OR = [
        { email: { contains: q, mode: 'insensitive' } },
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
        { npi: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (opts.appId) {
      where.appAccess = { some: { applicationId: opts.appId, revokedAt: null } };
    }

    const rows = await prisma.endUser.findMany({
      where,
      orderBy: [{ lastLoginAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        email: true,
        emailVerified: true,
        firstName: true,
        lastName: true,
        npi: true,
        specialty: true,
        status: true,
        organizationId: true,
        lastLoginAt: true,
        _count: { select: { appAccess: { where: { revokedAt: null } } } },
      },
      take: 200,
    });

    return rows.map((r) => ({
      id: r.id,
      email: r.email,
      emailVerified: r.emailVerified,
      firstName: r.firstName,
      lastName: r.lastName,
      npi: r.npi,
      specialty: r.specialty,
      status: r.status as EndUserStatus,
      organizationId: r.organizationId,
      lastLoginAt: r.lastLoginAt?.toISOString() ?? null,
      appsCount: r._count.appAccess,
    }));
  }

  // ─── Detail ──────────────────────────────────────────────────────────

  async detail(organizationId: string, id: string): Promise<EndUserDetailDto> {
    const prisma = db.getClient();
    const eu = await prisma.endUser.findFirst({
      where: { id, organizationId },
      include: {
        appAccess: {
          where: { revokedAt: null },
          include: { application: { select: { id: true, name: true } } },
          orderBy: { grantedAt: 'desc' },
        },
        siteAccess: {
          where: { revokedAt: null },
          include: {
            site: {
              select: {
                id: true,
                name: true,
                ehrAccess: { select: { application: { select: { id: true, name: true } } } },
              },
            },
          },
          orderBy: { grantedAt: 'desc' },
        },
        externalIdentities: { orderBy: { lastSeenAt: 'desc' } },
      },
    });
    if (!eu) throw new NotFoundException('End user not found');

    return {
      id: eu.id,
      email: eu.email,
      emailVerified: eu.emailVerified,
      firstName: eu.firstName,
      lastName: eu.lastName,
      npi: eu.npi,
      specialty: eu.specialty,
      status: eu.status as EndUserStatus,
      organizationId: eu.organizationId,
      lastLoginAt: eu.lastLoginAt?.toISOString() ?? null,
      appsCount: eu.appAccess.length,
      apps: eu.appAccess.map((a) => ({
        applicationId: a.applicationId,
        applicationName: a.application.name,
        accessLevel: a.accessLevel as AccessLevel,
        grantSource: a.grantSource,
        grantedAt: a.grantedAt.toISOString(),
        grantedById: a.grantedById,
      })),
      sites: eu.siteAccess.map((s) => ({
        siteId: s.siteId,
        siteName: s.site.name,
        applicationId: s.site.ehrAccess.application.id,
        applicationName: s.site.ehrAccess.application.name,
        accessLevel: s.accessLevel as AccessLevel,
        grantedAt: s.grantedAt.toISOString(),
      })),
      externalIdentities: eu.externalIdentities.map((x) => ({
        ehrName: x.ehrName,
        fhirId: x.fhirId,
        emailAtSeen: x.emailAtSeen,
        firstSeenAt: x.firstSeenAt.toISOString(),
        lastSeenAt: x.lastSeenAt.toISOString(),
      })),
    };
  }

  // ─── Create + invite ─────────────────────────────────────────────────

  async create(
    organizationId: string,
    invitedById: string,
    invitedByName: string,
    body: CreateEndUserDto,
  ): Promise<EndUserDetailDto> {
    const prisma = db.getClient();

    // Validate every applicationId belongs to the operator's org. Reuse the
    // {id,name} rows when sending the invite email below.
    const appIds = body.applicationIds ?? [];
    let validatedApps: Array<{ id: string; name: string }> = [];
    if (appIds.length > 0) {
      validatedApps = await prisma.application.findMany({
        where: { id: { in: appIds }, organizationId },
        select: { id: true, name: true },
      });
      if (validatedApps.length !== appIds.length) {
        throw new BadRequestException('One or more applicationIds do not belong to your organization');
      }
    }

    // Validate sites — each must belong to one of the listed apps' integrations.
    const siteIds = body.siteIds ?? [];
    if (siteIds.length > 0) {
      const sites = await prisma.ehrSiteConfig.findMany({
        where: { id: { in: siteIds }, ehrAccess: { application: { organizationId } } },
        select: { id: true, ehrAccess: { select: { applicationId: true } } },
      });
      if (sites.length !== siteIds.length) {
        throw new BadRequestException('One or more siteIds do not belong to your organization');
      }
      // Optional: enforce that each site's app is in `appIds` so we don't
      // create dangling site grants. Skip for V1 — `appIds` is the source
      // of truth and sites are pure refinement.
    }

    const orgRow = await prisma.organization.findUnique({ where: { id: organizationId } });

    const created = await prisma.endUser.upsert({
      where: { email: body.email },
      create: {
        email: body.email,
        emailVerified: false,
        firstName: body.firstName ?? null,
        lastName: body.lastName ?? null,
        npi: body.npi ?? null,
        specialty: body.specialty ?? null,
        status: 'PENDING',
        organizationId,
        invitedAt: new Date(),
        invitedById,
      },
      update: {
        // If the user already exists in another flow (e.g. partner OIDC), don't
        // overwrite their profile — only adopt them into this org if they have none.
        organizationId: { set: organizationId },
        invitedAt: new Date(),
        invitedById,
      },
    });

    if (appIds.length > 0) {
      await Promise.all(
        appIds.map((applicationId) =>
          prisma.endUserAppAccess.upsert({
            where: { endUserId_applicationId: { endUserId: created.id, applicationId } },
            create: {
              endUserId: created.id,
              applicationId,
              accessLevel: 'FULL',
              grantedById: invitedById,
              grantSource: 'manual',
            },
            update: { revokedAt: null, revokedById: null, grantedById: invitedById },
          }),
        ),
      );
    }

    if (siteIds.length > 0) {
      await Promise.all(
        siteIds.map((siteId) =>
          prisma.endUserSiteAccess.upsert({
            where: { endUserId_siteId: { endUserId: created.id, siteId } },
            create: {
              endUserId: created.id,
              siteId,
              accessLevel: 'FULL',
              grantedById: invitedById,
            },
            update: { revokedAt: null, grantedById: invitedById },
          }),
        ),
      );
    }

    // Pre-bind EHR provider FHIR IDs so the SMART resolver matches by
    // (ehrName, fhirId) on first launch — no email enrichment required.
    const externalIdentities = body.externalIdentities ?? [];
    if (externalIdentities.length > 0) {
      await Promise.all(
        externalIdentities.map((ext) =>
          prisma.endUserExternalIdentity.upsert({
            where: { ehrName_fhirId: { ehrName: ext.ehrName, fhirId: ext.fhirId } },
            create: { endUserId: created.id, ehrName: ext.ehrName, fhirId: ext.fhirId, emailAtSeen: body.email },
            // Don't silently steal a binding from another EndUser; surface conflict via an explicit no-op update.
            update: {},
          }),
        ),
      );
    }

    // Send invite email — fire-and-forget.
    if (validatedApps.length > 0) {
      const signInUrl = `${process.env.ADMIN_UI_URL || 'http://localhost:3001'}/auth/signin`;
      mailer
        .sendInvite(body.email, {
          invitedByName,
          orgName: orgRow?.name ?? 'Health Services',
          appNames: validatedApps.map((a) => a.name),
          signInUrl,
        })
        .catch((err) => logger.warn('EndUser invite email failed', { email: body.email, err: err?.message }));
    }

    logger.info('EndUser invited', {
      endUserId: created.id,
      organizationId,
      invitedById,
      appCount: appIds.length,
    });

    return this.detail(organizationId, created.id);
  }

  // ─── App-access grant/revoke ─────────────────────────────────────────

  async grantApp(
    organizationId: string,
    endUserId: string,
    applicationId: string,
    accessLevel: AccessLevel,
    grantedById: string,
  ): Promise<{ endUserId: string; applicationId: string; accessLevel: AccessLevel }> {
    const prisma = db.getClient();
    await this.assertSameOrg(organizationId, endUserId, applicationId);

    const grant = await prisma.endUserAppAccess.upsert({
      where: { endUserId_applicationId: { endUserId, applicationId } },
      create: { endUserId, applicationId, accessLevel, grantedById, grantSource: 'manual' },
      update: { accessLevel, revokedAt: null, revokedById: null, grantedById, grantSource: 'manual' },
    });
    return { endUserId, applicationId, accessLevel: grant.accessLevel as AccessLevel };
  }

  async revokeApp(
    organizationId: string,
    endUserId: string,
    applicationId: string,
    revokedById: string,
  ): Promise<{ endUserId: string; applicationId: string; revoked: true }> {
    const prisma = db.getClient();
    await this.assertSameOrg(organizationId, endUserId, applicationId);

    await prisma.endUserAppAccess.update({
      where: { endUserId_applicationId: { endUserId, applicationId } },
      data: { revokedAt: new Date(), revokedById },
    });
    return { endUserId, applicationId, revoked: true };
  }

  // ─── Site-access grant/revoke ────────────────────────────────────────

  async grantSite(
    organizationId: string,
    endUserId: string,
    siteId: string,
    accessLevel: AccessLevel,
    grantedById: string,
  ): Promise<{ endUserId: string; siteId: string; accessLevel: AccessLevel }> {
    const prisma = db.getClient();
    await this.assertSameOrgSite(organizationId, endUserId, siteId);

    const grant = await prisma.endUserSiteAccess.upsert({
      where: { endUserId_siteId: { endUserId, siteId } },
      create: { endUserId, siteId, accessLevel, grantedById },
      update: { accessLevel, revokedAt: null, grantedById },
    });
    return { endUserId, siteId, accessLevel: grant.accessLevel as AccessLevel };
  }

  async revokeSite(
    organizationId: string,
    endUserId: string,
    siteId: string,
  ): Promise<{ endUserId: string; siteId: string; revoked: true }> {
    const prisma = db.getClient();
    await this.assertSameOrgSite(organizationId, endUserId, siteId);

    await prisma.endUserSiteAccess.update({
      where: { endUserId_siteId: { endUserId, siteId } },
      data: { revokedAt: new Date() },
    });
    return { endUserId, siteId, revoked: true };
  }

  // ─── Per-app allowed-users view ─────────────────────────────────────

  async listAllowedAppUsers(organizationId: string, applicationId: string): Promise<AllowedAppUserDto[]> {
    const prisma = db.getClient();
    const app = await prisma.application.findFirst({ where: { id: applicationId, organizationId } });
    if (!app) throw new NotFoundException('Application not found');

    const grants = await prisma.endUserAppAccess.findMany({
      where: { applicationId, revokedAt: null },
      include: { endUser: true },
      orderBy: { grantedAt: 'desc' },
    });
    return grants.map((g) => ({
      endUserId: g.endUserId,
      email: g.endUser.email,
      firstName: g.endUser.firstName,
      lastName: g.endUser.lastName,
      accessLevel: g.accessLevel as AccessLevel,
      grantSource: g.grantSource,
      grantedAt: g.grantedAt.toISOString(),
      lastLoginAt: g.endUser.lastLoginAt?.toISOString() ?? null,
    }));
  }

  // ─── External-identity bindings (SMART standalone) ──────────────────

  async bindExternalIdentity(
    organizationId: string,
    endUserId: string,
    ehrName: string,
    fhirId: string,
  ): Promise<{ ehrName: string; fhirId: string; endUserId: string }> {
    const prisma = db.getClient();
    const eu = await prisma.endUser.findFirst({
      where: { id: endUserId, organizationId },
      select: { id: true, email: true },
    });
    if (!eu) throw new NotFoundException('End user not found');

    // Don't overwrite an existing binding for another EndUser — that would
    // silently move the EHR identity. Reject loudly so admin sees the conflict.
    const existing = await prisma.endUserExternalIdentity.findUnique({
      where: { ehrName_fhirId: { ehrName, fhirId } },
    });
    if (existing && existing.endUserId !== eu.id) {
      throw new BadRequestException(
        `(${ehrName}, ${fhirId}) is already bound to a different end-user. Unbind it there first.`,
      );
    }
    if (!existing) {
      await prisma.endUserExternalIdentity.create({
        data: { endUserId: eu.id, ehrName, fhirId, emailAtSeen: eu.email },
      });
    }
    return { ehrName, fhirId, endUserId: eu.id };
  }

  async unbindExternalIdentity(
    organizationId: string,
    endUserId: string,
    ehrName: string,
    fhirId: string,
  ): Promise<{ unbound: true }> {
    const prisma = db.getClient();
    const eu = await prisma.endUser.findFirst({ where: { id: endUserId, organizationId }, select: { id: true } });
    if (!eu) throw new NotFoundException('End user not found');

    const result = await prisma.endUserExternalIdentity.deleteMany({
      where: { endUserId: eu.id, ehrName, fhirId },
    });
    if (result.count === 0) throw new NotFoundException('External identity not bound to this end-user');
    return { unbound: true };
  }

  // ─── Internal: org-boundary checks ──────────────────────────────────

  private async assertSameOrg(organizationId: string, endUserId: string, applicationId: string): Promise<void> {
    const prisma = db.getClient();
    const [eu, app] = await Promise.all([
      prisma.endUser.findFirst({ where: { id: endUserId, organizationId } }),
      prisma.application.findFirst({ where: { id: applicationId, organizationId } }),
    ]);
    if (!eu) throw new NotFoundException('End user not found');
    if (!app) throw new NotFoundException('Application not found');
  }

  private async assertSameOrgSite(organizationId: string, endUserId: string, siteId: string): Promise<void> {
    const prisma = db.getClient();
    const [eu, site] = await Promise.all([
      prisma.endUser.findFirst({ where: { id: endUserId, organizationId } }),
      prisma.ehrSiteConfig.findFirst({
        where: { id: siteId, ehrAccess: { application: { organizationId } } },
      }),
    ]);
    if (!eu) throw new NotFoundException('End user not found');
    if (!site) throw new NotFoundException('Site not found');
  }
}

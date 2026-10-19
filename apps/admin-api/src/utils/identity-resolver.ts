import { ForbiddenException } from '@nestjs/common';
import { db } from '@hs/infra';
import { logger } from '@hs/observability';
import { mailer } from '@hs/mailer';
import type { AutoProvisioningPolicy, ResolveAction } from '@hs/config';

// ─── EndUser identity resolution + auto-provisioning ────────────────────────
//
// Single entry point used by:
//   - bridge-api SMART launch  (via /internal/access/check)
//   - admin-api /oauth/authorize (partner OIDC; first-party skipped)
//   - cds-app  POST /launch/system

export interface ResolveInput {
  ehrName?: string;
  fhirId?: string;
  /**
   * Real email from id_token or Practitioner.telecom. Optional — when omitted,
   * resolution is constrained to the (ehrName, fhirId) cache. A first-launch
   * with no email AND no prior cache hit hits the policy gate (likely 403 +
   * admin notification), since we have no canonical identity to match on.
   */
  email?: string;
  applicationId: string;
  siteId?: string;
}

export interface ResolveResult {
  endUserId: string;
  action: ResolveAction;
}

/** Skip writing lastLoginAt/lastSeenAt if it was touched in the past 5 minutes. */
const TOUCH_THROTTLE_MS = 5 * 60 * 1000;

/**
 * Resolve the EHR-vouched / OTP-verified user to an internal `EndUser`,
 * enforcing the application's autoProvisioningPolicy. Throws
 * `ForbiddenException` on policy denial. Side effects:
 *   - Caches the (ehrName, fhirId) → endUser mapping on first observation.
 *   - Auto-creates EndUser + EndUserAppAccess when policy permits.
 *   - Sends an admin-notification email when policy denies (best-effort).
 */
export async function resolveOrAutoProvision(input: ResolveInput): Promise<ResolveResult> {
  const prisma = db.getClient();
  const { ehrName, fhirId, email, applicationId, siteId } = input;

  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      name: true,
      organizationId: true,
      autoProvisioningPolicy: true,
      organization: { select: { domain: true } },
    },
  });
  if (!app) {
    throw new ForbiddenException({ error: 'unknown_application', message: 'Application not found' });
  }
  const policy = (app.autoProvisioningPolicy as AutoProvisioningPolicy) ?? 'closed';
  const orgDomain = app.organization?.domain ?? null;

  let endUser = await findEndUser({ ehrName, fhirId, email });

  if (!endUser) {
    return provisionForUnknownUser({ app, policy, orgDomain, email, ehrName, fhirId });
  }

  if (endUser.status !== 'ACTIVE') {
    throw new ForbiddenException({
      error: 'account_disabled',
      message: 'Your account is not active. Contact your administrator.',
    });
  }

  // Bind this EHR identity to the existing EndUser the first time we see it.
  if (ehrName && fhirId) {
    await prisma.endUserExternalIdentity
      .upsert({
        where: { ehrName_fhirId: { ehrName, fhirId } },
        create: { endUserId: endUser.id, ehrName, fhirId, emailAtSeen: email },
        update: { lastSeenAt: new Date() },
      })
      .catch((err) => logger.warn('Failed to upsert external identity', { endUserId: endUser!.id, err: err?.message }));
  }

  const appAccess = await prisma.endUserAppAccess.findUnique({
    where: { endUserId_applicationId: { endUserId: endUser.id, applicationId: app.id } },
  });

  if (!appAccess || appAccess.revokedAt) {
    return provisionGrantForExistingUser({ app, policy, orgDomain, endUser, email, ehrName });
  }

  await assertSiteAccess(endUser.id, siteId);

  if (shouldTouchLastLogin(endUser.lastLoginAt)) {
    prisma.endUser
      .update({ where: { id: endUser.id }, data: { lastLoginAt: new Date() } })
      .catch((err) => logger.warn('Failed to touch lastLoginAt', { endUserId: endUser!.id, err: err?.message }));
  }

  return { endUserId: endUser.id, action: 'matched' };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

type LoadedApp = {
  id: string;
  name: string;
  organizationId: string;
  autoProvisioningPolicy: string;
};

type LoadedEndUser = {
  id: string;
  email: string;
  status: string;
  lastLoginAt: Date | null;
};

async function findEndUser(input: {
  ehrName?: string;
  fhirId?: string;
  email?: string;
}): Promise<LoadedEndUser | null> {
  const prisma = db.getClient();
  if (input.ehrName && input.fhirId) {
    const ext = await prisma.endUserExternalIdentity.findUnique({
      where: { ehrName_fhirId: { ehrName: input.ehrName, fhirId: input.fhirId } },
      include: { endUser: { select: { id: true, email: true, status: true, lastLoginAt: true } } },
    });
    if (ext?.endUser) return ext.endUser;
  }
  // Email is the canonical EndUser identity. Without it, we have no way to
  // match an admin-invited user — drop through and let the policy gate decide.
  if (!input.email) return null;
  return prisma.endUser.findUnique({
    where: { email: input.email },
    select: { id: true, email: true, status: true, lastLoginAt: true },
  });
}

async function provisionForUnknownUser(args: {
  app: LoadedApp;
  policy: AutoProvisioningPolicy;
  orgDomain: string | null;
  email?: string;
  ehrName?: string;
  fhirId?: string;
}): Promise<ResolveResult> {
  const { app, policy, orgDomain, email, ehrName, fhirId } = args;

  // No email = no canonical identity. Auto-provisioning is impossible regardless
  // of policy; the EHR couldn't supply one and Practitioner enrichment failed.
  // Surface this to admins so they can either fix the EHR config or pre-invite.
  if (!email) {
    await notifyAdminOfPendingAccess(app, '(unknown — EHR provided no email)', ehrName).catch(() => {});
    throw new ForbiddenException({
      error: 'access_pending',
      message: `Your account is not authorized for ${app.name}. The EHR did not provide an email — contact your administrator.`,
    });
  }

  const verdict = evaluatePolicy(policy, email, orgDomain);
  if (verdict === 'reject') {
    await notifyAdminOfPendingAccess(app, email, ehrName).catch(() => {});
    throw new ForbiddenException({
      error: 'access_pending',
      message: `Your account is not authorized for ${app.name}. An administrator has been notified.`,
    });
  }

  const prisma = db.getClient();
  const created = await prisma.endUser.create({
    data: { email, emailVerified: true, status: 'ACTIVE', organizationId: app.organizationId, lastLoginAt: new Date() },
  });
  if (ehrName && fhirId) {
    await prisma.endUserExternalIdentity.create({
      data: { endUserId: created.id, ehrName, fhirId, emailAtSeen: email },
    });
  }
  await prisma.endUserAppAccess.create({
    data: {
      endUserId: created.id,
      applicationId: app.id,
      accessLevel: 'FULL',
      grantSource: grantSourceFor(verdict),
    },
  });
  logger.info('EndUser auto-provisioned', { endUserId: created.id, applicationId: app.id, grantSource: verdict });
  return { endUserId: created.id, action: actionFor(verdict) };
}

async function provisionGrantForExistingUser(args: {
  app: LoadedApp;
  policy: AutoProvisioningPolicy;
  orgDomain: string | null;
  endUser: LoadedEndUser;
  email?: string;
  ehrName?: string;
}): Promise<ResolveResult> {
  const { app, policy, orgDomain, endUser, email, ehrName } = args;
  // Use the EndUser's stored email for policy decisions when the inbound
  // request lacks one (e.g. SMART launch with no Practitioner.email and a
  // (ehrName, fhirId) cache hit).
  const evaluationEmail = email ?? endUser.email;
  const verdict = evaluatePolicy(policy, evaluationEmail, orgDomain);
  if (verdict === 'reject') {
    await notifyAdminOfPendingAccess(app, evaluationEmail, ehrName).catch(() => {});
    throw new ForbiddenException({
      error: 'access_denied',
      message: `Your account is not authorized for ${app.name}.`,
    });
  }
  const prisma = db.getClient();
  const grantSource = grantSourceFor(verdict);
  await prisma.endUserAppAccess.upsert({
    where: { endUserId_applicationId: { endUserId: endUser.id, applicationId: app.id } },
    create: { endUserId: endUser.id, applicationId: app.id, accessLevel: 'FULL', grantSource },
    update: { revokedAt: null, revokedById: null, grantSource },
  });
  return { endUserId: endUser.id, action: actionFor(verdict) };
}

async function assertSiteAccess(endUserId: string, siteId?: string): Promise<void> {
  if (!siteId) return;
  const prisma = db.getClient();
  // siteCount==0 means the user has app-wide access — no narrowing required.
  const siteCount = await prisma.endUserSiteAccess.count({ where: { endUserId, revokedAt: null } });
  if (siteCount === 0) return;
  const siteGrant = await prisma.endUserSiteAccess.findUnique({
    where: { endUserId_siteId: { endUserId, siteId } },
  });
  if (!siteGrant || siteGrant.revokedAt) {
    throw new ForbiddenException({
      error: 'site_access_denied',
      message: 'Your account is not authorized for this site.',
    });
  }
}

function shouldTouchLastLogin(lastLoginAt: Date | null): boolean {
  if (!lastLoginAt) return true;
  return Date.now() - lastLoginAt.getTime() > TOUCH_THROTTLE_MS;
}

// ─── Policy evaluation ──────────────────────────────────────────────────────

type PolicyVerdict = 'auto-open' | 'auto-domain' | 'reject';

function evaluatePolicy(policy: AutoProvisioningPolicy, email: string, orgDomain: string | null): PolicyVerdict {
  if (policy === 'open') return 'auto-open';
  if (policy === 'domain-locked') {
    if (!orgDomain) return 'reject';
    const emailDomain = email.split('@')[1]?.toLowerCase();
    return emailDomain && emailDomain === orgDomain.toLowerCase() ? 'auto-domain' : 'reject';
  }
  return 'reject';
}

function grantSourceFor(verdict: 'auto-open' | 'auto-domain'): string {
  return verdict === 'auto-open' ? 'auto-open' : 'auto-domain';
}

function actionFor(verdict: 'auto-open' | 'auto-domain'): ResolveAction {
  return verdict === 'auto-open' ? 'auto-created-open' : 'auto-created-domain';
}

// ─── Admin notification on rejected access ──────────────────────────────────

async function notifyAdminOfPendingAccess(
  app: { id: string; name: string; organizationId: string },
  requesterEmail: string,
  ehrName?: string,
): Promise<void> {
  const prisma = db.getClient();
  const admins = await prisma.user.findMany({
    where: { organizationId: app.organizationId, role: { in: ['OWNER', 'ADMIN'] }, status: 'ACTIVE' },
    select: { email: true },
    take: 10,
  });
  if (admins.length === 0) return;

  const adminUiUrl = process.env.ADMIN_UI_URL || 'http://localhost:3001';
  const reviewUrl = `${adminUiUrl}/dashboard/end-users?email=${encodeURIComponent(requesterEmail)}`;

  await Promise.allSettled(
    admins.map((a) => mailer.sendAccessPending(a.email, { requesterEmail, appName: app.name, ehrName, reviewUrl })),
  );
}

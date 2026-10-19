import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { db } from '@hs/infra';
import { logger } from '@hs/observability';
import type { ProviderSession, PatientContext } from '../../services/session.service';
import type { CdsCard } from '../../engine';
import { CdsResourceProviderFactory } from '../providers/cds-resource-provider.factory';
import { buildProviderContext } from '../providers/base/provider-context';

// ─── Domain types ──────────────────────────────────────────

/** Care plan lifecycle states. Mirrors Prisma enum `CarePlanStatus`. */
type Status = 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'REVOKED';

/** Identifies a provider acting on a care plan (for audit fields). */
interface ProviderRef {
  fhirId: string;
  name: string;
}

interface CreateCarePlanInput {
  title: string;
  cards: CdsCard[];
  providerName?: string;
  providerFhirId?: string;
  status?: Status;
  parentId?: string;
  /** Format: "ai:{provider}:{model}" (e.g. "ai:anthropic:claude-opus-4-6") or "manual" */
  generatedBy?: string;
}

interface UpdateCarePlanInput {
  title?: string;
  cards?: CdsCard[];
}

/** Reason strings used when a re-analysis supersedes an older version. */
const SUPERSEDED_REASON = (version: number) => `Superseded by version ${version}`;

@Injectable()
export class CarePlanService {
  constructor(private readonly providerFactory: CdsResourceProviderFactory) {}

  /**
   * Versioning: when `parentId` is provided, increments version, links to
   * the parent, and auto-revokes the parent with an audit trail.
   */
  async create(providerSession: ProviderSession, patientContext: PatientContext, input: CreateCarePlanInput) {
    const prisma = db.getClient();

    const ctx = buildProviderContext({ providerSession, patientContext });
    const provider = this.providerFactory.get(providerSession.ehrName);

    const [patient, encounter] = await Promise.all([
      provider.getPatient(ctx).catch(() => null),
      patientContext.encounterId
        ? provider.getEncounter(ctx, patientContext.encounterId).catch(() => null)
        : Promise.resolve(null),
    ]);

    const version = await this.nextVersion(input.parentId);

    const carePlan = await prisma.carePlan.create({
      data: {
        applicationId: providerSession.applicationId,
        siteId: providerSession.siteId || null,
        patientFhirId: patientContext.patientId,
        encounterFhirId: patientContext.encounterId || null,
        ehrName: providerSession.ehrName,
        title: input.title,
        status: input.status || 'DRAFT',
        cards: input.cards as unknown as object,
        providerName: input.providerName || providerSession.providerName || null,
        providerFhirId: input.providerFhirId || providerSession.providerFhirId || null,
        generatedBy: input.generatedBy || null,
        patientName: patient?.fullName || null,
        encounterType: encounter?.type || null,
        encounterDate: encounter?.startDate ? new Date(encounter.startDate) : null,
        version,
        parentId: input.parentId || null,
      },
    });

    // Re-analysis: auto-revoke the parent with audit trail
    if (input.parentId) {
      await this.autoRevokeParent(input.parentId, providerSession, version);
    }

    logger.info('Care plan created', {
      carePlanId: carePlan.id,
      version,
      parentId: input.parentId || null,
      status: carePlan.status,
    });
    return carePlan;
  }

  /**
   * Edit title and/or cards of a non-revoked care plan. Records the editor.
   * Returns `{ updated, cardsChanged }` so the caller can invalidate downstream caches.
   */
  async update(carePlanId: string, applicationId: string, editor: ProviderRef, input: UpdateCarePlanInput) {
    const carePlan = await this.findForApp(carePlanId, applicationId);
    if (carePlan.status === 'REVOKED') {
      throw new BadRequestException('Cannot edit a revoked care plan');
    }

    const data: { editedBy: string; editedByName: string; title?: string; cards?: CdsCard[] } = {
      editedBy: editor.fhirId,
      editedByName: editor.name,
    };
    if (input.title) data.title = input.title;
    if (input.cards) data.cards = input.cards;

    const updated = await db.getClient().carePlan.update({ where: { id: carePlanId }, data });
    return { updated, cardsChanged: input.cards !== undefined };
  }

  /**
   * Approve a DRAFT care plan — transitions to ACTIVE and records approver.
   * Only DRAFT plans may be approved.
   */
  async approve(carePlanId: string, applicationId: string, approver: ProviderRef) {
    await this.assertStatus(carePlanId, applicationId, 'DRAFT', 'approved');

    const updated = await db.getClient().carePlan.update({
      where: { id: carePlanId },
      data: {
        status: 'ACTIVE',
        approvedBy: approver.fhirId,
        approvedByName: approver.name,
        approvedAt: new Date(),
      },
    });
    logger.info('Care plan approved', { carePlanId, approverFhirId: approver.fhirId });
    return updated;
  }

  /** Mark an ACTIVE care plan as COMPLETED. Only ACTIVE plans may be completed. */
  async complete(carePlanId: string, applicationId: string) {
    await this.assertStatus(carePlanId, applicationId, 'ACTIVE', 'completed');

    const updated = await db.getClient().carePlan.update({
      where: { id: carePlanId },
      data: { status: 'COMPLETED' },
    });
    logger.info('Care plan completed', { carePlanId });
    return updated;
  }

  /**
   * Revoke a care plan with audit trail (who, when, why). Callable from
   * any status except REVOKED. Reason is required.
   *
   * Authorization: revoking a DRAFT plan is the "dismiss" flow available
   * to any session — supports nurses cleaning up an unwanted auto-saved
   * draft. Revoking an ACTIVE plan reverses a clinical decision, so
   * requires the `canApproveCarePlan` capability (matches the gate on
   * `approve`). This isn't a route-level guard because the rule depends
   * on the loaded plan's status, which the controller doesn't see.
   */
  async revoke(
    carePlanId: string,
    applicationId: string,
    revoker: ProviderRef,
    reason: string,
    opts: { canApproveActive: boolean },
  ) {
    const trimmedReason = reason?.trim();
    if (!trimmedReason) {
      throw new BadRequestException('Revocation reason is required');
    }

    const carePlan = await this.findForApp(carePlanId, applicationId);
    if (carePlan.status === 'REVOKED') {
      throw new BadRequestException('Care plan is already revoked');
    }
    if (carePlan.status === 'ACTIVE' && !opts.canApproveActive) {
      throw new ForbiddenException(
        'Only licensed prescribers (MD/DO/NP/PA) can revoke an active care plan. Editing remains available.',
      );
    }

    const updated = await db.getClient().carePlan.update({
      where: { id: carePlanId },
      data: {
        status: 'REVOKED',
        revokedBy: revoker.fhirId,
        revokedByName: revoker.name,
        revokedAt: new Date(),
        revokedReason: trimmedReason,
      },
    });
    logger.info('Care plan revoked', { carePlanId, revokerFhirId: revoker.fhirId, reason: trimmedReason });
    return updated;
  }

  /**
   * Latest care plan for the current session's (patient, encounter). Used by
   * the analysis page to decide whether to render "Generate" or pick up an
   * existing draft. Scope is `applicationId + patientFhirId + encounterFhirId`
   * — explicitly NOT filtered by `providerFhirId`, so any provider on the
   * same site sees the team's in-progress plan. Returns the head of the
   * version chain (highest version, ties broken by `createdAt`); status
   * gating is the FE's job.
   *
   * Returns `null` when no plan exists for this context.
   */
  async findCurrentForSession(providerSession: ProviderSession, patientContext: PatientContext) {
    return db.getClient().carePlan.findFirst({
      where: {
        applicationId: providerSession.applicationId,
        patientFhirId: patientContext.patientId,
        encounterFhirId: patientContext.encounterId ?? null,
        isDeleted: false,
      },
      orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
    });
  }

  /** Generate a title from cards. */
  static generateTitle(cards: CdsCard[]): string {
    const criticalCount = cards.filter((c) => c.severity === 'critical').length;
    return criticalCount > 0
      ? `Care Plan (${criticalCount} critical, ${cards.length} total)`
      : `Care Plan (${cards.length} recommendations)`;
  }

  // ─── Private helpers ────────────────────────────────────

  /** Find a care plan scoped to the app tenant, or throw NotFoundException. */
  private async findForApp(carePlanId: string, applicationId: string) {
    const carePlan = await db.getClient().carePlan.findFirst({
      where: { id: carePlanId, applicationId, isDeleted: false },
      select: { id: true, status: true },
    });
    if (!carePlan) throw new NotFoundException('Care plan not found');
    return carePlan;
  }

  /** Assert the care plan is in the expected status for a transition. */
  private async assertStatus(carePlanId: string, applicationId: string, expected: Status, action: string) {
    const carePlan = await this.findForApp(carePlanId, applicationId);
    if (carePlan.status !== expected) {
      throw new BadRequestException(
        `Only ${expected} care plans can be ${action} (current status: ${carePlan.status})`,
      );
    }
    return carePlan;
  }

  /** Compute next version number based on parent. Returns 1 for new chains. */
  private async nextVersion(parentId: string | undefined): Promise<number> {
    if (!parentId) return 1;
    const parent = await db.getClient().carePlan.findUnique({
      where: { id: parentId },
      select: { version: true },
    });
    return (parent?.version ?? 0) + 1;
  }

  /**
   * Revoke the parent care plan when a new version supersedes it.
   * Best-effort.
   *
   * NOTE: this path intentionally bypasses the explicit-revoke
   * `canApproveActive` gate because it represents an internal
   * supersedence, not a user-initiated revocation. A nurse re-analyzing
   * an ACTIVE plan WILL flip the parent to REVOKED via this path. If
   * the product needs to require prescriber sign-off for re-analysis of
   * ACTIVE plans, gate at `POST /analysis/start` rather than here —
   * blocking a partial supersedence here would leave the chain in an
   * inconsistent state.
   */
  private async autoRevokeParent(parentId: string, revoker: ProviderSession, newVersion: number) {
    try {
      await db.getClient().carePlan.update({
        where: { id: parentId },
        data: {
          status: 'REVOKED',
          revokedBy: revoker.providerFhirId || null,
          revokedByName: revoker.providerName || null,
          revokedAt: new Date(),
          revokedReason: SUPERSEDED_REASON(newVersion),
        },
      });
    } catch (err: unknown) {
      logger.warn('Failed to revoke parent care plan', {
        parentId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

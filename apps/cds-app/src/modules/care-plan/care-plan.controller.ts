import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { db } from '@hs/infra';
import { CdsSessionGuard } from '../../guards/session.guard';
import { CarePlanApprovalGuard } from '../../guards/care-plan-approval.guard';
import { CurrentSession } from '../../decorators/session.decorator';
import type { CdsSession } from '../../services/session.service';
import { CreateCarePlanDto, UpdateCarePlanDto, RevokeCarePlanDto } from './care-plan.dto';
import { CarePlanService } from './care-plan.service';
import { CarePlanPdfService } from './care-plan-pdf.service';

@ApiTags('Care Plans')
@Controller('care-plans')
@UseGuards(CdsSessionGuard)
export class CarePlanController {
  constructor(
    private readonly carePlanService: CarePlanService,
    private readonly carePlanPdfService: CarePlanPdfService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Save a care plan from CDS analysis results' })
  async create(@CurrentSession() session: CdsSession, @Body() dto: CreateCarePlanDto) {
    if (!session.patientContext) throw new BadRequestException('No patient context — re-launch from EHR');

    return this.carePlanService.create(session.providerSession, session.patientContext, {
      title: dto.title,
      cards: dto.cards,
      providerName: dto.providerName,
      providerFhirId: dto.providerFhirId,
      generatedBy: 'manual',
    });
  }

  /**
   * List care plans — provider can browse ALL patients' care plans for this app.
   * Optional ?patientId=current to filter to the currently launched patient.
   */
  @Get()
  @ApiOperation({ summary: 'List care plans (all patients or current patient only)' })
  @ApiQuery({
    name: 'patientId',
    required: false,
    description: '"current" for launched patient, or a specific FHIR patient ID',
  })
  async list(@CurrentSession() session: CdsSession, @Query('patientId') patientIdFilter?: string) {
    const ps = session.providerSession;
    const where: { applicationId: string; isDeleted: boolean; patientFhirId?: string } = {
      applicationId: ps.applicationId,
      isDeleted: false,
    };

    if (patientIdFilter === 'current') {
      if (!session.patientContext) throw new BadRequestException('No patient context');
      where.patientFhirId = session.patientContext.patientId;
    } else if (patientIdFilter) {
      where.patientFhirId = patientIdFilter;
    }

    return db.getClient().carePlan.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  /**
   * Latest care plan for the session's (patient, encounter). Lets the
   * analysis page pick up an existing draft instead of regenerating.
   *
   * Route is registered BEFORE `:id` so `/care-plans/current` doesn't match
   * the dynamic param. Returns 200 with `null` when nothing exists for the
   * context — clients distinguish "no plan yet" from a 404 (which would
   * imply a real error).
   */
  @Get('current')
  @ApiOperation({ summary: 'Get the latest care plan for the current (patient, encounter), or null' })
  async getCurrent(@CurrentSession() session: CdsSession) {
    if (!session.patientContext) throw new BadRequestException('No patient context — re-launch from EHR');
    return this.carePlanService.findCurrentForSession(session.providerSession, session.patientContext);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single care plan' })
  async getById(@CurrentSession() session: CdsSession, @Param('id') id: string) {
    const carePlan = await db.getClient().carePlan.findFirst({
      where: { id, applicationId: session.providerSession.applicationId, isDeleted: false },
    });
    if (!carePlan) throw new NotFoundException('Care plan not found');
    return carePlan;
  }

  /** Get version history for a care plan (all versions in the chain) */
  @Get(':id/versions')
  @ApiOperation({ summary: 'Get version history for a care plan' })
  async getVersions(@CurrentSession() session: CdsSession, @Param('id') id: string) {
    const prisma = db.getClient();
    const appId = session.providerSession.applicationId;
    const MAX_VERSIONS = 50; // prevent unbounded traversal
    type CP = Awaited<ReturnType<typeof prisma.carePlan.findFirst>>;

    // Find the starting care plan (scoped to application)
    let current: CP = await prisma.carePlan.findFirst({
      where: { id, applicationId: appId, isDeleted: false },
    });
    if (!current) throw new NotFoundException('Care plan not found');

    // Walk up to root — always scope to applicationId to prevent cross-app access
    let depth = 0;
    while (current.parentId && depth < MAX_VERSIONS) {
      const parent: CP = await prisma.carePlan.findFirst({
        where: { id: current.parentId, applicationId: appId, isDeleted: false },
      });
      if (!parent) break;
      current = parent;
      depth++;
    }

    // Walk down to get all versions (root → children chain)
    const versions: NonNullable<CP>[] = [current];
    let nextParentId: string | null = current.id;
    while (nextParentId && versions.length < MAX_VERSIONS) {
      const child: CP = await prisma.carePlan.findFirst({
        where: { parentId: nextParentId, applicationId: appId, isDeleted: false },
        orderBy: { createdAt: 'desc' },
      });
      if (!child) break;
      versions.push(child);
      nextParentId = child.id;
    }

    return versions;
  }

  @Post(':id/export-pdf')
  @ApiOperation({ summary: 'Export care plan as PDF, returns signed download URL' })
  async exportPdf(@CurrentSession() session: CdsSession, @Param('id') id: string) {
    return this.carePlanPdfService.exportPdf(id, session.providerSession.applicationId);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update care plan title or cards (does not change status — use /approve, /complete, /revoke)',
  })
  async update(@CurrentSession() session: CdsSession, @Param('id') id: string, @Body() dto: UpdateCarePlanDto) {
    const editor = requireProviderRef(session, 'edit');
    const { updated, cardsChanged } = await this.carePlanService.update(
      id,
      session.providerSession.applicationId,
      editor,
      { title: dto.title, cards: dto.cards },
    );

    if (cardsChanged) {
      this.carePlanPdfService.invalidatePdfCache(id).catch(() => {});
    }
    return updated;
  }

  @Post(':id/approve')
  @UseGuards(CarePlanApprovalGuard)
  @ApiOperation({
    summary:
      'Approve a DRAFT care plan — transitions to ACTIVE with signoff audit. Requires canApproveCarePlan capability.',
  })
  async approve(@CurrentSession() session: CdsSession, @Param('id') id: string) {
    const provider = requireProviderRef(session, 'approve');
    return this.carePlanService.approve(id, session.providerSession.applicationId, provider);
  }

  @Post(':id/complete')
  @ApiOperation({ summary: 'Mark an ACTIVE care plan as COMPLETED' })
  async complete(@CurrentSession() session: CdsSession, @Param('id') id: string) {
    return this.carePlanService.complete(id, session.providerSession.applicationId);
  }

  @Post(':id/revoke')
  @ApiOperation({
    summary:
      'Revoke a care plan with a reason. Anyone can revoke a DRAFT (dismiss); revoking an ACTIVE plan requires canApproveCarePlan.',
  })
  async revoke(@CurrentSession() session: CdsSession, @Param('id') id: string, @Body() dto: RevokeCarePlanDto) {
    const provider = requireProviderRef(session, 'revoke');
    return this.carePlanService.revoke(id, session.providerSession.applicationId, provider, dto.reason, {
      canApproveActive: session.providerSession.providerCapabilities.canApproveCarePlan,
    });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete a care plan' })
  async remove(@CurrentSession() session: CdsSession, @Param('id') id: string) {
    const carePlan = await db.getClient().carePlan.findFirst({
      where: { id, applicationId: session.providerSession.applicationId, isDeleted: false },
    });
    if (!carePlan) throw new NotFoundException('Care plan not found');

    await db.getClient().carePlan.update({ where: { id }, data: { isDeleted: true } });
    return { deleted: true };
  }
}

/**
 * Extract the provider's identity from the session for audit fields.
 * Throws BadRequestException if the session has no provider FHIR ID
 * (e.g., unauthenticated or improperly launched session).
 */
function requireProviderRef(session: CdsSession, action: string): { fhirId: string; name: string } {
  const { providerFhirId, providerName } = session.providerSession;
  if (!providerFhirId) {
    throw new BadRequestException(`Provider identity not available in session — cannot ${action}`);
  }
  return { fhirId: providerFhirId, name: providerName || 'Unknown' };
}

import { Controller, Get, Param, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CdsSessionGuard } from '../../guards/session.guard';
import { CurrentSession } from '../../decorators/session.decorator';
import { SessionService, type CdsSession, type LaunchMode as SessionLaunchMode } from '../../services/session.service';
import { ClinicalDataService } from './clinical-data.service';
import { CdsResourceProviderFactory } from '../providers/cds-resource-provider.factory';
import type { LaunchMode } from '../providers/capabilities';

const SESSION_MODE_MAP: Record<SessionLaunchMode, LaunchMode> = {
  ehr: 'provider-ehr',
  standalone: 'provider-standalone',
  system: 'system',
};

function requirePatientContext(session: CdsSession): void {
  if (!session.patientContext) {
    throw new BadRequestException('No active patient context — re-launch from your EHR');
  }
}

@ApiTags('Clinical Data')
@Controller('clinical-data')
@UseGuards(CdsSessionGuard)
export class ClinicalDataController {
  constructor(
    private readonly clinicalDataService: ClinicalDataService,
    private readonly factory: CdsResourceProviderFactory,
    private readonly sessionService: SessionService,
  ) {}

  @Get('patient')
  @ApiOperation({ summary: 'Get patient demographics' })
  async getPatient(@CurrentSession() session: CdsSession) {
    requirePatientContext(session);
    return this.clinicalDataService.getPatient(session);
  }

  @Get('conditions')
  @ApiOperation({ summary: 'Get conditions (active by default; pass ?includeInactive=true for full history)' })
  async getConditions(@CurrentSession() session: CdsSession, @Query('includeInactive') includeInactive?: string) {
    requirePatientContext(session);
    return this.clinicalDataService.getConditions(session, { includeInactive: includeInactive === 'true' });
  }

  @Get('allergies')
  @ApiOperation({ summary: 'Get allergies (active by default; pass ?includeInactive=true for full history)' })
  async getAllergies(@CurrentSession() session: CdsSession, @Query('includeInactive') includeInactive?: string) {
    requirePatientContext(session);
    return this.clinicalDataService.getAllergies(session, { includeInactive: includeInactive === 'true' });
  }

  @Get('medications')
  @ApiOperation({ summary: 'Get medications (active by default; pass ?includeInactive=true for full history)' })
  async getMedications(@CurrentSession() session: CdsSession, @Query('includeInactive') includeInactive?: string) {
    requirePatientContext(session);
    return this.clinicalDataService.getMedications(session, { includeInactive: includeInactive === 'true' });
  }

  @Get('vitals')
  @ApiOperation({ summary: 'Get recent vitals' })
  async getVitals(@CurrentSession() session: CdsSession) {
    requirePatientContext(session);
    return this.clinicalDataService.getVitals(session);
  }

  @Get('encounters')
  @ApiOperation({ summary: 'Get encounters, optionally filtered by appointment or date' })
  async getEncounters(
    @CurrentSession() session: CdsSession,
    @Query('appointmentId') appointmentId?: string,
    @Query('date') date?: string,
  ) {
    requirePatientContext(session);
    return this.clinicalDataService.getEncounters(session, { appointmentId, date });
  }

  @Get('encounters/:id')
  @ApiOperation({ summary: 'Get a single encounter by ID' })
  async getEncounterById(@CurrentSession() session: CdsSession, @Param('id') id: string) {
    requirePatientContext(session);
    return this.clinicalDataService.getEncounterById(session, id);
  }

  @Get('appointments')
  @ApiOperation({ summary: 'Get upcoming/recent appointments for the current patient' })
  async getAppointments(@CurrentSession() session: CdsSession) {
    requirePatientContext(session);
    return this.clinicalDataService.getAppointments(session);
  }

  @Get('appointments/:id')
  @ApiOperation({ summary: 'Get a single appointment by ID' })
  async getAppointmentById(@CurrentSession() session: CdsSession, @Param('id') id: string) {
    requirePatientContext(session);
    return this.clinicalDataService.getAppointmentById(session, id);
  }

  @Get('practitioner')
  @ApiOperation({ summary: 'Get launched provider details from FHIR Practitioner resource' })
  async getPractitioner(@CurrentSession() session: CdsSession) {
    const result = await this.clinicalDataService.getPractitioner(session);
    // Self-healing role hydration. Launch defaults `providerRole` to
    // `support`; on the FE's first /practitioner call after mount we
    // upgrade the session role from authoritative qualification codes.
    // No-op if role is already non-`support`. Awaited so the next
    // /clinical-data/session call (FE follows /practitioner with a
    // session refresh) sees the updated role.
    if (result?.qualifications) {
      await this.sessionService.hydrateRoleFromQualifications(
        session.providerSession.providerSessionId,
        result.qualifications,
      );
    }
    return result;
  }

  /**
   * Session bootstrap — returns provider + patient context + a thin
   * `operations` map for cross-resource ops that don't bind to a single
   * endpoint (today: `careplan.generate`).
   *
   * Per-resource capabilities (allowAdd / categories / encounterBound)
   * live on every list/detail response envelope — UI consumers read them
   * from the resource the button acts on, not from session. Don't add
   * resource-scoped flags here.
   */
  @Get('session')
  @ApiOperation({ summary: 'Get current session info (provider + patient context + cross-resource ops)' })
  async getSessionInfo(@CurrentSession() session: CdsSession) {
    const ps = session.providerSession;
    const pc = session.patientContext;
    const mode = SESSION_MODE_MAP[ps.launchMode];
    const provider = this.factory.tryGet(ps.ehrName);
    const operations = provider?.getCapabilities(mode).operations ?? null;

    return {
      provider: {
        fhirId: ps.providerFhirId || null,
        name: ps.providerName || null,
        /**
         * Descriptive role — for display, audit, analytics. UI MUST NOT
         * gate actions on this directly; read the matching flag on
         * `capabilities` instead.
         */
        role: ps.providerRole,
        /**
         * Action-scoped capability flags. Drives FE gating of clinical
         * sign-off actions. The BE is the source of truth —
         * `CarePlanApprovalGuard` re-enforces server-side.
         */
        capabilities: ps.providerCapabilities,
      },
      ehrName: ps.ehrName,
      launchMode: ps.launchMode,
      currentPatient: pc ? { patientId: pc.patientId, encounterId: pc.encounterId } : null,
      operations,
    };
  }
}

import { Controller, Post, Put, Param, Body, UseGuards, BadRequestException, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CdsSessionGuard } from '../../guards/session.guard';
import { CurrentSession } from '../../decorators/session.decorator';
import type { CdsSession } from '../../services/session.service';
import { ClinicalWriteService } from './clinical-write.service';
import { ConditionBodyBuilder, readExistingCategory } from './condition-body.builder';
import type { ConditionWriteRules } from '../providers/capabilities/capability.types';
import { toFhirReference } from '../../utils/fhir-reference';
import {
  ConditionRequestDto,
  CreateAllergyDto,
  CreateObservationDto,
  CreateAppointmentDto,
  CreateEncounterDto,
  FhirResourceDto,
  type FhirAppointmentParticipant,
} from './clinical-write.dto';

/**
 * FHIR write endpoints for clinical data.
 * Server-side enforces subject.reference to prevent cross-patient writes.
 * Audit tracing handled automatically by OTel instrumentation.
 */
@ApiTags('Clinical Write')
@Controller('clinical-data')
@UseGuards(CdsSessionGuard)
export class ClinicalWriteController {
  constructor(
    private readonly writeService: ClinicalWriteService,
    private readonly conditionBuilder: ConditionBodyBuilder,
  ) {}

  @Post('conditions')
  @ApiOperation({
    summary: 'Create a condition for the current patient',
    description:
      'Accepts a lean domain request (selected concept + state + optional ' +
      'severity / dates / note). The backend assembles the full FHIR ' +
      'Condition body — the client never touches FHIR URIs or HL7 code values.',
  })
  async createCondition(@CurrentSession() session: CdsSession, @Body() request: ConditionRequestDto) {
    const rules = this.requireConditionRules(session);
    const allowed = rules.create.perCategory?.[request.category]?.allowedStates ?? rules.create.allowedStates;
    if (!allowed.includes(request.state)) {
      throw new BadRequestException(
        `State '${request.state}' is not allowed on create for category '${request.category}'. ` +
          `Allowed: ${allowed.join(', ')}.`,
      );
    }

    const body = this.conditionBuilder.buildCreate(request, rules);
    return this.writeService.createResource(session, 'Condition', this.bindToSessionPatient(session, body));
  }

  @Put('conditions/:id')
  @ApiOperation({
    summary: 'Update a condition for the current patient',
    description:
      'Fetch-then-merge: pulls the existing FHIR Condition, layers the new ' +
      'authoritative clinical fields (status, severity, dates, notes) on ' +
      'top, and PUTs the merged body. Identity fields (code, category) are ' +
      'pulled from the existing resource as defense-in-depth — record a ' +
      'new Condition to switch problem-list-item ↔ encounter-diagnosis. ' +
      'Notes append to the existing `note[]` timeline.',
  })
  async updateCondition(
    @CurrentSession() session: CdsSession,
    @Param('id') id: string,
    @Body() request: ConditionRequestDto,
  ) {
    const rules = this.requireConditionRules(session);
    const existing = await this.writeService.readResource(session, 'Condition', id);
    if (!existing) {
      throw new NotFoundException(`Condition ${id} not found`);
    }
    // Validate the target state against the EHR's update rules. Use the
    // existing resource's category (not the request's — category is immutable
    // for write-back; the form forbids editing it) so the per-category
    // override matches what the EHR will actually validate against.
    const existingCategory = readExistingCategory(existing);
    const allowedUpdate =
      (existingCategory ? rules.update.perCategory?.[existingCategory]?.allowedStates : undefined) ??
      rules.update.allowedStates ??
      rules.create.allowedStates;
    if (!allowedUpdate.includes(request.state)) {
      throw new BadRequestException(
        `State '${request.state}' is not allowed on update` +
          (existingCategory ? ` for category '${existingCategory}'` : '') +
          `. Allowed: ${allowedUpdate.join(', ')}.`,
      );
    }
    const fhirId = session.providerSession.providerFhirId;
    const practitionerRef = fhirId ? toFhirReference(fhirId, 'Practitioner') : undefined;
    const body = this.conditionBuilder.buildUpdate(id, request, existing, rules, practitionerRef);
    return this.writeService.updateResource(session, 'Condition', id, this.bindToSessionPatient(session, body));
  }

  @Post('allergies')
  @ApiOperation({ summary: 'Create an allergy for the current patient' })
  async createAllergy(@CurrentSession() session: CdsSession, @Body() body: CreateAllergyDto) {
    return this.writeService.createResource(
      session,
      'AllergyIntolerance',
      this.bindPatientTo(session, body, 'patient'),
    );
  }

  @Post('observations')
  @ApiOperation({ summary: 'Create an observation for the current patient' })
  async createObservation(@CurrentSession() session: CdsSession, @Body() body: CreateObservationDto) {
    return this.writeService.createResource(session, 'Observation', this.bindToSessionPatient(session, body));
  }

  @Post('appointments')
  @ApiOperation({ summary: 'Create an appointment for the current patient' })
  async createAppointment(@CurrentSession() session: CdsSession, @Body() body: CreateAppointmentDto) {
    this.requirePatientContext(session);
    const participants: FhirAppointmentParticipant[] = Array.isArray(body.participant) ? body.participant : [];
    const patientRef = `Patient/${session.patientContext!.patientId}`;

    // Ensure patient is in participant list — strip any other patient refs
    const cleanedParticipants = participants.filter((p) => {
      const ref = p?.actor?.reference;
      return !ref || !ref.startsWith('Patient/') || ref === patientRef;
    });
    const hasPatient = cleanedParticipants.some((p) => p?.actor?.reference === patientRef);
    if (!hasPatient) {
      cleanedParticipants.push({ actor: { reference: patientRef }, status: 'accepted' });
    }

    return this.writeService.createResource(session, 'Appointment', { ...body, participant: cleanedParticipants });
  }

  @Post('encounters')
  @ApiOperation({ summary: 'Create an encounter for the current patient' })
  async createEncounter(@CurrentSession() session: CdsSession, @Body() body: CreateEncounterDto) {
    return this.writeService.createResource(session, 'Encounter', this.bindToSessionPatient(session, body));
  }

  // ── Patient binding enforcement ───────────────────────────

  /** Inject subject.reference pointing to the session patient. Overrides any client-provided value. */
  private bindToSessionPatient(session: CdsSession, body: FhirResourceDto): Record<string, unknown> {
    this.requirePatientContext(session);
    return {
      ...body,
      subject: { reference: `Patient/${session.patientContext!.patientId}` },
    };
  }

  /** Inject a named patient reference field (e.g., AllergyIntolerance uses `patient` not `subject`). */
  private bindPatientTo(
    session: CdsSession,
    body: FhirResourceDto,
    field: 'patient' | 'subject',
  ): Record<string, unknown> {
    this.requirePatientContext(session);
    return {
      ...body,
      [field]: { reference: `Patient/${session.patientContext!.patientId}` },
    };
  }

  private requirePatientContext(session: CdsSession): void {
    if (!session.patientContext) throw new BadRequestException('No patient context');
  }

  /** Resolve Condition write rules from the active provider, or 400 if not declared. */
  private requireConditionRules(session: CdsSession): ConditionWriteRules {
    const caps = this.writeService.getCapabilities(session);
    if (!caps.condition) {
      throw new BadRequestException(`Condition writes are not configured for ${caps.ehrName}.`);
    }
    return caps.condition;
  }
}

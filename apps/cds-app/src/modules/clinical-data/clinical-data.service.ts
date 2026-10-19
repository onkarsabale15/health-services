import { Injectable } from '@nestjs/common';
import type { CdsSession } from '../../services/session.service';
import { CdsResourceProviderFactory } from '../providers/cds-resource-provider.factory';
import {
  EnvelopeBuilderService,
  type PatientResponseEnvelope,
  type ResponseEnvelope,
} from '../providers/envelope-builder.service';
import { buildProviderContext } from '../providers/base/provider-context';
import type {
  AllergySummary,
  AppointmentSummary,
  ConditionSummary,
  EncounterSummary,
  MedicationSummary,
  PatientSummary,
  PractitionerSummary,
  VitalSummary,
} from './fhir-mappers';

/**
 * Thin delegation layer over `CdsResourceProvider`. Resolves the right
 * provider for the session's EHR, calls it, then wraps the result in the
 * standard response envelope (data + capabilities + meta).
 *
 * Per-EHR quirks live in the providers, not here. Capability flags live in
 * `apps/cds-app/src/modules/providers/capabilities/`. Bridge calls live in
 * `BaseFhirProvider`. This service knows none of that — it only orchestrates.
 */
@Injectable()
export class ClinicalDataService {
  constructor(
    private readonly factory: CdsResourceProviderFactory,
    private readonly envelope: EnvelopeBuilderService,
  ) {}

  async getPatient(session: CdsSession): Promise<PatientResponseEnvelope<PatientSummary | null>> {
    const ctx = buildProviderContext(session);
    const provider = this.factory.get(session.providerSession.ehrName);
    const data = await provider.getPatient(ctx);
    return this.envelope.wrapPatient(data, ctx);
  }

  async getEncounterById(session: CdsSession, id: string): Promise<ResponseEnvelope<EncounterSummary | null>> {
    const ctx = buildProviderContext(session);
    const provider = this.factory.get(session.providerSession.ehrName);
    const data = await provider.getEncounter(ctx, id);
    return this.envelope.wrap(data, ctx, 'Encounter');
  }

  async getAppointmentById(session: CdsSession, id: string): Promise<ResponseEnvelope<AppointmentSummary | null>> {
    const ctx = buildProviderContext(session);
    const provider = this.factory.get(session.providerSession.ehrName);
    const data = await provider.getAppointment(ctx, id);
    return this.envelope.wrap(data, ctx, 'Appointment');
  }

  async getConditions(
    session: CdsSession,
    options?: { includeInactive?: boolean },
  ): Promise<ResponseEnvelope<ConditionSummary[]>> {
    const ctx = buildProviderContext(session);
    const provider = this.factory.get(session.providerSession.ehrName);
    const data = await provider.listConditions(ctx, options);
    return this.envelope.wrap(data, ctx, 'Condition');
  }

  async getAllergies(
    session: CdsSession,
    options?: { includeInactive?: boolean },
  ): Promise<ResponseEnvelope<AllergySummary[]>> {
    const ctx = buildProviderContext(session);
    const provider = this.factory.get(session.providerSession.ehrName);
    const data = await provider.listAllergies(ctx, options);
    return this.envelope.wrap(data, ctx, 'AllergyIntolerance');
  }

  async getMedications(
    session: CdsSession,
    options?: { includeInactive?: boolean },
  ): Promise<ResponseEnvelope<MedicationSummary[]>> {
    const ctx = buildProviderContext(session);
    const provider = this.factory.get(session.providerSession.ehrName);
    const data = await provider.listMedications(ctx, options);
    return this.envelope.wrap(data, ctx, 'MedicationStatement');
  }

  async getVitals(session: CdsSession): Promise<ResponseEnvelope<VitalSummary[]>> {
    const ctx = buildProviderContext(session);
    const provider = this.factory.get(session.providerSession.ehrName);
    const data = await provider.listVitals(ctx);
    return this.envelope.wrap(data, ctx, 'Observation');
  }

  async getEncounters(
    session: CdsSession,
    filters?: { appointmentId?: string; date?: string },
  ): Promise<ResponseEnvelope<EncounterSummary[]>> {
    const ctx = buildProviderContext(session);
    const provider = this.factory.get(session.providerSession.ehrName);
    const data = await provider.listEncounters(ctx, filters);
    return this.envelope.wrap(data, ctx, 'Encounter');
  }

  async getAppointments(session: CdsSession): Promise<ResponseEnvelope<AppointmentSummary[]>> {
    const ctx = buildProviderContext(session);
    const provider = this.factory.get(session.providerSession.ehrName);
    const data = await provider.listAppointments(ctx);
    return this.envelope.wrap(data, ctx, 'Appointment');
  }

  async getPractitioner(session: CdsSession): Promise<PractitionerSummary | null> {
    const ctx = buildProviderContext(session);
    const provider = this.factory.get(session.providerSession.ehrName);
    return provider.getPractitioner(ctx);
  }
}

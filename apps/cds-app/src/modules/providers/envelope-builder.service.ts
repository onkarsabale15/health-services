import { Injectable } from '@nestjs/common';
import { getResourceCapabilities, type ResourceCapabilities, type ResourceType } from './capabilities';
import type { EncounterModel } from './capabilities/capability.types';
import type { ProviderContext } from './base/provider-context';
import { CdsResourceProviderFactory } from './cds-resource-provider.factory';

export interface ResponseEnvelope<T> {
  data: T;
  capabilities: ResourceCapabilities;
  meta: ResponseMeta;
}

export interface ResponseMeta {
  ehrName: string;
  launchMode: string;
  patientId?: string;
  encounterId?: string;
  resource: ResourceType;
}

/**
 * Patient envelope meta is a superset — it carries the linkage IDs and
 * encounter-model flags the patient page needs to drive its fan-out
 * (`useEncounter(id)`, `useAppointment(id)`, `EncounterPicker`). Other
 * endpoints don't need this; keeping it on a separate type avoids polluting
 * the generic meta shape.
 */
export interface PatientResponseMeta extends ResponseMeta {
  appointmentId?: string;
  encounterModel: EncounterModel;
  isEncounterSupported: boolean;
}

export interface PatientResponseEnvelope<T> {
  data: T;
  capabilities: ResourceCapabilities;
  meta: PatientResponseMeta;
}

/**
 * Wraps provider responses in the standard envelope used by every cds-app
 * list/detail endpoint.
 *
 * Capabilities come from the resolved provider's `getCapabilities(mode)` —
 * each EHR class is its own source of truth. Bridge plays no role here;
 * capabilities are CDS's UX-only view of what's possible. Bridge still
 * rejects at call time if the EHR does not support the requested operation.
 */
@Injectable()
export class EnvelopeBuilderService {
  constructor(private readonly factory: CdsResourceProviderFactory) {}

  wrap<T>(data: T, ctx: ProviderContext, resource: ResourceType): ResponseEnvelope<T> {
    const ps = ctx.session.providerSession;
    const pc = ctx.session.patientContext;
    const provider = this.factory.get(ps.ehrName);
    const caps = provider.getCapabilities(ctx.mode);
    return {
      data,
      capabilities: getResourceCapabilities(caps, ctx.mode, resource),
      meta: {
        ehrName: ps.ehrName,
        launchMode: ctx.mode,
        patientId: pc?.patientId,
        encounterId: pc?.encounterId,
        resource,
      },
    };
  }

  /**
   * Patient-specific envelope. The patient endpoint is the orchestrator for
   * the patient view: its meta carries `encounterId`/`appointmentId` so the
   * UI can fan out to the corresponding detail endpoints, and the
   * encounter-model flags so the encounter picker knows whether to render.
   */
  wrapPatient<T>(data: T, ctx: ProviderContext): PatientResponseEnvelope<T> {
    const ps = ctx.session.providerSession;
    const pc = ctx.session.patientContext;
    const provider = this.factory.get(ps.ehrName);
    const caps = provider.getCapabilities(ctx.mode);
    return {
      data,
      capabilities: getResourceCapabilities(caps, ctx.mode, 'Patient'),
      meta: {
        ehrName: ps.ehrName,
        launchMode: ctx.mode,
        patientId: pc?.patientId,
        encounterId: pc?.encounterId,
        appointmentId: pc?.appointmentId,
        encounterModel: caps.encounterModel,
        isEncounterSupported: caps.encounterModel !== 'none',
        resource: 'Patient',
      },
    };
  }
}

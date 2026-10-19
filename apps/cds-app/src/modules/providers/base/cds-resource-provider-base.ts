import { Injectable, Logger } from '@nestjs/common';
import type { FhirResource } from '@hs/bridge-client';
import type {
  CdsResourceProvider,
  FhirWriteBody,
  ListEncountersOptions,
  ListOptions,
} from '../cds-resource-provider.interface';
import type {
  AllergySummary,
  AppointmentSummary,
  ConditionSummary,
  EncounterSummary,
  MedicationSummary,
  PatientSummary,
  PractitionerSummary,
  VitalSummary,
} from '../../clinical-data/fhir-mappers';
import type {
  ClinicalOperation,
  LaunchMode,
  OperationSupport,
  ProviderCapabilities,
} from '../capabilities/capability.types';
import type { ProviderContext } from './provider-context';

const ALL_OPERATIONS: ClinicalOperation[] = [
  'patient.read',
  'patient.search',
  'condition.read',
  'condition.write',
  'allergy.read',
  'allergy.write',
  'observation.read',
  'observation.write',
  'medication.read',
  'appointment.read',
  'appointment.write',
  'encounter.read',
  'encounter.close',
  'careplan.generate',
];

const DEFAULT_UNSUPPORTED: OperationSupport = { supported: false, reason: 'Not implemented for this EHR' };

/**
 * Abstract root of the CDS provider hierarchy.
 *
 * Every method returns the "this EHR doesn't do that" default — empty
 * collections for reads, throws for writes, all-unsupported for
 * `getCapabilities()`. Concrete EHR providers opt in by overriding the
 * methods they implement AND declaring matching capability flags.
 *
 * Why this layer exists separate from `StandardFhirR4Provider`: that class
 * commits to a specific transport (bridge-api FHIR R4 calls). EHRs that
 * need a different transport — proprietary REST APIs, direct vendor SDKs —
 * extend `CdsResourceProviderBase` directly and write their own methods.
 *
 * Capability declaration is the contract; this class never lies about it
 * (always returns "unsupported"). Behavior is also conservative — methods
 * silently no-op or throw, so a misconfigured provider doesn't accidentally
 * succeed against the wrong endpoint.
 */
@Injectable()
export abstract class CdsResourceProviderBase implements CdsResourceProvider {
  abstract readonly ehrName: string;
  protected readonly log = new Logger(this.constructor.name);

  // ── Capability declaration ─────────────────────────────────────────────

  getCapabilities(_mode: LaunchMode): ProviderCapabilities {
    const operations: Record<ClinicalOperation, OperationSupport> = Object.create(null);
    for (const op of ALL_OPERATIONS) operations[op] = DEFAULT_UNSUPPORTED;
    return {
      ehrName: this.ehrName,
      encounterModel: 'none',
      operations,
      conditionCategories: [],
      observationCategories: [],
      appointment: { allowCreate: false, allowDeriveEncounter: false },
      allergy: { requiresVerificationStatus: false },
      encounter: { allowClose: false },
    };
  }

  // ── Reads — default to "no data" ──────────────────────────────────────
  // Concrete subclasses opt in by overriding. The default never fakes
  // success — it just returns nothing, which the envelope reports honestly
  // alongside `supported: false` from getCapabilities.

  async getPatient(_ctx: ProviderContext): Promise<PatientSummary | null> {
    return null;
  }
  async getPractitioner(_ctx: ProviderContext): Promise<PractitionerSummary | null> {
    return null;
  }
  async getEncounter(_ctx: ProviderContext, _id: string): Promise<EncounterSummary | null> {
    return null;
  }
  async getAppointment(_ctx: ProviderContext, _id: string): Promise<AppointmentSummary | null> {
    return null;
  }
  async readResource(
    _ctx: ProviderContext,
    _resourceType: string,
    _id: string,
  ): Promise<Record<string, unknown> | null> {
    return null;
  }
  async listConditions(_ctx: ProviderContext, _options?: ListOptions): Promise<ConditionSummary[]> {
    return [];
  }
  async listAllergies(_ctx: ProviderContext, _options?: ListOptions): Promise<AllergySummary[]> {
    return [];
  }
  async listMedications(_ctx: ProviderContext, _options?: ListOptions): Promise<MedicationSummary[]> {
    return [];
  }
  async listVitals(_ctx: ProviderContext): Promise<VitalSummary[]> {
    return [];
  }
  async listEncounters(_ctx: ProviderContext, _options?: ListEncountersOptions): Promise<EncounterSummary[]> {
    return [];
  }
  async listAppointments(_ctx: ProviderContext): Promise<AppointmentSummary[]> {
    return [];
  }

  // ── Writes — default to "explicit failure" ───────────────────────────
  // Reads silently return empty because that's the natural "no data" answer.
  // Writes throw because there's no equivalent silent answer — if you tried
  // to create something and the EHR doesn't support it, you need to know.

  async createResource(_ctx: ProviderContext, resourceType: string, _body: FhirWriteBody): Promise<FhirResource> {
    throw new Error(`${this.ehrName} does not support creating ${resourceType}`);
  }
  async updateResource(
    _ctx: ProviderContext,
    resourceType: string,
    _id: string,
    _body: FhirWriteBody,
  ): Promise<FhirResource> {
    throw new Error(`${this.ehrName} does not support updating ${resourceType}`);
  }
}

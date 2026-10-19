import type { FhirResource } from '@hs/bridge-client';
import type { ProviderContext } from './base/provider-context';
import type { LaunchMode, ProviderCapabilities } from './capabilities/capability.types';
import type {
  PatientSummary,
  PractitionerSummary,
  EncounterSummary,
  AppointmentSummary,
  ConditionSummary,
  AllergySummary,
  MedicationSummary,
  VitalSummary,
} from '../clinical-data/fhir-mappers';

export interface ListEncountersOptions {
  appointmentId?: string;
  date?: string;
}

/**
 * Shared options for the active-status-aware list endpoints (Conditions,
 * Allergies, Medications). The Clinical Summary 2x2 grid uses the
 * default (active only); the "View all" detail modal opts in to the
 * full list with `includeInactive: true`.
 */
export interface ListOptions {
  includeInactive?: boolean;
}

/** Body shape sent to write methods. Controllers shape these via DTOs first. */
export type FhirWriteBody = Record<string, unknown>;

/**
 * Strategy interface — one implementation per EHR. Most EHRs only need
 * `BaseFhirProvider`; a vendor with real model differences (no encounter
 * model, special operations) gets its own subclass that overrides selected
 * methods.
 *
 * Reads return raw mapped DTOs. Writes accept generic resource bodies (the
 * existing controllers shape these via DTOs / ConditionBodyBuilder before
 * calling the provider). The service layer wraps every result in a response
 * envelope before returning to the controller — providers never construct
 * envelopes themselves.
 */
export interface CdsResourceProvider {
  readonly ehrName: string;

  /**
   * Self-declaration of what this provider implements for the given launch
   * mode. Drives every UX gate (Add/Edit/Delete buttons, category pickers,
   * encounter selectors). Default in `BaseFhirProvider` is everything
   * unsupported — subclasses override to opt in.
   */
  getCapabilities(mode: LaunchMode): ProviderCapabilities;

  // ── Reads ──────────────────────────────────────────────────────────────
  getPatient(ctx: ProviderContext): Promise<PatientSummary | null>;
  getPractitioner(ctx: ProviderContext): Promise<PractitionerSummary | null>;

  /**
   * Detail-by-id reads. Used by the patient page's fan-out: `/patient` meta
   * carries `encounterId`/`appointmentId`, the UI then calls these endpoints
   * directly. Providers without a native encounter model return `null`.
   */
  getEncounter(ctx: ProviderContext, id: string): Promise<EncounterSummary | null>;
  getAppointment(ctx: ProviderContext, id: string): Promise<AppointmentSummary | null>;

  /**
   * Generic raw-FHIR read. Used by update flows that need to fetch the
   * existing resource for merge-then-write semantics (e.g. preserving
   * `recorder`, `asserter`, `bodySite`, and existing `note[]` on a
   * Condition update). Returns the raw resource shape from bridge —
   * callers are responsible for narrowing the unknown fields they touch.
   */
  readResource(ctx: ProviderContext, resourceType: string, id: string): Promise<Record<string, unknown> | null>;

  listConditions(ctx: ProviderContext, options?: ListOptions): Promise<ConditionSummary[]>;
  listAllergies(ctx: ProviderContext, options?: ListOptions): Promise<AllergySummary[]>;
  listMedications(ctx: ProviderContext, options?: ListOptions): Promise<MedicationSummary[]>;
  listVitals(ctx: ProviderContext): Promise<VitalSummary[]>;
  listEncounters(ctx: ProviderContext, options?: ListEncountersOptions): Promise<EncounterSummary[]>;
  listAppointments(ctx: ProviderContext): Promise<AppointmentSummary[]>;

  // ── Writes ─────────────────────────────────────────────────────────────
  // Generic create/update — shaped bodies arrive from the controllers
  // (after DTO validation + ConditionBodyBuilder for Condition). Providers
  // are free to override per-resource methods if they need vendor-specific
  // pre/post-processing.
  createResource(ctx: ProviderContext, resourceType: string, body: FhirWriteBody): Promise<FhirResource>;
  updateResource(ctx: ProviderContext, resourceType: string, id: string, body: FhirWriteBody): Promise<FhirResource>;
}

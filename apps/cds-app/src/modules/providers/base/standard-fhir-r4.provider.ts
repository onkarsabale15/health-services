import { BadRequestException, Injectable } from '@nestjs/common';
import { logger } from '@hs/observability';
import type { FhirBundle, FhirResource } from '@hs/bridge-client';
import { BridgeClientService } from '../../../services/bridge-client.service';
import { FhirCodingEnricher } from '../../../services/fhir-coding-enricher';
import { bindEncounterContext } from '../../clinical-write/encounter-binder';
import {
  mapAllergy,
  mapAppointment,
  mapCondition,
  mapEncounter,
  mapMedication,
  mapPatient,
  mapPractitioner,
  mapVital,
  type AllergySummary,
  type AppointmentSummary,
  type ConditionSummary,
  type EncounterSummary,
  type MedicationSummary,
  type PatientSummary,
  type PractitionerSummary,
  type VitalSummary,
} from '../../clinical-data/fhir-mappers';
import type { FhirWriteBody, ListEncountersOptions, ListOptions } from '../cds-resource-provider.interface';
import { CdsResourceProviderBase } from './cds-resource-provider-base';
import type { ProviderContext } from './provider-context';

const CODING_ENRICHMENT_RESOURCES: ReadonlySet<string> = new Set(['Condition']);

/** Bridge cache opt-in for resources whose data changes rarely (Patient, Practitioner). */
const SLOW_MOVING_RESOURCE_CACHE = { headers: { 'Cache-Control': 'max-age=28800' } } as const;

/**
 * Standard FHIR R4 implementation of the resource provider, layered on top
 * of `CdsResourceProviderBase`. Reads/writes go through `BridgeClientService`
 * and responses are mapped via the existing FHIR mappers.
 *
 * This class commits to the bridge-api FHIR R4 transport. EHRs whose API
 * surface diverges from FHIR R4 (proprietary REST, direct vendor SDKs)
 * should extend `CdsResourceProviderBase` directly and write their own
 * methods rather than inherit from here.
 *
 * IMPORTANT: this class does NOT override `getCapabilities()`. Concrete
 * EHR providers (e.g., `CernerProvider`) declare their capabilities
 * explicitly. Inheriting an "all unsupported" default from the abstract
 * base means a subclass that forgets to declare gets a closed-by-default
 * UI — which is the safe behavior.
 */
@Injectable()
export class StandardFhirR4Provider extends CdsResourceProviderBase {
  override readonly ehrName: string = 'standard-fhir-r4';

  constructor(
    protected readonly bridge: BridgeClientService,
    protected readonly codingEnricher: FhirCodingEnricher,
  ) {
    super();
  }

  // ── Reads ──────────────────────────────────────────────────────────────

  override async getPatient(ctx: ProviderContext): Promise<PatientSummary | null> {
    const { sid, patientId } = this.required(ctx);
    try {
      const resource = await this.bridge.readFhir(sid, 'Patient', patientId, SLOW_MOVING_RESOURCE_CACHE);
      return mapPatient(resource);
    } catch {
      return null;
    }
  }

  override async getPractitioner(ctx: ProviderContext): Promise<PractitionerSummary | null> {
    const ps = ctx.session.providerSession;
    if (!ps.providerFhirId) return null;
    const [resourceType, resourceId] = ps.providerFhirId.split('/');
    if (!resourceType || !resourceId) return null;
    try {
      const { sid } = this.required(ctx);
      const resource = await this.bridge.readFhir(sid, resourceType, resourceId, SLOW_MOVING_RESOURCE_CACHE);
      const mapped = mapPractitioner(resource);
      if (mapped) return mapped;
    } catch {
      /* fall through to session-derived fallback */
    }
    return {
      id: resourceId,
      fullName: ps.providerName || 'Unknown',
      npi: ps.providerNpi,
      specialty: ps.providerSpecialty,
    };
  }

  override async getEncounter(ctx: ProviderContext, id: string): Promise<EncounterSummary | null> {
    const { sid } = this.required(ctx);
    try {
      const resource = await this.bridge.readFhir(sid, 'Encounter', id);
      return mapEncounter(resource);
    } catch {
      return null;
    }
  }

  override async getAppointment(ctx: ProviderContext, id: string): Promise<AppointmentSummary | null> {
    const { sid } = this.required(ctx);
    try {
      const resource = await this.bridge.readFhir(sid, 'Appointment', id);
      return mapAppointment(resource);
    } catch {
      return null;
    }
  }

  override async readResource(
    ctx: ProviderContext,
    resourceType: string,
    id: string,
  ): Promise<Record<string, unknown> | null> {
    const ps = ctx.session.providerSession;
    const pc = ctx.session.patientContext;
    try {
      const resource =
        ps.launchMode === 'system' && ps.linkedSiteId
          ? await this.bridge.readFhirBySite(ps.linkedSiteId, resourceType, id)
          : await this.bridge.readFhir(pc?.bridgeSessionId || ps.bridgeSessionId || '', resourceType, id);
      return (resource as Record<string, unknown>) ?? null;
    } catch (err) {
      logger.warn('readResource failed', {
        ehrName: this.ehrName,
        resourceType,
        id,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  override async listConditions(ctx: ProviderContext, options: ListOptions = {}): Promise<ConditionSummary[]> {
    const { sid, patientId, encounterId } = this.required(ctx);

    // The Clinical Summary 2x2 grid shows active only; the "View all"
    // detail modal opts in to all statuses with `includeInactive`. When
    // including, we drop the clinical-status filter — Cerner returns the
    // full set (active / inactive / resolved / etc.) and the UI groups.
    const baseParams: Record<string, string> = { patient: patientId };
    if (!options.includeInactive) baseParams['clinical-status'] = 'active';

    const problemListPromise = this.bridge.searchFhir(sid, 'Condition', {
      ...baseParams,
      category: 'problem-list-item',
    });

    const encounterDxPromise = encounterId
      ? this.bridge.searchFhir(sid, 'Condition', {
          ...baseParams,
          category: 'encounter-diagnosis',
          encounter: `Encounter/${encounterId}`,
        })
      : Promise.resolve(null);

    const [problemListResult, encounterDxResult] = await Promise.allSettled([problemListPromise, encounterDxPromise]);
    const problemList = problemListResult.status === 'fulfilled' ? extractResources(problemListResult.value) : [];
    const encounterDx =
      encounterDxResult.status === 'fulfilled' && encounterDxResult.value
        ? extractResources(encounterDxResult.value)
        : [];

    const mapped = dedup([...problemList, ...encounterDx].map(mapCondition), (c) => c.icdCode || c.name);
    logger.info('Conditions fetched', {
      ehrName: this.ehrName,
      patientId,
      encounterId: encounterId ?? null,
      includeInactive: !!options.includeInactive,
      problemList: problemList.length,
      encounterDx: encounterDx.length,
      deduped: mapped.length,
    });
    return mapped;
  }

  override async listAllergies(ctx: ProviderContext, options: ListOptions = {}): Promise<AllergySummary[]> {
    const { sid, patientId } = this.required(ctx);
    const params: Record<string, string> = { patient: patientId };
    if (!options.includeInactive) params['clinical-status'] = 'active';
    const bundle = await this.bridge.searchFhir(sid, 'AllergyIntolerance', params);
    return dedup(extractResources(bundle).map(mapAllergy), (a) => a.code || a.substance);
  }

  override async listMedications(ctx: ProviderContext, options: ListOptions = {}): Promise<MedicationSummary[]> {
    const { sid, patientId } = this.required(ctx);
    const reqParams: Record<string, string> = { patient: patientId };
    const stmtParams: Record<string, string> = { patient: patientId };
    if (!options.includeInactive) {
      reqParams.status = 'active';
      stmtParams.status = 'active';
    }
    const results = await Promise.allSettled([
      this.bridge.searchFhir(sid, 'MedicationRequest', reqParams),
      this.bridge.searchFhir(sid, 'MedicationStatement', stmtParams),
    ]);
    const requestResources = results[0].status === 'fulfilled' ? extractResources(results[0].value) : [];
    const statementResources = results[1].status === 'fulfilled' ? extractResources(results[1].value) : [];
    return dedup([...requestResources, ...statementResources].map(mapMedication), (m) => m.code || m.name);
  }

  override async listVitals(ctx: ProviderContext): Promise<VitalSummary[]> {
    const { sid, patientId } = this.required(ctx);
    const bundle = await this.bridge.searchFhir(sid, 'Observation', {
      patient: patientId,
      category: 'vital-signs',
      _sort: '-date',
      _count: '20',
    });
    return dedup(extractResources(bundle).map(mapVital), (v) => v.code);
  }

  override async listEncounters(ctx: ProviderContext, options?: ListEncountersOptions): Promise<EncounterSummary[]> {
    const { sid, patientId } = this.required(ctx);
    const params: Record<string, string> = { patient: patientId, _sort: '-date', _count: '10' };
    if (options?.appointmentId) {
      params.appointment = `Appointment/${options.appointmentId}`;
    } else if (options?.date) {
      params.date = options.date;
    }
    const bundle = await this.bridge.searchFhir(sid, 'Encounter', params);
    return extractResources(bundle)
      .map(mapEncounter)
      .filter((e): e is EncounterSummary => e !== null);
  }

  override async listAppointments(ctx: ProviderContext): Promise<AppointmentSummary[]> {
    const { sid, patientId } = this.required(ctx);
    const from = new Date();
    from.setFullYear(from.getFullYear() - 10);
    const bundle = await this.bridge.searchFhir(sid, 'Appointment', {
      patient: patientId,
      date: `ge${from.toISOString().slice(0, 10)}`,
      _sort: '-date',
      _count: '20',
    });
    return extractResources(bundle)
      .map(mapAppointment)
      .filter((a): a is AppointmentSummary => a !== null);
  }

  // ── Writes ─────────────────────────────────────────────────────────────

  override async createResource(
    ctx: ProviderContext,
    resourceType: string,
    body: FhirWriteBody,
  ): Promise<FhirResource> {
    const prepared = await this.prepareWrite(ctx, resourceType, body, 'create');
    const ps = ctx.session.providerSession;
    const pc = ctx.session.patientContext!;
    const raw =
      ps.launchMode === 'system' && ps.linkedSiteId
        ? await this.bridge.createFhirBySite(ps.linkedSiteId, resourceType, prepared)
        : await this.bridge.createFhir(pc.bridgeSessionId, resourceType, prepared);
    return raw && typeof raw === 'object' ? raw : { resourceType };
  }

  override async updateResource(
    ctx: ProviderContext,
    resourceType: string,
    id: string,
    body: FhirWriteBody,
  ): Promise<FhirResource> {
    const prepared = await this.prepareWrite(ctx, resourceType, body, 'update');
    const withId = { ...prepared, id, resourceType };
    const ps = ctx.session.providerSession;
    const pc = ctx.session.patientContext!;
    // Cerner Millennium requires If-Match for optimistic concurrency on
    // PUT. Read the versionId off the body the controller passed in
    // (fetch-then-merge flows include the existing meta verbatim) and
    // attach as `W/"<versionId>"` per FHIR HTTP spec.
    const options = ifMatchHeader(prepared);
    return ps.launchMode === 'system' && ps.linkedSiteId
      ? this.bridge.updateFhirBySite(ps.linkedSiteId, resourceType, id, withId, options)
      : this.bridge.updateFhir(pc.bridgeSessionId, resourceType, id, withId, options);
  }

  // ── Internal helpers ───────────────────────────────────────────────────

  protected async prepareWrite(
    ctx: ProviderContext,
    resourceType: string,
    body: FhirWriteBody,
    operation: 'create' | 'update',
  ): Promise<FhirWriteBody> {
    const ps = ctx.session.providerSession;
    const pc = ctx.session.patientContext;
    if (!pc) throw new BadRequestException('No patient context');
    let prepared = bindEncounterContext(body, resourceType, ps, pc);
    // Coding enrichment is a create-only safety net: when the user picks a
    // single coding (e.g. SNOMED), we look up cross-mappings (ICD-10-CM,
    // etc.) and merge them in. On update, the resource came from a GET —
    // codings are already present and re-enriching just adds latency and noise.
    if (operation === 'create' && CODING_ENRICHMENT_RESOURCES.has(resourceType)) {
      prepared = await this.codingEnricher.enrichCodeableConcept(prepared);
    }
    return prepared;
  }

  protected required(ctx: ProviderContext): { sid: string; patientId: string; encounterId?: string } {
    const ps = ctx.session.providerSession;
    const pc = ctx.session.patientContext;
    if (!pc) throw new BadRequestException('No patient context — SMART launch required');
    return {
      sid: pc.bridgeSessionId || ps.bridgeSessionId || '',
      patientId: pc.patientId,
      encounterId: pc.encounterId,
    };
  }
}

// ── Module-private utilities ─────────────────────────────────────────────

function extractResources(bundle: FhirBundle | null | undefined): Array<Record<string, unknown>> {
  return (bundle?.entry?.map((entry) => entry.resource).filter(Boolean) as Array<Record<string, unknown>>) || [];
}

function dedup<T>(items: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = keyFn(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Build the If-Match header value from a FHIR resource's `meta.versionId`.
 * Returns `undefined` when the body has no versionId (e.g. it wasn't
 * built fetch-then-merge), so the bridge call falls back to no-If-Match.
 * Cerner only enforces this on PUT — GETs / POSTs don't need it.
 */
function ifMatchHeader(body: Record<string, unknown>): { headers: Record<string, string> } | undefined {
  const meta = body.meta as { versionId?: string } | undefined;
  if (!meta?.versionId) return undefined;
  return { headers: { 'If-Match': `W/"${meta.versionId}"` } };
}

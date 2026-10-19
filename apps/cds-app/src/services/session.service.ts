import { Injectable } from '@nestjs/common';
import { cache } from '@hs/infra';
import { v7 as uuidv7 } from 'uuid';
import type { CdsCard } from '../engine';
import { computeProviderCapabilities, inferRoleFromQualifications } from './provider-role';
import type { ProviderCapabilities, ProviderRole } from './provider-role';
import { logger } from '@hs/observability';

const PROVIDER_SESSION_TTL = 28800; // 8 hours (provider shift)
const PATIENT_CONTEXT_TTL = 1800; // 30 minutes (SMART session lifetime)
const RESULT_TTL = 1800;

/**
 * Analysis lifecycle for the current patient context.
 *   `idle`      → no analysis has been started for this patient context.
 *                 This is the default for a freshly-set context (SMART
 *                 launch, patient selection). Drives the FE banner to
 *                 show nothing.
 *   `pending`   → POST /analysis/start has been accepted; runAsync hasn't
 *                 begun pulling clinical data yet.
 *   `analyzing` → runAsync is in flight (clinical-data fetch + LLM call).
 *   `complete`  → cards stored; results readable from the result key.
 *   `error`     → analysis failed; `error` field carries the message.
 *
 * Important: do NOT default fresh contexts to `pending` — the SSE feeds
 * this directly to the FE banner, and a stale `pending` shows a phantom
 * "Generating care plan…" banner before the user has clicked anything.
 */
export type SessionStatus = 'idle' | 'pending' | 'analyzing' | 'complete' | 'error';
export type LaunchMode = 'ehr' | 'standalone' | 'system';

/** Provider-scoped session — persists across patient launches, stored as HttpOnly cookie */
export interface ProviderSession {
  providerSessionId: string;
  applicationId: string;
  ehrName: string;
  siteId?: string;
  launchMode: LaunchMode;
  /** SMART modes (ehr/standalone): bridge session ID for X-Session-Id FHIR calls. */
  bridgeSessionId?: string;
  linkedSiteId?: string; // system mode: EhrSiteConfig.id for X-Site-Id calls
  linkedEhrAccessId?: string; // system mode: AppEhrAccess.id
  /**
   * Full FHIR reference of the launching user — e.g. `Practitioner/12345`
   * (NOT a bare id). Sourced from the SMART id_token `fhirUser` claim and
   * normalized at the bridge launch boundary; consumers should use it
   * verbatim as a `Reference.reference` value. Prepending `Practitioner/`
   * downstream produces `Practitioner/Practitioner/12345` which Cerner
   * (and any spec-conformant validator) rejects.
   */
  providerFhirId?: string;
  providerName?: string;
  providerNpi?: string;
  providerSpecialty?: string;
  /** Canonical EndUser id resolved by admin-api during launch. Phase C IdP gate. */
  endUserId?: string;
  /**
   * Descriptive role of the launching user. Useful for audit, UI labels,
   * analytics. NOT used directly for action gating — that's what
   * `providerCapabilities` is for. Set ONCE at launch from `fhirContext`
   * role hint or `Practitioner.qualification`. Defaults to `support` when
   * no signal resolves.
   */
  providerRole: ProviderRole;
  /**
   * Action-scoped capability flags computed from `providerRole` (and any
   * future state-level / supervision rules). Today carries
   * `canApproveCarePlan`; new flags get added per action as the product
   * grows.
   */
  providerCapabilities: ProviderCapabilities;
  createdAt: string;
}

/** Patient context — updated on each SMART launch or patient selection */
export interface PatientContext {
  bridgeSessionId: string; // SMART session ID (modes 1/2) — empty string for system mode
  patientId: string;
  encounterId?: string;
  appointmentId?: string;
  scope?: string;
  status: SessionStatus;
  error?: string;
  updatedAt: string;
}

/** Combined view for guards/controllers */
export interface CdsSession {
  providerSession: ProviderSession;
  patientContext: PatientContext | null;
}

@Injectable()
export class SessionService {
  // ── Provider Session (8h, cookie-based) ─────────────────

  async createProviderSession(data: {
    applicationId: string;
    ehrName: string;
    siteId?: string;
    launchMode?: LaunchMode;
    bridgeSessionId?: string; // SMART session ID for modes 1/2
    linkedSiteId?: string;
    linkedEhrAccessId?: string;
    providerFhirId?: string;
    providerName?: string;
    providerNpi?: string;
    providerSpecialty?: string;
    endUserId?: string;
    providerRole?: ProviderRole;
    providerCapabilities?: ProviderCapabilities;
  }): Promise<ProviderSession> {
    const providerSessionId = uuidv7();
    const session: ProviderSession = {
      providerSessionId,
      applicationId: data.applicationId,
      ehrName: data.ehrName,
      siteId: data.siteId,
      launchMode: data.launchMode || 'ehr',
      bridgeSessionId: data.bridgeSessionId,
      linkedSiteId: data.linkedSiteId,
      linkedEhrAccessId: data.linkedEhrAccessId,
      providerFhirId: data.providerFhirId,
      providerName: data.providerName,
      providerNpi: data.providerNpi,
      providerSpecialty: data.providerSpecialty,
      endUserId: data.endUserId,
      // Closed by default — callers that can prove a more privileged role
      // pass it explicitly. Unknown role = no clinical sign-off authority.
      providerRole: data.providerRole ?? 'support',
      providerCapabilities: data.providerCapabilities ?? { canApproveCarePlan: false },
      createdAt: new Date().toISOString(),
    };
    await cache.set(`cds:provider:${providerSessionId}`, session, PROVIDER_SESSION_TTL);
    return session;
  }

  async getProviderSession(providerSessionId: string): Promise<ProviderSession | null> {
    return cache.get<ProviderSession>(`cds:provider:${providerSessionId}`);
  }

  /**
   * Self-healing role hydration. The launch path defaults `providerRole`
   * to `support` (closed-by-default). The first time a clinician's
   * Practitioner is fetched (lazy on FE layout mount), this routine
   * derives the actual role from `qualification` and writes it back to
   * the Redis session so subsequent gates see the right value.
   *
   * Idempotent and direction-restricted:
   *   - Only upgrades from `support` → a more specific role.
   *   - Never overwrites a role that's already non-`support`. The launch
   *     never sets anything but `support` today, but that may change
   *     (system mode already sets `system`); this rule means a future
   *     authoritative source can't be silently undone by stale FHIR data.
   *
   * Best-effort: failures (no matching role, missing session, cache
   * write error) are logged and swallowed. The role stays at its
   * previous value; caller doesn't need to handle anything.
   */
  async hydrateRoleFromQualifications(
    providerSessionId: string,
    qualifications:
      | Array<{ code?: { coding?: Array<{ system?: string; code?: string; display?: string }>; text?: string } }>
      | undefined,
  ): Promise<void> {
    if (!qualifications?.length) return;
    const session = await this.getProviderSession(providerSessionId);
    if (!session) return;
    if (session.providerRole !== 'support') return;

    const role = inferRoleFromQualifications(qualifications);
    if (!role || role === 'support') return;

    session.providerRole = role;
    session.providerCapabilities = computeProviderCapabilities(role);
    try {
      await cache.set(`cds:provider:${providerSessionId}`, session, PROVIDER_SESSION_TTL);
      logger.info('Provider role hydrated from Practitioner qualifications', {
        providerSessionId,
        role,
        canApproveCarePlan: session.providerCapabilities.canApproveCarePlan,
      });
    } catch (err: unknown) {
      logger.warn('Failed to persist hydrated role', {
        providerSessionId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ── Patient Context (30min, updated per launch) ─────────

  async setPatientContext(
    providerSessionId: string,
    data: {
      bridgeSessionId: string;
      patientId: string;
      encounterId?: string;
      scope?: string;
    },
  ): Promise<PatientContext> {
    const ctx: PatientContext = {
      bridgeSessionId: data.bridgeSessionId,
      patientId: data.patientId,
      encounterId: data.encounterId,
      scope: data.scope,
      status: 'idle',
      updatedAt: new Date().toISOString(),
    };
    await cache.set(`cds:patient:${providerSessionId}`, ctx, PATIENT_CONTEXT_TTL);
    return ctx;
  }

  async getPatientContext(providerSessionId: string): Promise<PatientContext | null> {
    return cache.get<PatientContext>(`cds:patient:${providerSessionId}`);
  }

  async updateStatus(providerSessionId: string, status: SessionStatus, error?: string): Promise<void> {
    const ctx = await this.getPatientContext(providerSessionId);
    if (!ctx) return;
    ctx.status = status;
    if (error) ctx.error = error;
    await cache.set(`cds:patient:${providerSessionId}`, ctx, PATIENT_CONTEXT_TTL);
  }

  // ── Combined Session (for guard) ────────────────────────

  async getFullSession(providerSessionId: string): Promise<CdsSession | null> {
    const providerSession = await this.getProviderSession(providerSessionId);
    if (!providerSession) return null;
    const patientContext = await this.getPatientContext(providerSessionId);
    return { providerSession, patientContext };
  }

  // ── Analysis Results ────────────────────────────────────

  async storeResults(providerSessionId: string, cards: CdsCard[]): Promise<void> {
    await cache.set(`cds:result:${providerSessionId}`, cards, RESULT_TTL);
  }

  async getResults(providerSessionId: string): Promise<CdsCard[] | null> {
    return cache.get<CdsCard[]>(`cds:result:${providerSessionId}`);
  }
}

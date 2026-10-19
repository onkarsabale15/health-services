import { logger } from '@hs/observability';
import type { ProviderSession, PatientContext } from '../../services/session.service';

/**
 * Auto-injects encounter reference into FHIR write bodies when in provider-ehr mode
 * and the session has an active encounter context.
 *
 * Rules:
 * - `provider-ehr` mode + encounter context → inject `encounter.reference`
 * - `provider-standalone` or `system` → skip (no encounter binding)
 * - Explicit `encounter: null` in body → opt-out, don't inject
 * - Body already has `encounter.reference` → don't overwrite
 * - For Conditions specifically: only `encounter-diagnosis` category gets
 *   bound. `problem-list-item` and `health-concern` are longitudinal —
 *   binding them to the current encounter would silently corrupt the
 *   patient's chronic problem list with encounter-scoped data.
 *
 * Resources affected: Condition (encounter-diagnosis only), Observation,
 * Communication, DiagnosticReport, Procedure.
 * Not affected: AllergyIntolerance (patient-scoped by FHIR spec).
 */

const ENCOUNTER_BOUND_RESOURCES = new Set([
  'Condition',
  'Observation',
  'Communication',
  'DiagnosticReport',
  'Procedure',
]);

/** Narrow shape we read off the body for category-aware binding. */
interface ConditionShape {
  category?: Array<{ coding?: Array<{ code?: string }> }>;
}

function isEncounterDiagnosis(body: Record<string, unknown>): boolean {
  const condition = body as ConditionShape;
  const code = condition.category?.[0]?.coding?.[0]?.code;
  return code === 'encounter-diagnosis';
}

export function bindEncounterContext(
  body: Record<string, unknown>,
  resourceType: string,
  providerSession: ProviderSession,
  patientContext: PatientContext | null,
): Record<string, unknown> {
  // Only bind in provider-ehr mode
  if (providerSession.launchMode !== 'ehr') return body;

  // Only for resources that should be encounter-scoped
  if (!ENCOUNTER_BOUND_RESOURCES.has(resourceType)) return body;

  // Conditions split: only encounter-diagnosis gets bound. Problem list
  // items and health concerns are longitudinal — binding them to the
  // current encounter would corrupt the chronic problem record.
  if (resourceType === 'Condition' && !isEncounterDiagnosis(body)) {
    logger.debug('Encounter binding skipped (non-encounter-diagnosis Condition)', { resourceType });
    return body;
  }

  // Must have encounter in patient context
  const encounterId = patientContext?.encounterId;
  if (!encounterId) return body;

  // Explicit opt-out: caller sent encounter: null
  if ('encounter' in body && body.encounter === null) {
    logger.debug('Encounter binding skipped (explicit opt-out)', { resourceType });
    return body;
  }

  // Don't overwrite if already set
  if (body.encounter && typeof body.encounter === 'object') {
    return body;
  }

  // Inject encounter reference
  const bound = {
    ...body,
    encounter: { reference: `Encounter/${encounterId}` },
  };

  logger.debug('Encounter context auto-bound', {
    resourceType,
    encounterId,
    launchMode: providerSession.launchMode,
  });

  return bound;
}

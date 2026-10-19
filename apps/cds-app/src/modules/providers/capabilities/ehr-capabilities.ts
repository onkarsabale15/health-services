/**
 * Capability helpers — pure functions that operate on a `ProviderCapabilities`
 * object returned by `provider.getCapabilities(mode)`.
 *
 * The provider is the source of truth for what each EHR supports. These
 * helpers compose its declarations into the API-shaped envelopes consumed by
 * the FE (per-resource gate flags, care-plan feasibility, write summaries).
 *
 * Adding a new EHR is two steps — there's no matrix file to update here:
 *   1. Write a provider class extending `BaseFhirProvider`. Override
 *      `getCapabilities(mode)` to declare what your EHR supports, and
 *      override the methods you implement.
 *   2. Register the provider in `CdsResourceProviderFactory` + `ProvidersModule`.
 */

import type {
  ClinicalOperation,
  ConditionCategory,
  LaunchMode,
  OperationSupport,
  ProviderCapabilities,
  ResourceCapabilities,
  ResourceType,
} from './capability.types';

export function isOperationSupported(caps: ProviderCapabilities, operation: ClinicalOperation): OperationSupport {
  return caps.operations[operation] ?? { supported: false, reason: 'Operation not declared' };
}

export function getSupportedOperations(caps: ProviderCapabilities): ClinicalOperation[] {
  return (Object.keys(caps.operations) as ClinicalOperation[]).filter((op) => caps.operations[op]?.supported);
}

export function getConditionCategories(caps: ProviderCapabilities, mode: LaunchMode): ConditionCategory[] {
  if (!caps.operations['condition.write']?.supported) return [];
  // System mode never binds to an encounter, so encounter-diagnosis isn't writable there.
  if (mode === 'system') {
    return caps.conditionCategories.filter((c) => c !== 'encounter-diagnosis');
  }
  return caps.conditionCategories;
}

const CAREPLAN_REQUIRED_READS: ClinicalOperation[] = [
  'patient.read',
  'condition.read',
  'allergy.read',
  'observation.read',
  'medication.read',
];
const CAREPLAN_OPTIONAL_READS: ClinicalOperation[] = ['encounter.read', 'appointment.read'];

export function canGenerateCarePlan(caps: ProviderCapabilities): {
  feasible: boolean;
  missingRequired: string[];
  missingOptional: string[];
} {
  const missingRequired = CAREPLAN_REQUIRED_READS.filter((op) => !caps.operations[op]?.supported).map((op) =>
    op.replace('.read', ''),
  );
  const missingOptional = CAREPLAN_OPTIONAL_READS.filter((op) => !caps.operations[op]?.supported).map((op) =>
    op.replace('.read', ''),
  );
  return {
    feasible: missingRequired.length === 0,
    missingRequired,
    missingOptional,
  };
}

export function getWriteCapabilitySummary(caps: ProviderCapabilities): Record<string, boolean> {
  return {
    conditions: caps.operations['condition.write']?.supported ?? false,
    allergies: caps.operations['allergy.write']?.supported ?? false,
    vitals: caps.operations['observation.write']?.supported ?? false,
    encounters: caps.operations['encounter.close']?.supported ?? false,
  };
}

const WRITE_OP_BY_RESOURCE: Partial<Record<ResourceType, ClinicalOperation>> = {
  Condition: 'condition.write',
  AllergyIntolerance: 'allergy.write',
  Observation: 'observation.write',
  Appointment: 'appointment.write',
  Encounter: 'encounter.close',
};

const READ_OP_BY_RESOURCE: Partial<Record<ResourceType, ClinicalOperation>> = {
  Condition: 'condition.read',
  AllergyIntolerance: 'allergy.read',
  Observation: 'observation.read',
  Appointment: 'appointment.read',
  Encounter: 'encounter.read',
  MedicationStatement: 'medication.read',
  Patient: 'patient.read',
};

/**
 * Compose the per-resource UX envelope from the provider's self-declared
 * capabilities. The single function responsible for turning declarations
 * into the gate flags the FE renders against.
 */
export function getResourceCapabilities(
  caps: ProviderCapabilities,
  mode: LaunchMode,
  resource: ResourceType,
): ResourceCapabilities {
  const isEncounterSupported = caps.encounterModel !== 'none';
  const writeOp = WRITE_OP_BY_RESOURCE[resource];
  const readOp = READ_OP_BY_RESOURCE[resource];
  const writeSupport = writeOp ? caps.operations[writeOp] : undefined;
  const readSupport = readOp ? caps.operations[readOp] : undefined;
  const allowAdd = writeSupport?.supported ?? false;
  const allowEdit = writeSupport?.supported ?? false;
  const reasons: ResourceCapabilities['reasons'] = {};
  if (!allowAdd && writeSupport?.reason) reasons.add = writeSupport.reason;
  if (!allowEdit && writeSupport?.reason) reasons.edit = writeSupport.reason;
  if (readSupport && !readSupport.supported && readSupport.reason) reasons.delete = readSupport.reason;

  return {
    allowAdd,
    allowEdit,
    allowDelete: false,
    reasons: Object.keys(reasons).length ? reasons : undefined,
    categories: resource === 'Condition' ? getConditionCategories(caps, mode) : null,
    isEncounterSupported,
    encounterBound: writeSupport?.encounterBound,
    writeRules: resource === 'Condition' ? caps.condition : undefined,
    extras: buildExtras(caps, resource),
  };
}

function buildExtras(caps: ProviderCapabilities, resource: ResourceType): Record<string, unknown> | undefined {
  switch (resource) {
    case 'Appointment':
      return {
        allowAddEncounter: caps.appointment.allowDeriveEncounter && caps.encounterModel !== 'none',
        defaultDurationMinutes: caps.appointment.defaultDurationMinutes,
      };
    case 'Encounter':
      return {
        allowClose: caps.encounter.allowClose,
      };
    case 'AllergyIntolerance':
      return {
        requiresVerificationStatus: caps.allergy.requiresVerificationStatus,
      };
    case 'Observation':
      return {
        supportedCategories: caps.observationCategories,
      };
    default:
      return undefined;
  }
}

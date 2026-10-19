import { Injectable } from '@nestjs/common';
import { BridgeClientService } from '../../../services/bridge-client.service';
import { FhirCodingEnricher } from '../../../services/fhir-coding-enricher';
import { StandardFhirR4Provider } from '../base/standard-fhir-r4.provider';
import type { ProviderContext } from '../base/provider-context';
import type {
  ClinicalOperation,
  LaunchMode,
  OperationSupport,
  ProviderCapabilities,
} from '../capabilities/capability.types';
import { mapMedication, type MedicationSummary } from '../../clinical-data/fhir-mappers';
import type { ListOptions } from '../cds-resource-provider.interface';

/**
 * Cerner-specific provider.
 *
 * Cerner's API surface is standard FHIR R4 with a couple of vendor quirks,
 * so this class extends `StandardFhirR4Provider` (which inherits the
 * "all unsupported" defaults from `CdsResourceProviderBase`).
 *
 * The class is the source of truth for both behavior AND capability —
 * `getCapabilities(mode)` declares what Cerner supports, and the method
 * overrides implement what's declared. No static matrix file to drift
 * against; if you implement a new method here, update the capability
 * declaration in the same diff.
 */
@Injectable()
export class CernerProvider extends StandardFhirR4Provider {
  override readonly ehrName = 'cerner';

  constructor(bridge: BridgeClientService, codingEnricher: FhirCodingEnricher) {
    super(bridge, codingEnricher);
  }

  override getCapabilities(_mode: LaunchMode): ProviderCapabilities {
    const yes: OperationSupport = { supported: true };
    // Capability reflects end-to-end readiness. Bridge implements
    // createAllergy and createObservation, and the CDS write controller
    // delegates to them — but the cds-ui forms are still stubs (the Add
    // buttons currently `alert("coming soon")`). Declaring these as
    // unsupported keeps the buttons hidden until the forms ship.
    const operations: Record<ClinicalOperation, OperationSupport> = {
      'patient.read': yes,
      'patient.search': yes,
      'condition.read': yes,
      'condition.write': { supported: true, model: 'both', encounterBound: true },
      'allergy.read': yes,
      'allergy.write': { supported: false, reason: 'Allergy creation form not yet implemented in CDS UI' },
      'observation.read': yes,
      'observation.write': { supported: false, reason: 'Vital sign entry form not yet implemented in CDS UI' },
      'medication.read': yes,
      'appointment.read': yes,
      'appointment.write': { supported: false, reason: 'Cerner does not support appointment creation via API' },
      'encounter.read': yes,
      'encounter.close': { supported: false, reason: 'Cerner does not support encounter closure via API' },
      'careplan.generate': yes,
    };
    return {
      ehrName: this.ehrName,
      encounterModel: 'native',
      operations,
      // Provider-launch modes can write encounter-diagnosis; system mode strips it (no encounter binding).
      conditionCategories: _mode === 'system' ? ['problem-list-item'] : ['problem-list-item', 'encounter-diagnosis'],
      observationCategories: ['vital-signs'],
      appointment: { allowCreate: false, allowDeriveEncounter: true },
      allergy: { requiresVerificationStatus: true },
      encounter: { allowClose: false },
      // Per Oracle Health Millennium R4 Condition docs:
      //  - POST: refuted / entered-in-error are unreachable on create — record
      //    with an active state, then flip via PUT.
      //  - POST encounter-diagnosis: clinicalStatus must be active and
      //    abatementDateTime + severity are rejected. `note[]` IS accepted.
      //  - PUT: `note[]` "Does not allow updates" — addable only at create
      //    time, fully read-only thereafter. Cerner returns 200 but silently
      //    discards any change to the field. There is no $note / addNote
      //    operation. code/category are identity. requires `If-Match`
      //    (`W/"<versionId>"`) for optimistic concurrency. Source:
      //    docs.oracle.com/.../mfrap/op-condition-id-put.html
      condition: {
        create: {
          allowedStates: ['active-confirmed', 'active-provisional', 'recurrence', 'remission', 'resolved', 'inactive'],
          perCategory: {
            'encounter-diagnosis': {
              allowedStates: ['active-confirmed', 'active-provisional'],
              forbiddenFields: ['abatementDate', 'severity'],
            },
          },
          notesAccepted: true,
        },
        update: {
          immutableFields: ['code', 'category', 'note'],
          requiresIfMatch: true,
          // Cerner's PUT rejects > 1 category entry even when both are canonical.
          maxCategoryItems: 1,
          // Cerner silently coerces `recurrence` → active on problem-list-item
          // update — declare it unsupported so the form doesn't offer it. The
          // FHIR way to model recurrence on Cerner is to mark the original
          // resolved + create a new active Condition.
          allowedStates: [
            'active-confirmed',
            'active-provisional',
            'remission',
            'resolved',
            'inactive',
            'refuted',
            'entered-in-error',
          ],
          perCategory: {
            'encounter-diagnosis': {
              forbiddenFields: ['abatementDate', 'severity'],
              // Cerner: "Condition.clinicalStatus must be 'active' when updating
              // a diagnosis". encounter-diagnoses are visit-bound snapshots, not
              // resolvable problems — model "no longer has this" via a new
              // problem-list-item Condition instead.
              allowedStates: ['active-confirmed', 'active-provisional'],
            },
          },
        },
      },
    };
  }

  // ── Method overrides ───────────────────────────────────────────────────

  /**
   * Cerner only implements MedicationRequest. The default's MedicationStatement
   * call is a guaranteed-fail bridge round-trip — bridge's cerner-data.service
   * throws explicitly for it. Skip it.
   */
  override async listMedications(ctx: ProviderContext, options: ListOptions = {}): Promise<MedicationSummary[]> {
    const { sid, patientId } = this.required(ctx);
    const params: Record<string, string> = { patient: patientId };
    if (!options.includeInactive) params.status = 'active';
    const bundle = await this.bridge.searchFhir(sid, 'MedicationRequest', params);
    const resources = (bundle?.entry ?? [])
      .map((e) => e?.resource)
      .filter((r): r is Record<string, unknown> => Boolean(r));
    return dedup(resources.map(mapMedication), (m) => m.code || m.name);
  }
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

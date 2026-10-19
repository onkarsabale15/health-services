import { CernerProvider } from './cerner.provider';
import type { BridgeClientService } from '../../../services/bridge-client.service';
import type { FhirCodingEnricher } from '../../../services/fhir-coding-enricher';
import type { ProviderContext } from '../base/provider-context';
import type { CdsSession } from '../../../services/session.service';

/**
 * Smoke tests for `CernerProvider`. Two things matter:
 *   1. Capability declaration matches Cerner's actual surface — supported
 *      reads, supported writes, the documented unsupported operations
 *      (appointment.write, encounter.close).
 *   2. `listMedications` only calls `MedicationRequest`, never
 *      `MedicationStatement`. The whole reason CernerProvider exists is to
 *      avoid that guaranteed-fail bridge round-trip; if someone reverts
 *      this, the test fails loudly.
 */

describe('CernerProvider', () => {
  let bridge: jest.Mocked<BridgeClientService>;
  let codingEnricher: jest.Mocked<FhirCodingEnricher>;
  let provider: CernerProvider;

  beforeEach(() => {
    bridge = {
      searchFhir: jest.fn(),
      readFhir: jest.fn(),
      createFhir: jest.fn(),
      updateFhir: jest.fn(),
      searchFhirBySite: jest.fn(),
      readFhirBySite: jest.fn(),
      createFhirBySite: jest.fn(),
      updateFhirBySite: jest.fn(),
    } as unknown as jest.Mocked<BridgeClientService>;
    codingEnricher = {
      enrichCodeableConcept: jest.fn(),
    } as unknown as jest.Mocked<FhirCodingEnricher>;
    provider = new CernerProvider(bridge, codingEnricher);
  });

  describe('ehrName', () => {
    it("identifies itself as 'cerner'", () => {
      expect(provider.ehrName).toBe('cerner');
    });
  });

  describe('getCapabilities', () => {
    it.each(['provider-ehr', 'provider-standalone', 'system'] as const)(
      'declares supported reads + writes for mode %s',
      (mode) => {
        const caps = provider.getCapabilities(mode);
        expect(caps.ehrName).toBe('cerner');
        expect(caps.encounterModel).toBe('native');
        // Reads — Cerner implements all standard FHIR R4 reads.
        expect(caps.operations['patient.read'].supported).toBe(true);
        expect(caps.operations['condition.read'].supported).toBe(true);
        expect(caps.operations['allergy.read'].supported).toBe(true);
        expect(caps.operations['medication.read'].supported).toBe(true);
        expect(caps.operations['observation.read'].supported).toBe(true);
        expect(caps.operations['appointment.read'].supported).toBe(true);
        expect(caps.operations['encounter.read'].supported).toBe(true);
        // Writes — only condition.write is end-to-end ready (CDS UI ships ConditionForm).
        expect(caps.operations['condition.write'].supported).toBe(true);
        // FE forms not yet built — capability is declared unsupported until they are.
        expect(caps.operations['allergy.write'].supported).toBe(false);
        expect(caps.operations['allergy.write'].reason).toMatch(/form not yet implemented/i);
        expect(caps.operations['observation.write'].supported).toBe(false);
        expect(caps.operations['observation.write'].reason).toMatch(/form not yet implemented/i);
        // Vendor gaps in the Cerner API itself.
        expect(caps.operations['appointment.write'].supported).toBe(false);
        expect(caps.operations['appointment.write'].reason).toMatch(/appointment creation/i);
        expect(caps.operations['encounter.close'].supported).toBe(false);
        expect(caps.operations['encounter.close'].reason).toMatch(/encounter closure/i);
      },
    );

    it('includes encounter-diagnosis category in provider modes', () => {
      const caps = provider.getCapabilities('provider-ehr');
      expect(caps.conditionCategories).toEqual(expect.arrayContaining(['problem-list-item', 'encounter-diagnosis']));
    });

    it('drops encounter-diagnosis in system mode (no encounter binding available)', () => {
      const caps = provider.getCapabilities('system');
      expect(caps.conditionCategories).not.toContain('encounter-diagnosis');
      expect(caps.conditionCategories).toContain('problem-list-item');
    });
  });

  describe('listMedications', () => {
    it('only calls bridge with MedicationRequest, never MedicationStatement', async () => {
      bridge.searchFhir.mockResolvedValue({
        resourceType: 'Bundle',
        type: 'searchset',
        entry: [],
      });

      const ctx = makeProviderContext({ patientId: 'pt-123', bridgeSessionId: 'sid-abc' });
      await provider.listMedications(ctx);

      const calls = bridge.searchFhir.mock.calls;
      expect(calls).toHaveLength(1);
      const [, resourceType, params] = calls[0];
      expect(resourceType).toBe('MedicationRequest');
      expect(params).toEqual({ patient: 'pt-123', status: 'active' });

      // The whole point of the override — Statement must NEVER be called.
      const calledResources = calls.map(([, r]) => r);
      expect(calledResources).not.toContain('MedicationStatement');
    });

    it('maps and dedupes returned MedicationRequest resources', async () => {
      bridge.searchFhir.mockResolvedValue({
        resourceType: 'Bundle',
        type: 'searchset',
        entry: [
          {
            resource: {
              resourceType: 'MedicationRequest',
              id: 'mr-1',
              status: 'active',
              medicationCodeableConcept: {
                coding: [
                  { system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: '197361', display: 'Lisinopril' },
                ],
              },
            },
          },
          // duplicate: same code, should be dropped by dedup
          {
            resource: {
              resourceType: 'MedicationRequest',
              id: 'mr-2',
              status: 'active',
              medicationCodeableConcept: {
                coding: [
                  { system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: '197361', display: 'Lisinopril' },
                ],
              },
            },
          },
        ],
      });

      const ctx = makeProviderContext({ patientId: 'pt-123', bridgeSessionId: 'sid-abc' });
      const result = await provider.listMedications(ctx);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ code: '197361' });
    });

    it('returns [] when bridge returns an empty bundle', async () => {
      bridge.searchFhir.mockResolvedValue({
        resourceType: 'Bundle',
        type: 'searchset',
        entry: [],
      });
      const ctx = makeProviderContext({ patientId: 'pt-123', bridgeSessionId: 'sid-abc' });
      expect(await provider.listMedications(ctx)).toEqual([]);
    });
  });

  describe('getEncounter', () => {
    it('reads the encounter by id via bridge.readFhir and maps the result', async () => {
      bridge.readFhir.mockResolvedValue({
        resourceType: 'Encounter',
        id: 'enc-1',
        status: 'in-progress',
        period: { start: '2026-04-26T09:00:00Z' },
      });
      const ctx = makeProviderContext({ patientId: 'pt-123', bridgeSessionId: 'sid-abc' });

      const result = await provider.getEncounter(ctx, 'enc-1');

      expect(bridge.readFhir).toHaveBeenCalledWith('sid-abc', 'Encounter', 'enc-1');
      expect(result).toMatchObject({ id: 'enc-1', status: 'in-progress' });
    });

    it('returns null when the bridge call fails', async () => {
      bridge.readFhir.mockRejectedValue(new Error('not found'));
      const ctx = makeProviderContext({ patientId: 'pt-123', bridgeSessionId: 'sid-abc' });

      const result = await provider.getEncounter(ctx, 'missing');

      expect(result).toBeNull();
    });
  });

  describe('getAppointment', () => {
    it('reads the appointment by id via bridge.readFhir and maps the result', async () => {
      bridge.readFhir.mockResolvedValue({
        resourceType: 'Appointment',
        id: 'apt-1',
        status: 'booked',
        start: '2026-04-26T09:00:00Z',
      });
      const ctx = makeProviderContext({ patientId: 'pt-123', bridgeSessionId: 'sid-abc' });

      const result = await provider.getAppointment(ctx, 'apt-1');

      expect(bridge.readFhir).toHaveBeenCalledWith('sid-abc', 'Appointment', 'apt-1');
      expect(result).toMatchObject({ id: 'apt-1', status: 'booked' });
    });

    it('returns null when the bridge call fails', async () => {
      bridge.readFhir.mockRejectedValue(new Error('not found'));
      const ctx = makeProviderContext({ patientId: 'pt-123', bridgeSessionId: 'sid-abc' });

      const result = await provider.getAppointment(ctx, 'missing');

      expect(result).toBeNull();
    });
  });
});

// ── Test fixtures ────────────────────────────────────────────────────────

function makeProviderContext(overrides: { patientId: string; bridgeSessionId: string }): ProviderContext {
  const session: CdsSession = {
    providerSession: {
      providerSessionId: 'ps-test',
      applicationId: 'app-test',
      ehrName: 'cerner',
      launchMode: 'ehr',
      bridgeSessionId: overrides.bridgeSessionId,
      // Test fixture defaults — exercising read paths that don't depend
      // on role gating. Tests for the approval guard set their own role.
      providerRole: 'physician',
      providerCapabilities: { canApproveCarePlan: true },
      createdAt: new Date().toISOString(),
    },
    patientContext: {
      bridgeSessionId: overrides.bridgeSessionId,
      patientId: overrides.patientId,
      status: 'idle',
      updatedAt: new Date().toISOString(),
    },
  };
  return { session, mode: 'provider-ehr' };
}

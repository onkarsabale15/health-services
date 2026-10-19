import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import type { FhirBundle, FhirResource } from '@hs/bridge-client';
import { BridgeClientService } from '../../services/bridge-client.service';
import { SessionService, type CdsSession } from '../../services/session.service';
import { mapPatient } from '../clinical-data/fhir-mappers';

@Injectable()
export class PatientService {
  constructor(
    private readonly bridgeClient: BridgeClientService,
    private readonly sessionService: SessionService,
  ) {}

  /** Search patients via Bridge — returns minimal summary fields (no raw PHI) */
  async searchPatients(session: CdsSession, params: { name?: string; birthdate?: string; identifier?: string }) {
    const searchParams: Record<string, string> = { _count: '20' };
    if (params.name) {
      // "LastName, FirstName" → split into FHIR family + given params.
      // Cerner rejects comma in the `name` param ("multiple values not supported").
      const parts = params.name
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (parts.length >= 2) {
        searchParams.family = parts[0];
        searchParams.given = parts.slice(1).join(' ');
      } else {
        searchParams.name = params.name;
      }
    }
    if (params.birthdate) searchParams.birthdate = params.birthdate;
    if (params.identifier) searchParams.identifier = params.identifier;

    const bundle = await this.searchFhir(session, 'Patient', searchParams);
    const resources = (bundle?.entry ?? [])
      .map((e) => e?.resource)
      .filter((r): r is Record<string, unknown> => Boolean(r));

    return resources.map(mapPatient).filter(Boolean);
  }

  /** Select a patient — verify exists via Bridge, then set patient context */
  async selectPatient(session: CdsSession, patientId: string) {
    const patient = await this.readFhir(session, 'Patient', patientId);
    if (!patient) throw new NotFoundException('Patient not found');

    const bridgeSessionId = session.patientContext?.bridgeSessionId || session.providerSession.bridgeSessionId;
    if (!bridgeSessionId && session.providerSession.launchMode !== 'system') {
      throw new BadRequestException('No bridge session — re-launch from EHR');
    }

    await this.sessionService.setPatientContext(session.providerSession.providerSessionId, {
      bridgeSessionId: bridgeSessionId ?? '',
      patientId,
    });

    return mapPatient(patient);
  }

  // ── Mode-aware Bridge routing ─────────────────────────────

  private async searchFhir(
    session: CdsSession,
    resourceType: string,
    params: Record<string, string>,
  ): Promise<FhirBundle> {
    const ps = session.providerSession;
    if (ps.launchMode === 'system' && ps.linkedSiteId) {
      return this.bridgeClient.searchFhirBySite(ps.linkedSiteId, resourceType, params);
    }
    const sid = session.patientContext?.bridgeSessionId || ps.bridgeSessionId;
    if (!sid) throw new BadRequestException('No active FHIR session');
    return this.bridgeClient.searchFhir(sid, resourceType, params);
  }

  private async readFhir(session: CdsSession, resourceType: string, id: string): Promise<FhirResource> {
    const ps = session.providerSession;
    if (ps.launchMode === 'system' && ps.linkedSiteId) {
      return this.bridgeClient.readFhirBySite(ps.linkedSiteId, resourceType, id);
    }
    const sid = session.patientContext?.bridgeSessionId || ps.bridgeSessionId;
    if (!sid) throw new BadRequestException('No active FHIR session');
    return this.bridgeClient.readFhir(sid, resourceType, id);
  }
}

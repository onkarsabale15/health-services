import { Injectable } from '@nestjs/common';
import { logger } from '@hs/observability';
import type { FhirResource } from '@hs/bridge-client';
import type { CdsSession } from '../../services/session.service';
import { CdsResourceProviderFactory } from '../providers/cds-resource-provider.factory';
import type { FhirWriteBody } from '../providers/cds-resource-provider.interface';
import { buildProviderContext } from '../providers/base/provider-context';
import type { ProviderCapabilities } from '../providers/capabilities/capability.types';

/**
 * Cache invalidation is bridge's job — its FhirCache interceptor handles
 * `delByPattern` on writes. No cds-side coordination needed.
 *
 * Writes return the raw resource (callers already have capabilities from
 * the prior list/detail envelope).
 */
@Injectable()
export class ClinicalWriteService {
  constructor(private readonly factory: CdsResourceProviderFactory) {}

  /** Resolve the active provider's full capability declaration for the session. */
  getCapabilities(session: CdsSession): ProviderCapabilities {
    const ctx = buildProviderContext(session);
    const provider = this.factory.get(session.providerSession.ehrName);
    return provider.getCapabilities(ctx.mode);
  }

  /** Raw FHIR read for update-merge. Returns `null` on miss or bridge failure. */
  async readResource(session: CdsSession, resourceType: string, id: string): Promise<Record<string, unknown> | null> {
    const ctx = buildProviderContext(session);
    const provider = this.factory.get(session.providerSession.ehrName);
    return provider.readResource(ctx, resourceType, id);
  }

  async createResource(session: CdsSession, resourceType: string, body: FhirWriteBody): Promise<FhirResource> {
    const ctx = buildProviderContext(session);
    const provider = this.factory.get(session.providerSession.ehrName);
    const result = await provider.createResource(ctx, resourceType, body);
    logger.info('FHIR resource created via provider', {
      resourceType,
      ehrName: session.providerSession.ehrName,
      patientId: session.patientContext?.patientId,
      launchMode: session.providerSession.launchMode,
      fhirId: result?.id,
    });
    return result;
  }

  async updateResource(
    session: CdsSession,
    resourceType: string,
    id: string,
    body: FhirWriteBody,
  ): Promise<FhirResource> {
    const ctx = buildProviderContext(session);
    const provider = this.factory.get(session.providerSession.ehrName);
    const result = await provider.updateResource(ctx, resourceType, id, body);
    logger.info('FHIR resource updated via provider', {
      resourceType,
      id,
      ehrName: session.providerSession.ehrName,
      patientId: session.patientContext?.patientId,
      launchMode: session.providerSession.launchMode,
    });
    return result;
  }
}

import { Controller, Get, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { logger } from '@hs/observability';
import { cache } from '@hs/infra';
import { getEhrDefinition } from '@hs/config';
import {
  getWriteCapabilitySummary,
  canGenerateCarePlan,
  type LaunchMode,
  type ProviderCapabilities,
} from '../providers/capabilities';
import { CdsResourceProviderFactory } from '../providers/cds-resource-provider.factory';
import { CdsSessionGuard } from '../../guards/session.guard';
import { CurrentSession } from '../../decorators/session.decorator';
import type { CdsSession } from '../../services/session.service';
import { cdsAdminClient } from '../../services/admin-client.service';

const CACHE_KEY = 'cds:launcher:integrations';
const CACHE_TTL = 300; // 5 minutes

interface SiteSummary {
  id: string;
  name?: string;
  isDefault?: boolean;
  isActive?: boolean;
}

interface IntegrationEntry {
  ehrName: string;
  label: string;
  modes: Array<{ appType: string; integrationId: string; sites: SiteSummary[] }>;
  capabilities: Record<string, Record<string, boolean>>;
  carePlan: Record<string, { feasible: boolean; missingRequired: string[]; missingOptional: string[] }>;
}

interface LauncherResponse {
  ehrs: IntegrationEntry[];
}

/** Default capability response for EHRs that admin lists but CDS hasn't implemented yet. */
const UNSUPPORTED_WRITE_SUMMARY: Record<string, boolean> = {
  conditions: false,
  allergies: false,
  vitals: false,
  encounters: false,
};
const UNSUPPORTED_CARE_PLAN = {
  feasible: false,
  missingRequired: ['patient', 'condition', 'allergy', 'observation', 'medication'],
  missingOptional: ['encounter', 'appointment'],
};

@ApiTags('Launcher')
@Controller('launcher')
@UseGuards(CdsSessionGuard)
export class LauncherController {
  constructor(
    private readonly config: ConfigService,
    private readonly factory: CdsResourceProviderFactory,
  ) {}

  private capsFor(ehrName: string, mode: LaunchMode): ProviderCapabilities | null {
    const provider = this.factory.tryGet(ehrName);
    return provider?.getCapabilities(mode) ?? null;
  }

  /**
   * Returns all EHR integrations for this CDS application, grouped by EHR,
   * with modes, sites, and capability summaries.
   *
   * Used by the landing/launcher page to render EHR × mode cards.
   */
  @Get('integrations')
  @ApiOperation({ summary: 'List available EHR integrations with modes and capabilities' })
  async getIntegrations(@CurrentSession() session: CdsSession): Promise<LauncherResponse> {
    const applicationId = session.providerSession.applicationId;

    // Cache to avoid hitting admin-api on every page load
    const cached = await cache.get<LauncherResponse>(CACHE_KEY).catch(() => null);
    if (cached) return cached;

    const integrations = await cdsAdminClient.listIntegrations(applicationId);

    // Group by ehrName → aggregate modes
    const ehrMap = new Map<string, IntegrationEntry>();

    for (const integration of integrations) {
      const { ehrName, ehrAppType, id, sites } = integration;
      const def = getEhrDefinition(ehrName);
      if (!def) continue;

      if (!ehrMap.has(ehrName)) {
        ehrMap.set(ehrName, {
          ehrName,
          label: def.label,
          modes: [],
          capabilities: {},
          carePlan: {},
        });
      }

      const entry = ehrMap.get(ehrName)!;
      entry.modes.push({
        appType: ehrAppType || 'system',
        integrationId: id,
        sites: (sites || []).map(
          (s: SiteSummary): SiteSummary => ({
            id: s.id,
            name: s.name,
            isDefault: s.isDefault,
            isActive: s.isActive,
          }),
        ),
      });

      // Per-mode capability summary — derived from the resolved provider.
      // EHRs admin has configured but CDS doesn't yet implement get an
      // "everything unsupported" response so the launcher can still render
      // the card with a clear "not supported" treatment.
      const mode = (ehrAppType || 'system') as LaunchMode;
      const caps = this.capsFor(ehrName, mode);
      entry.capabilities[mode] = caps ? getWriteCapabilitySummary(caps) : UNSUPPORTED_WRITE_SUMMARY;
      entry.carePlan[mode] = caps ? canGenerateCarePlan(caps) : UNSUPPORTED_CARE_PLAN;
    }

    const result: LauncherResponse = { ehrs: Array.from(ehrMap.values()) };

    await cache.set(CACHE_KEY, result, CACHE_TTL).catch(() => {});
    logger.info('Launcher integrations loaded', { applicationId, ehrCount: result.ehrs.length });

    return result;
  }
}

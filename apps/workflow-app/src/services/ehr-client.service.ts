import { Injectable, NotFoundException } from '@nestjs/common';
import { AdminClient } from '@hs/admin-client';
import { ehrFactory, toEhrConfig, type EhrClientConfig, type SiteData } from '@hs/ehr-data-service';

/**
 * Resolves a site's EHR client + config for workflow-app.
 *
 * Uses the shared admin-client (HTTP → admin-api) — same pattern as
 * bridge-api and (eventually) mcp-app. Workflow-app does NOT touch
 * Prisma directly; admin-api is the single source of truth for
 * site/integration data.
 *
 * `siteId` (`EhrSiteConfig.id`) is the canonical input — globally unique.
 * Admin-api returns a pre-merged flat SiteData (AppEhrAccess.ehrConfig +
 * EhrSiteConfig.siteIdentifiers/siteCredentials/siteUrls), which `toEhrConfig`
 * converts to the structured `EhrClientConfig` shape.
 */
@Injectable()
export class EhrClientService {
  private readonly adminClient = new AdminClient('workflow-service');

  async getRawClient(siteId: string): Promise<{
    vendorService: ReturnType<typeof ehrFactory.getService>;
    config: EhrClientConfig;
  }> {
    const siteData = (await this.adminClient.getSite(siteId)) as SiteData | null;

    if (!siteData) {
      throw new NotFoundException(`EHR site not found for siteId: ${siteId}`);
    }

    const config = toEhrConfig(siteData);

    return {
      vendorService: ehrFactory.getService(config.ehrName),
      config,
    };
  }
}

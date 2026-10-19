import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CdsSessionGuard } from '../../guards/session.guard';
import { CdsResourceProviderFactory } from '../providers/cds-resource-provider.factory';
import type { LaunchMode, ProviderCapabilities } from '../providers/capabilities';

interface MatrixEntry {
  ehrName: string;
  byMode: Record<LaunchMode, ProviderCapabilities>;
}

/**
 * Capability introspection.
 *
 * Per-session capabilities are NOT served here — they live in the session
 * bootstrap response (`/clinical-data/session`) so the FE doesn't need a
 * separate round-trip. Per-resource capabilities live in every list/detail
 * envelope. This controller is for cross-EHR introspection only.
 */
@ApiTags('Capabilities')
@Controller('capabilities')
@UseGuards(CdsSessionGuard)
export class CapabilitiesController {
  constructor(private readonly factory: CdsResourceProviderFactory) {}

  /**
   * Cross-EHR capability matrix — every registered provider × every launch
   * mode. For ops/sales tooling that wants a "what does CDS support across
   * all configured vendors?" view.
   */
  @Get('matrix')
  @ApiOperation({ summary: 'All registered providers × all launch modes (introspection)' })
  matrix(): { providers: MatrixEntry[] } {
    const modes: LaunchMode[] = ['provider-ehr', 'provider-standalone', 'system'];
    return {
      providers: this.factory.getAll().map((p) => ({
        ehrName: p.ehrName,
        byMode: Object.fromEntries(modes.map((m) => [m, p.getCapabilities(m)])) as MatrixEntry['byMode'],
      })),
    };
  }
}

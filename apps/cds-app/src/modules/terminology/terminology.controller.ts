import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { CdsSessionGuard } from '../../guards/session.guard';
import { TerminologyService } from './terminology.service';

// ─── Throttle override ───────────────────────────────────────────────────────
//
// Terminology search is called in short bursts during Condition form entry
// — every debounced keystroke fires a search, plus a lookup on selection.
// Give these routes their own ceiling so they don't eat into the global
// per-user budget shared with clinical read endpoints.

const TERMINOLOGY_MINUTE_LIMIT = Number(process.env.CDS_TERMINOLOGY_THROTTLE_PER_MINUTE ?? 300);

/**
 * Terminology code search — powers clinical write modals.
 * All queries require min 3 characters and return max 50 results.
 */
@ApiTags('Terminology')
@Controller('terminology')
@UseGuards(CdsSessionGuard)
@Throttle({
  default: { limit: TERMINOLOGY_MINUTE_LIMIT, ttl: 60_000 },
})
export class TerminologyController {
  constructor(private readonly terminologyService: TerminologyService) {}

  @Get('icd10')
  @ApiOperation({ summary: 'Search ICD-10-CM codes' })
  @ApiQuery({ name: 'q', required: true, description: 'Search term (min 3 chars)' })
  async searchIcd10(@Query('q') q: string) {
    return this.terminologyService.searchIcd10(this.terminologyService.validateQuery(q));
  }

  @Get('snomed')
  @ApiOperation({ summary: 'Search SNOMED CT codes' })
  @ApiQuery({ name: 'q', required: true })
  async searchSnomed(@Query('q') q: string) {
    return this.terminologyService.searchSnomed(this.terminologyService.validateQuery(q));
  }

  @Get('loinc')
  @ApiOperation({ summary: 'Search LOINC codes' })
  @ApiQuery({ name: 'q', required: true })
  async searchLoinc(@Query('q') q: string) {
    return this.terminologyService.searchLoinc(this.terminologyService.validateQuery(q));
  }

  @Get('rxnorm')
  @ApiOperation({ summary: 'Search RxNorm medication codes' })
  @ApiQuery({ name: 'q', required: true })
  async searchRxnorm(@Query('q') q: string) {
    return this.terminologyService.searchRxnorm(this.terminologyService.validateQuery(q));
  }
}

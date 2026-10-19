import { Controller, Get, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  TerminologyConceptWithMappingsDto,
  TerminologyLookupQuery,
  TerminologySearchQuery,
  TerminologySearchResponseDto,
} from './dto/terminology.dto';
import { TerminologyService } from './terminology.service';

// ─── Throttle overrides ──────────────────────────────────────────────────────
//
// Terminology endpoints are called in short, bursty spikes during Condition
// form entry — each keystroke fires a search (debounced client-side) plus a
// lookup when the user picks a result. A single multi-minute form can
// easily burn 30-50 requests from one user.
//
// Give these routes their own ceiling so they don't eat into the global
// per-user budget used by clinical read endpoints. Burst tier is inherited
// from the global throttler (20 req/sec per IP) which is still appropriate
// for keystroke-driven traffic.

const TERMINOLOGY_MINUTE_LIMIT = Number(process.env.BRIDGE_TERMINOLOGY_THROTTLE_PER_MINUTE ?? 300);

// ─── Terminology Controller ──────────────────────────────────────────────────
//
// Global terminology service — not tied to any EHR. Authenticated via the
// bridge's global `DualAuthGuard` (platform JWT or API key); no site/session
// context required because the data lives in our own Postgres.
//
// Endpoints:
//
//   GET /terminology/search?system=snomed&q=malposition&limit=20
//     → { results: [{ system, systemUri, code, display, mappings: [...] }] }
//
//   GET /terminology/lookup?system=snomed&code=93342009
//     → TerminologyConceptWithMappingsDto (404 if not found)
//
// Both endpoints return the primary concept with its cross-mappings already
// attached — a single call gives the caller everything they need to build a
// multi-coded FHIR Condition / Observation / etc.

@ApiTags('Terminology')
@ApiBearerAuth()
@Controller('terminology')
@Throttle({
  default: { limit: TERMINOLOGY_MINUTE_LIMIT, ttl: 60_000 },
})
export class TerminologyController {
  constructor(private readonly terminology: TerminologyService) {}

  @Get('search')
  @ApiOperation({
    summary: 'Search terminology concepts with cross-mappings',
    description:
      'Searches the selected code system by code prefix or display text. ' +
      'Each result includes any known cross-mappings (e.g. a SNOMED search ' +
      'result includes its paired ICD-10 code).',
  })
  @ApiResponse({ status: 200, type: TerminologySearchResponseDto })
  async search(@Query() query: TerminologySearchQuery): Promise<TerminologySearchResponseDto> {
    const results = await this.terminology.search(query.system, query.q, query.limit ?? 20);
    return { results, count: results.length };
  }

  @Get('lookup')
  @ApiOperation({
    summary: 'Look up a single concept by exact code',
    description:
      'Returns the concept plus all known cross-mappings. 404 if the code ' + 'is not found in the selected system.',
  })
  @ApiResponse({ status: 200, type: TerminologyConceptWithMappingsDto })
  @ApiResponse({ status: 404, description: 'Concept not found' })
  async lookup(@Query() query: TerminologyLookupQuery): Promise<TerminologyConceptWithMappingsDto> {
    return this.terminology.lookup(query.system, query.code);
  }
}

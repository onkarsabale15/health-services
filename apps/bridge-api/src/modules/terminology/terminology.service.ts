import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { TerminologyConceptWithMappingsDto, TerminologySystem } from './dto/terminology.dto';
import { TERMINOLOGY_PROVIDERS, type ITerminologyProvider } from './providers/terminology.provider.interface';

// ─── Terminology Registry Service ────────────────────────────────────────────
//
// Thin dispatcher that routes requests to the right provider based on the
// `system` parameter. Providers are injected as an array via the
// `TERMINOLOGY_PROVIDERS` DI token, so adding a new code system is a
// one-line change in the module file — the service itself never needs to
// know about individual provider classes.

@Injectable()
export class TerminologyService {
  private readonly providers: ReadonlyMap<TerminologySystem, ITerminologyProvider>;

  constructor(
    @Inject(TERMINOLOGY_PROVIDERS)
    providers: ITerminologyProvider[],
  ) {
    this.providers = new Map(providers.map((p) => [p.system, p]));
  }

  /** Return the list of code systems currently served by this bridge. */
  getSupportedSystems(): TerminologySystem[] {
    return [...this.providers.keys()];
  }

  /** Search by text; returns concepts with cross-mappings. */
  search(system: TerminologySystem, query: string, limit: number): Promise<TerminologyConceptWithMappingsDto[]> {
    return this.getProvider(system).search(query, limit);
  }

  /** Look up a single concept; throws 404 if missing. */
  async lookup(system: TerminologySystem, code: string): Promise<TerminologyConceptWithMappingsDto> {
    const concept = await this.getProvider(system).lookup(code);
    if (!concept) {
      throw new NotFoundException(`Concept ${code} not found in ${system}`);
    }
    return concept;
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  private getProvider(system: TerminologySystem): ITerminologyProvider {
    const provider = this.providers.get(system);
    if (!provider) {
      throw new BadRequestException(
        `Unsupported code system: ${system}. ` + `Supported: ${this.getSupportedSystems().join(', ')}`,
      );
    }
    return provider;
  }
}

import { Module } from '@nestjs/common';
import { TerminologyController } from './terminology.controller';
import { TerminologyService } from './terminology.service';
import { SnomedProvider } from './providers/snomed.provider';
import { Icd10Provider } from './providers/icd10.provider';
import { TERMINOLOGY_PROVIDERS, type ITerminologyProvider } from './providers/terminology.provider.interface';

// ─── Terminology Module ──────────────────────────────────────────────────────
//
// Hosts the global terminology search/lookup API. Decoupled from the FHIR
// vendor layer — no IntegrationDataInterceptor, no SiteData — because the
// data is read straight from our own Postgres (`icd_snomed_mappings`).
//
// Adding a new code system is a minimal, closed-over-change:
//   1. Implement `ITerminologyProvider` in `providers/<name>.provider.ts`
//   2. Add the class to the `providers` array below and to the factory
//      aggregating TERMINOLOGY_PROVIDERS
//   3. Add the system URI to SYSTEM_URIS in `dto/terminology.dto.ts`
//   4. Extend SUPPORTED_SYSTEMS so the DTO validator lets it through
//
// The service and controller never change.

@Module({
  controllers: [TerminologyController],
  providers: [
    TerminologyService,

    // Concrete providers — one per code system.
    SnomedProvider,
    Icd10Provider,

    // Collects all providers into a single array injected into
    // TerminologyService via the TERMINOLOGY_PROVIDERS token.
    {
      provide: TERMINOLOGY_PROVIDERS,
      useFactory: (snomed: SnomedProvider, icd10: Icd10Provider): ITerminologyProvider[] => [snomed, icd10],
      inject: [SnomedProvider, Icd10Provider],
    },
  ],
  exports: [TerminologyService],
})
export class TerminologyModule {}

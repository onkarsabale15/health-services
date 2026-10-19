import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { ServicesModule } from '../../services/services.module';
import { StandardFhirR4Provider } from './base/standard-fhir-r4.provider';
import { CdsResourceProviderFactory } from './cds-resource-provider.factory';
import { EnvelopeBuilderService } from './envelope-builder.service';
import { CernerProvider } from './cerner/cerner.provider';

/**
 * Holds the per-EHR provider strategies plus the envelope builder.
 *
 * Adding a new EHR = add the import + a single line in `providers`. The
 * factory discovers it at boot via NestJS `DiscoveryService` — no other
 * file needs to change. EHRs without an explicit provider class fall
 * through to `StandardFhirR4Provider` with conservative defaults.
 *
 * Today only Cerner has a vendor-specific provider class because that's
 * the only EHR CDS has been exercised against end-to-end (write rules,
 * capability gating, FE forms). When CDS launches against another EHR
 * in practice, add its provider class here following the Cerner pattern.
 */
@Module({
  imports: [ServicesModule, DiscoveryModule],
  providers: [StandardFhirR4Provider, CernerProvider, CdsResourceProviderFactory, EnvelopeBuilderService],
  exports: [CdsResourceProviderFactory, EnvelopeBuilderService],
})
export class ProvidersModule {}

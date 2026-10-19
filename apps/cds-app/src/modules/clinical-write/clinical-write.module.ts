import { Module } from '@nestjs/common';
import { ClinicalWriteController } from './clinical-write.controller';
import { ClinicalWriteService } from './clinical-write.service';
import { ConditionBodyBuilder } from './condition-body.builder';
import { ProvidersModule } from '../providers/providers.module';

// `FhirCodingEnricher`, `BridgeClientService`, etc. come from the @Global
// `ServicesModule` — no need to list them here.
@Module({
  imports: [ProvidersModule],
  controllers: [ClinicalWriteController],
  providers: [ClinicalWriteService, ConditionBodyBuilder],
})
export class ClinicalWriteModule {}

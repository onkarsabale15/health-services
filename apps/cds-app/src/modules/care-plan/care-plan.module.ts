import { Module } from '@nestjs/common';
import { CarePlanController } from './care-plan.controller';
import { CarePlanService } from './care-plan.service';
import { CarePlanPdfService } from './care-plan-pdf.service';
import { FhirMapperService } from './fhir-mapper.service';
import { ProvidersModule } from '../providers/providers.module';

@Module({
  imports: [ProvidersModule],
  controllers: [CarePlanController],
  providers: [CarePlanService, CarePlanPdfService, FhirMapperService],
  exports: [CarePlanService, FhirMapperService],
})
export class CarePlanModule {}

import { Module } from '@nestjs/common';
import { AnalysisController } from './analysis.controller';
import { AnalysisService } from './analysis.service';
import { ClinicalDataModule } from '../clinical-data/clinical-data.module';
import { CarePlanModule } from '../care-plan/care-plan.module';

@Module({
  imports: [ClinicalDataModule, CarePlanModule],
  controllers: [AnalysisController],
  providers: [AnalysisService],
  exports: [AnalysisService],
})
export class AnalysisModule {}

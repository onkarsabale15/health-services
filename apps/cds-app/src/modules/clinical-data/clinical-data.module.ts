import { Module } from '@nestjs/common';
import { ClinicalDataController } from './clinical-data.controller';
import { ClinicalDataService } from './clinical-data.service';
import { ProvidersModule } from '../providers/providers.module';

@Module({
  imports: [ProvidersModule],
  controllers: [ClinicalDataController],
  providers: [ClinicalDataService],
  exports: [ClinicalDataService],
})
export class ClinicalDataModule {}

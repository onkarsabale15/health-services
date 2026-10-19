import { Module } from '@nestjs/common';
import { EhrConfigController } from './ehr-config.controller';

@Module({
  controllers: [EhrConfigController],
})
export class EhrConfigModule {}

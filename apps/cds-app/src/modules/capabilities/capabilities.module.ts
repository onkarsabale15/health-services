import { Module } from '@nestjs/common';
import { CapabilitiesController } from './capabilities.controller';
import { ProvidersModule } from '../providers/providers.module';

@Module({
  imports: [ProvidersModule],
  controllers: [CapabilitiesController],
})
export class CapabilitiesModule {}

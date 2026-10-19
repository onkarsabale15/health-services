import { Module } from '@nestjs/common';
import { LauncherController } from './launcher.controller';
import { ProvidersModule } from '../providers/providers.module';

@Module({
  imports: [ProvidersModule],
  controllers: [LauncherController],
})
export class LauncherModule {}

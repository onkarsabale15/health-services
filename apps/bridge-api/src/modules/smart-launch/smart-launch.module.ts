import { Module } from '@nestjs/common';
import { SmartLaunchController } from './smart-launch.controller';

@Module({
  controllers: [SmartLaunchController],
})
export class SmartLaunchModule {}

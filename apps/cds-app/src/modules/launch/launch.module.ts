import { Module } from '@nestjs/common';
import { LaunchController } from './launch.controller';
import { AuthProxyController } from './auth-proxy.controller';

@Module({
  controllers: [LaunchController, AuthProxyController],
})
export class LaunchModule {}

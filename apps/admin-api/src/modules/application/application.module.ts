import { Module } from '@nestjs/common';
import { ApplicationController } from './application.controller';
import { ApplicationService } from './application.service';
import { JwksService } from './jwks.service';

@Module({
  controllers: [ApplicationController],
  providers: [ApplicationService, JwksService],
  exports: [ApplicationService],
})
export class ApplicationModule {}

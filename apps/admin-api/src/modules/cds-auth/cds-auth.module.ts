import { Module } from '@nestjs/common';
import { CdsAuthController } from './cds-auth.controller';

@Module({
  controllers: [CdsAuthController],
})
export class CdsAuthModule {}

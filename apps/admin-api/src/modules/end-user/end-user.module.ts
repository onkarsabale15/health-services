import { Module } from '@nestjs/common';
import { EndUserController } from './end-user.controller';
import { EndUserService } from './end-user.service';
import { InternalAccessController } from './internal-access.controller';
import { MeController } from './me.controller';
import { OAuthModule } from '../oauth/oauth.module';

@Module({
  imports: [OAuthModule],
  controllers: [EndUserController, InternalAccessController, MeController],
  providers: [EndUserService],
  exports: [EndUserService],
})
export class EndUserModule {}

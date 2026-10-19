import { Module } from '@nestjs/common';
import { OAuthController } from './oauth.controller';
import { UserInfoController } from './userinfo.controller';
import { LogoutController } from './logout.controller';
import { ConsentController } from './consent.controller';
import { ConsentService } from './consent.service';

@Module({
  controllers: [OAuthController, UserInfoController, LogoutController, ConsentController],
  providers: [ConsentService],
  exports: [ConsentService],
})
export class OAuthModule {}

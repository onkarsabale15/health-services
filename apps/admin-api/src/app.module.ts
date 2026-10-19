import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard, ThrottlerStorage } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './modules/auth/auth.module';
import { OAuthModule } from './modules/oauth/oauth.module';
import { OrganizationModule } from './modules/organization/organization.module';
import { UserModule } from './modules/user/user.module';
import { ApplicationModule } from './modules/application/application.module';
import { EhrConfigModule } from './modules/ehr-config/ehr-config.module';
import { LlmConfigModule } from './modules/llm-config/llm-config.module';
import { WorkflowModule } from './modules/workflow/workflow.module';
import { HealthModule } from './modules/health/health.module';
import { CdsAuthModule } from './modules/cds-auth/cds-auth.module';
import { EndUserModule } from './modules/end-user/end-user.module';

import { RequestTimingMiddleware } from '@hs/observability';
import { identityTracker } from './guards/throttle-tracker';
import { RedisThrottleStorage } from './guards/redis-throttle-storage';
import { PlatformAuthGuard } from './guards/platform-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000,
        limit: 200,
        getTracker: identityTracker, // userId > clientId > email > IP
      },
      {
        name: 'burst',
        ttl: 1000,
        limit: 10,
        // No custom tracker → uses req.ip (per-second burst protection)
      },
    ]),
    AuthModule,
    OAuthModule,
    OrganizationModule,
    UserModule,
    ApplicationModule,
    EhrConfigModule,
    LlmConfigModule,
    WorkflowModule,
    HealthModule,
    CdsAuthModule,
    EndUserModule,
  ],
  providers: [
    { provide: ThrottlerStorage, useClass: RedisThrottleStorage },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: PlatformAuthGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestTimingMiddleware).forRoutes('*');
  }
}

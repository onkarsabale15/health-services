import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard, ThrottlerStorage } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { CoreProvidersModule } from './core-providers/core-providers.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
// ConnectionModule removed — token management now handled by BaseEhrService at package level
import { SmartLaunchModule } from './modules/smart-launch/smart-launch.module';
import { FhirModule } from './modules/fhir/fhir.module';
import { TerminologyModule } from './modules/terminology/terminology.module';
import { RequestTimingMiddleware } from '@hs/observability';
import { identityTracker } from './guards/throttle-tracker';
import { RedisThrottleStorage } from './guards/redis-throttle-storage';

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
        limit: 600,
        getTracker: identityTracker, // clientId > userId > IP
      },
      {
        name: 'burst',
        ttl: 1000,
        limit: 20,
        // No custom tracker → req.ip (per-second burst protection)
      },
    ]),
    CoreProvidersModule,
    AuthModule,
    HealthModule,
    SmartLaunchModule,
    FhirModule,
    TerminologyModule,
  ],
  providers: [
    { provide: ThrottlerStorage, useClass: RedisThrottleStorage },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestTimingMiddleware).forRoutes('*');
  }
}

import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ServicesModule } from './services/services.module';
import { HealthModule } from './modules/health/health.module';
import { LaunchModule } from './modules/launch/launch.module';
import { AnalysisModule } from './modules/analysis/analysis.module';
import { ClinicalDataModule } from './modules/clinical-data/clinical-data.module';
import { CarePlanModule } from './modules/care-plan/care-plan.module';
import { PatientModule } from './modules/patient/patient.module';
import { ClinicalWriteModule } from './modules/clinical-write/clinical-write.module';
import { TerminologyModule } from './modules/terminology/terminology.module';
import { LauncherModule } from './modules/launcher/launcher.module';
import { CapabilitiesModule } from './modules/capabilities/capabilities.module';
import { RequestTimingMiddleware } from '@hs/observability';
import { appConfig } from './config/app.config';
import { cdsIdentityTracker } from './guards/throttle-tracker';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
      load: [appConfig],
    }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000,
        limit: 100,
        getTracker: cdsIdentityTracker,
      },
      {
        name: 'burst',
        ttl: 1000,
        limit: 10,
      },
    ]),
    ServicesModule,
    HealthModule,
    LaunchModule,
    AnalysisModule,
    ClinicalDataModule,
    CarePlanModule,
    PatientModule,
    ClinicalWriteModule,
    TerminologyModule,
    LauncherModule,
    CapabilitiesModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestTimingMiddleware).forRoutes('*');
  }
}

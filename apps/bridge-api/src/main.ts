import './instrument';
import { INestApplication } from '@nestjs/common';
import { bootstrapNestApp } from '@hs/bootstrap';
import { cache, db } from '@hs/infra';
import { AppModule } from './app.module';
import { initEhr } from './core-providers/register-ehr-vendors';
import { registerVendorDataServices } from './services/register-vendor-services';
import { FhirResponseInterceptor } from './interceptors/fhir-response.interceptor';
import { GlobalExceptionFilter } from './filters/global-exception.filter';

bootstrapNestApp({
  appModule: AppModule,
  serviceName: 'bridge-api',
  port: 3000,
  secrets: ['DATABASE_URL', 'REDISURL', 'ENVIRONMENT', 'OAUTH_ISSUER', 'ADMIN_API_URL', 'BRIDGE_API_URL'],
  swaggerTitle: 'Integration Engine API',
  swaggerDescription: 'FHIR R4 EHR Bridge',
  extraInit: async (app: INestApplication) => {
    // 1. Init and connect infrastructure
    cache.init({ url: process.env.REDISURL });
    await cache.connect();

    db.init({ url: process.env.DATABASE_URL });
    await db.connect();

    // 2. Initialize EHR data service (registers vendors + injects cache)
    initEhr(cache);

    // 3. Register bridge vendor data services (mapping layer)
    registerVendorDataServices();

    // 4. Global Interceptors and Filters
    app.useGlobalInterceptors(new FhirResponseInterceptor());
    app.useGlobalFilters(new GlobalExceptionFilter());
  },
});

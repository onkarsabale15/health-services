import './instrument';
import { INestApplication } from '@nestjs/common';
import { bootstrapNestApp } from '@hs/bootstrap';
import { db } from '@hs/infra';
import { cache } from '@hs/infra';
import { messaging } from '@hs/infra';
import { mailer } from '@hs/mailer';
import { logger } from '@hs/observability';
import { AppModule } from './app.module';
import { createPrismaCacheExtension } from './cache/prisma-cache.extension';
import { AuditInterceptor } from './interceptors/audit.interceptor';

bootstrapNestApp({
  appModule: AppModule,
  serviceName: 'admin-api',
  port: 3002,
  secrets: [
    'DATABASE_URL',
    'REDISURL',
    'KAFKA_BROKERS',
    'KAFKA_CA_CERT',
    'KAFKA_SASL_USERNAME',
    'KAFKA_SASL_PASSWORD',
    'OAUTH_ISSUER',
  ],
  swaggerTitle: 'Health Services Admin API',
  swaggerDescription: 'OAuth 2.0 Authorization Server + Organization/Application Management',
  extraInit: async (app: INestApplication) => {
    // 1. Initialize cache first
    cache.init({ url: process.env.REDISURL });
    await cache.connect();

    // 2. Initialize async messaging
    messaging.init({ clientId: 'admin-api' });
    await messaging.connect();

    // 3. Initialize DB and apply Prisma cache extension
    db.init({ url: process.env.DATABASE_URL });
    db.extend(createPrismaCacheExtension(cache));
    await db.connect();

    // 4. Initialize mailer. Provider chosen by env: 'ses' (prod), 'mailtrap'
    // (dev with sandbox), or 'console' (fallback). Templates ship with the
    // package; callers use mailer.sendOtp / sendInvite / sendAccessPending.
    const mailProvider = (process.env.MAIL_PROVIDER as 'ses' | 'mailtrap' | 'console') || 'console';
    mailer.init({
      provider: mailProvider,
      defaultFrom: process.env.MAIL_FROM ?? 'no-reply@example.com',
      awsRegion: process.env.AWS_REGION,
    });

    // 5. Global Interceptors
    app.useGlobalInterceptors(new AuditInterceptor());

    // 6. Graceful shutdown
    process.on('SIGTERM', async () => {
      await messaging.disconnect().catch(() => {});
    });

    // 7. Production validation
    if (process.env.NODE_ENV === 'production') {
      const issuer = process.env.OAUTH_ISSUER;
      if (!issuer || !issuer.startsWith('https://')) {
        logger.error('OAUTH_ISSUER must be set to an HTTPS URL in production', new Error('Invalid OAUTH_ISSUER'));
      }
    }
  },
});

import './instrument';
import 'dotenv/config';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { tracing } from '@hs/observability';
import { logger } from '@hs/observability';
import { secrets } from '@hs/infra';
import { cache } from '@hs/infra';
import { db } from '@hs/infra';
import { httpClient } from '@hs/infra';
import { NestExpressApplication } from '@nestjs/platform-express';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, RequestMethod } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  tracing.init({ serviceName: 'cds-app' });
  logger.init({ service: 'cds-app' });

  // Load secrets from Doppler into process.env BEFORE NestJS boots
  await secrets.loadSecrets([
    'DATABASE_URL',
    'REDISURL',
    'GEMINI_API_KEY',
    'CDS_FRONTEND_URL',
    'CDS_CLIENT_ID',
    'CDS_CLIENT_SECRET',
    'ALLOWED_ORIGINS',
    'BRIDGE_API_URL',
    'ADMIN_API_URL',
    'OAUTH_ISSUER',
    'SUPABASE_STORAGE_ENDPOINT',
    'SUPABASE_STORAGE_ACCESS_KEY',
    'SUPABASE_STORAGE_SECRET_KEY',
    'SUPABASE_STORAGE_BUCKET',
  ]);

  cache.init({ url: process.env.REDISURL });
  await cache.connect();

  db.init({ url: process.env.DATABASE_URL });
  await db.connect();

  httpClient.init({ timeout: 60000 });

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.set('trust proxy', 1);

  // Read typed config (loaded after Doppler secrets are in process.env)
  const config = app.get(ConfigService);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
    }),
  );
  app.use(cookieParser());

  const cdsFrontendUrl = config.get<string>('app.cdsFrontendUrl')!.replace(/\/$/, '');
  logger.info('CDS config loaded', {
    cdsFrontendUrl,
    bridgeApiUrl: config.get('app.bridgeApiUrl'),
    oauthIssuer: config.get('app.oauthIssuer'),
    cdsClientId: config.get('app.cdsClientId') ? '***set***' : 'MISSING',
  });
  const allowedOrigins = config.get<string[]>('app.allowedOrigins')!.map((origin) => origin.replace(/\/$/, ''));
  app.enableCors({
    origin: [...allowedOrigins, cdsFrontendUrl],
    credentials: true,
  });

  if (process.env.NODE_ENV !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('CDS Application API')
      .setDescription('Clinical Decision Support — SMART launch + AI analysis')
      .setVersion('1.0.0')
      .build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig));
  }

  app.setGlobalPrefix('api', {
    exclude: [
      '/',
      'health',
      { path: 'launch', method: RequestMethod.ALL },
      { path: 'launch/(.*)', method: RequestMethod.ALL },
    ],
  });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.enableShutdownHooks();

  const port = config.get<number>('app.port')!;
  await app.listen(port);
  logger.info('Service started', { service: 'cds-app', port });
}

bootstrap();

import 'dotenv/config';
import helmet from 'helmet';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { tracing, AuditLoggingInterceptor, requestIdMiddleware } from '@hs/observability';
import { logger } from '@hs/observability';
import { secrets } from '@hs/infra';
import { trace, context, propagation } from '@opentelemetry/api';

export interface BootstrapOptions {
  appModule: any;
  serviceName: string;
  port: number | string;
  secrets?: string[];
  globalPrefix?: string;
  excludePrefix?: string[];
  swaggerTitle?: string;
  swaggerDescription?: string;
  corsOrigins?: string[];
  extraInit?: (app: INestApplication) => Promise<void> | void;
}

/**
 * Standard bootstrap function for all Health Services NestJS applications.
 * Handles tracing, logging, security, swagger, and infrastructure init.
 */
export async function bootstrapNestApp(options: BootstrapOptions) {
  const {
    appModule,
    serviceName,
    port,
    secrets: secretsToLoad = [],
    globalPrefix = 'api',
    excludePrefix = ['/', 'health'],
    swaggerTitle,
    swaggerDescription,
    corsOrigins,
    extraInit,
  } = options;

  // 1. Initialize Observability (Tracing & Logging)
  tracing.init({ serviceName });
  logger.init({ service: serviceName });

  // 2. Load Secrets from Doppler
  if (secretsToLoad.length > 0) {
    await secrets.loadSecrets(secretsToLoad);
  }

  // 3. Create NestJS App
  const app = await NestFactory.create(appModule);

  // 3.5 Extract traceparent from query if it exists so entire request inherits it
  app.use((req: any, res: any, next: any) => {
    if (req.query && req.query.traceparent) {
      const carrier = { traceparent: decodeURIComponent(req.query.traceparent) };
      const extracted = propagation.extract(context.active(), carrier);
      context.with(extracted, () => next());
    } else {
      next();
    }
  });

  // 4. Request ID — runs before everything else so audit logs + spans carry it.
  app.use(requestIdMiddleware);

  // 5. Security Headers (Helmet)
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          frameAncestors: ["'none'"],
        },
      },
    }),
  );

  // 5. CORS — permissive by default ("allow all"); tighten by passing `corsOrigins`
  // or setting ALLOWED_ORIGINS to a comma-separated list. `*` or unset reflects the request origin.
  const explicitOrigins =
    corsOrigins ||
    process.env.ALLOWED_ORIGINS?.split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  const allowAll = !explicitOrigins || explicitOrigins.length === 0 || explicitOrigins.includes('*');
  app.enableCors({
    origin: allowAll ? true : explicitOrigins,
    credentials: true,
  });

  // 6. Global Prefix
  app.setGlobalPrefix(globalPrefix, { exclude: excludePrefix });

  // 7. Swagger — mounted in ALL environments (incl. production) whenever a
  // service provides a title. Docs at `${globalPrefix}/docs` are public.
  if (swaggerTitle) {
    const config = new DocumentBuilder()
      .setTitle(swaggerTitle)
      .setDescription(swaggerDescription || '')
      .setVersion('1.0.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup(`${globalPrefix}/docs`, app, document);
  }

  // 8. Global Interceptors, Filters, Pipes
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.useGlobalInterceptors(new AuditLoggingInterceptor());
  app.enableShutdownHooks();

  // 9. Extra Application-specific initialization
  if (extraInit) {
    await extraInit(app);
  }

  // 10. Start Server
  const finalPort = process.env.PORT || port;
  await app.listen(finalPort);

  logger.info(`${serviceName} started`, { service: serviceName, port: finalPort });

  return app;
}

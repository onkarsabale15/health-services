import './instrument';
import { INestApplication } from '@nestjs/common';
import { bootstrapNestApp } from '@hs/bootstrap';
import { cache } from '@hs/infra';
import { db } from '@hs/infra';
import { httpClient } from '@hs/infra';
import { messaging } from '@hs/infra';
import { AppModule } from './app.module';

bootstrapNestApp({
  appModule: AppModule,
  serviceName: 'workflow-executor',
  port: 3004,
  secrets: [
    'DATABASE_URL',
    'REDISURL',
    'KAFKA_BROKERS',
    'KAFKA_CA_CERT',
    'KAFKA_SASL_USERNAME',
    'KAFKA_SASL_PASSWORD',
    'GEMINI_API_KEY',
  ],
  swaggerTitle: 'Workflow Executor',
  swaggerDescription: 'Headless Kafka consumer — executes workflows via DAG engine',
  extraInit: async (app: INestApplication) => {
    // 1. Infrastructure init
    cache.init({ url: process.env.REDISURL });
    await cache.connect();

    db.init({ url: process.env.DATABASE_URL });
    await db.connect();

    httpClient.init({ timeout: 30000 });

    // 2. Messaging init
    messaging.init({ clientId: 'workflow-executor' });
    await messaging.connect();
  },
});

/**
 * Extracts OpenAPI spec from admin-api's compiled output.
 *
 * Requires admin-api to be built first (Turbo ensures this via dependsOn).
 * Infrastructure packages use lazy-init, so no connections are established.
 */
const { resolve } = require('path');
const { writeFileSync } = require('fs');

// Prevent infrastructure from connecting
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://x:x@localhost:5432/x';
process.env.REDISURL = process.env.REDISURL || 'redis://localhost:6379';
process.env.DOPPLER_TOKEN = '';
process.env.KAFKA_BROKERS = '';

async function main() {
  require('reflect-metadata');

  const { NestFactory } = require('@nestjs/core');
  const { SwaggerModule, DocumentBuilder } = require('@nestjs/swagger');

  // Import the compiled AppModule from admin-api dist
  const adminApiPath = resolve(__dirname, '../../../../../admin-api/dist/app.module');
  const { AppModule } = require(adminApiPath);

  // Create app without starting — just need decorator metadata
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api', {
    exclude: ['/', 'health', '.well-known/(.*)', 'oauth/(.*)'],
  });

  const config = new DocumentBuilder()
    .setTitle('Health Services Admin API')
    .setDescription('OAuth 2.0 Authorization Server + Organization/Application Management — auto-generated OpenAPI spec')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);

  const outputPath = resolve(__dirname, '../openapi.json');
  writeFileSync(outputPath, JSON.stringify(document, null, 2));

  await app.close();
  console.log(`Admin API OpenAPI spec generated: ${outputPath}`);
  console.log(`  Paths: ${Object.keys(document.paths || {}).length}`);
  console.log(`  Schemas: ${Object.keys(document.components?.schemas || {}).length}`);
}

main().catch(err => {
  console.error('Spec generation failed:', err.message);
  process.exit(1);
});

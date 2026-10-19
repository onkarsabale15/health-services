import './instrument';
import type { INestApplication } from '@nestjs/common';
import { bootstrapNestApp } from '@hs/bootstrap';
import { cache, httpClient } from '@hs/infra';
import { initEhr } from '@hs/ehr-data-service';
import { AppModule } from './app.module';

/**
 * mcp-app — MCP server exposing EHR vendor methods as LLM tools.
 *
 * Single transport: **MCP Streamable HTTP** at `POST /api/mcp` (the `api`
 * global prefix is applied by `bootstrapNestApp`). Spec-compliant JSON-RPC
 * 2.0 — any MCP HTTP client (Gemini CLI, Claude, custom agents) connects by
 * URL. Per-request `Authorization: Bearer <token>` carries the `siteId`
 * (PR7 adds JWKS verification + OAuth 2.1 / DCR).
 *
 * The vendor catalog is built once at boot from `@hs/ehr-data-service`'s
 * `allVendorTools` (generated). Site lookups (credentials + URLs) go through
 * `@hs/admin-client` (HTTP → admin-api), NOT direct DB.
 */
bootstrapNestApp({
  appModule: AppModule,
  serviceName: 'mcp-app',
  port: 3005,
  secrets: ['REDISURL', 'HS_PLATFORM_JWKS'],
  swaggerTitle: 'MCP Server',
  swaggerDescription: 'Model Context Protocol server exposing EHR vendor methods as LLM tools',
  extraInit: async (_app: INestApplication) => {
    // Cache: token cache for vendor OAuth tokens (shared with bridge/workflow).
    cache.init({ url: process.env.REDISURL });
    await cache.connect();

    // HTTP client: outbound calls to admin-api + EHR vendors.
    httpClient.init({ timeout: 30000 });

    // Register the vendor services in ehrFactory (+ wire the token cache) so
    // tools/call can resolve `ehrFactory.getService(ehrName)`. Without this the
    // catalog still lists tools (it's static) but every call throws
    // "Unsupported EHR provider".
    initEhr(cache);
  },
});

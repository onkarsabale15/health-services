import { registerAs } from '@nestjs/config';

/**
 * Centralized, typed configuration for cds-app.
 *
 * All environment variables are read here — no process.env scattered across services.
 * Loaded after Doppler injects secrets into process.env in main.ts.
 *
 * Usage: inject ConfigService, then config.get('app.bridgeApiUrl')
 * Or inject the typed config: @Inject(appConfig.KEY) config: AppConfig
 */
export const appConfig = registerAs('app', () => ({
  // ── Server ──────────────────────────────────────────────
  port: parseInt(process.env.PORT || '3003', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // ── Service URLs ────────────────────────────────────────
  bridgeApiUrl: (() => {
    const rawUrl = (process.env.BRIDGE_API_URL || 'http://localhost:3000/api').trim().replace(/\/$/, '');
    return rawUrl.endsWith('/api') ? rawUrl : `${rawUrl}/api`;
  })(),
  adminApiUrl: process.env.ADMIN_API_URL || 'http://localhost:3002',
  cdsFrontendUrl: process.env.CDS_FRONTEND_URL || 'http://localhost:3007',
  allowedOrigins:
    process.env.ALLOWED_ORIGINS?.split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0) || [],

  // ── Auth ────────────────────────────────────────────────
  oauthIssuer: process.env.OAUTH_ISSUER || 'http://localhost:3002',
  cdsClientId: process.env.CDS_CLIENT_ID || '',
  cdsClientSecret: process.env.CDS_CLIENT_SECRET || '', // fallback for symmetric JWE

  // ── LLM ─────────────────────────────────────────────────
  defaultLlmProvider: 'gemini' as const,
  defaultLlmModel: 'gemini-2.5-flash',

  // ── Storage (Supabase S3-compatible) ─────────────────────
  supabaseStorageEndpoint: process.env.SUPABASE_STORAGE_ENDPOINT || '',
  supabaseStorageAccessKey: process.env.SUPABASE_STORAGE_ACCESS_KEY || '',
  supabaseStorageSecretKey: process.env.SUPABASE_STORAGE_SECRET_KEY || '',
  supabaseStorageBucket: process.env.SUPABASE_STORAGE_BUCKET || 'care-plan-pdfs',
  supabaseStorageRegion: process.env.SUPABASE_STORAGE_REGION || 'us-east-1',
  pdfSignedUrlTtl: parseInt(process.env.PDF_SIGNED_URL_TTL || '3600', 10),

  // ── Secrets ─────────────────────────────────────────────
  platformJwksSecret: 'HS_PLATFORM_JWKS',
}));

export type AppConfig = ReturnType<typeof appConfig>;

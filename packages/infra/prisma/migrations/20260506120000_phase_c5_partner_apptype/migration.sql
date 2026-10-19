-- Phase C5: extend AppType enum with PARTNER for OIDC-only third-party apps.
-- Non-destructive: existing rows keep their values.

ALTER TYPE "AppType" ADD VALUE IF NOT EXISTS 'PARTNER';

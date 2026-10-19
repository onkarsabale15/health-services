-- Phase C: IdP baseline — EndUser family + Application.auto_provisioning_policy.
-- Includes a backfill from cds_providers → end_users + end_user_app_access.
--
-- IMPORTANT: applied via `prisma migrate deploy` (non-shadow). Backfill is
-- idempotent (ON CONFLICT DO NOTHING) so re-runs are safe.

-- ─── Application: auto-provisioning policy ──────────────────────────────────

ALTER TABLE "applications"
  ADD COLUMN "auto_provisioning_policy" TEXT NOT NULL DEFAULT 'closed';

-- Preserve current behavior on existing apps: if any of an app's EHR
-- integrations is in "open" provider-restriction mode, the app is effectively
-- open today — set policy to 'open'. Apps where ALL integrations are
-- 'restricted' map to 'closed'. Apps with no integrations stay at 'closed'
-- (the column default).
UPDATE "applications" a
SET "auto_provisioning_policy" = 'open'
WHERE EXISTS (
  SELECT 1 FROM "app_ehr_access" e
  WHERE e."application_id" = a."id"
    AND e."provider_restriction" = 'open'
);

-- ─── End User core ──────────────────────────────────────────────────────────

CREATE TABLE "end_users" (
  "id"               UUID NOT NULL,
  "email"            TEXT NOT NULL,
  "email_verified"   BOOLEAN NOT NULL DEFAULT FALSE,
  "first_name"       TEXT,
  "last_name"        TEXT,
  "npi"              TEXT,
  "specialty"        TEXT,
  "status"           "UserStatus" NOT NULL DEFAULT 'PENDING',
  "organization_id"  UUID,
  "invited_at"       TIMESTAMP(3),
  "invited_by_id"    UUID,
  "last_login_at"    TIMESTAMP(3),
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "end_users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "end_users_email_key"        ON "end_users"("email");
CREATE INDEX        "end_users_organization_id_idx" ON "end_users"("organization_id");
CREATE INDEX        "end_users_email_idx"           ON "end_users"("email");
ALTER TABLE "end_users"
  ADD CONSTRAINT "end_users_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── EndUser → App access ───────────────────────────────────────────────────

CREATE TABLE "end_user_app_access" (
  "id"             UUID NOT NULL,
  "end_user_id"    UUID NOT NULL,
  "application_id" UUID NOT NULL,
  "access_level"   "AccessLevel" NOT NULL DEFAULT 'FULL',
  "granted_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "granted_by_id"  UUID,
  "grant_source"   TEXT NOT NULL DEFAULT 'manual',
  "revoked_at"     TIMESTAMP(3),
  "revoked_by_id"  UUID,
  CONSTRAINT "end_user_app_access_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "end_user_app_access_end_user_id_application_id_key" ON "end_user_app_access"("end_user_id", "application_id");
CREATE INDEX        "end_user_app_access_end_user_id_idx"               ON "end_user_app_access"("end_user_id");
CREATE INDEX        "end_user_app_access_application_id_idx"            ON "end_user_app_access"("application_id");
ALTER TABLE "end_user_app_access"
  ADD CONSTRAINT "end_user_app_access_end_user_id_fkey"
  FOREIGN KEY ("end_user_id") REFERENCES "end_users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "end_user_app_access"
  ADD CONSTRAINT "end_user_app_access_application_id_fkey"
  FOREIGN KEY ("application_id") REFERENCES "applications"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── EndUser → Site access ──────────────────────────────────────────────────

CREATE TABLE "end_user_site_access" (
  "id"            UUID NOT NULL,
  "end_user_id"   UUID NOT NULL,
  "site_id"       UUID NOT NULL,
  "access_level"  "AccessLevel" NOT NULL DEFAULT 'FULL',
  "granted_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "granted_by_id" UUID,
  "revoked_at"    TIMESTAMP(3),
  CONSTRAINT "end_user_site_access_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "end_user_site_access_end_user_id_site_id_key" ON "end_user_site_access"("end_user_id", "site_id");
CREATE INDEX        "end_user_site_access_end_user_id_idx"         ON "end_user_site_access"("end_user_id");
CREATE INDEX        "end_user_site_access_site_id_idx"             ON "end_user_site_access"("site_id");
ALTER TABLE "end_user_site_access"
  ADD CONSTRAINT "end_user_site_access_end_user_id_fkey"
  FOREIGN KEY ("end_user_id") REFERENCES "end_users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "end_user_site_access"
  ADD CONSTRAINT "end_user_site_access_site_id_fkey"
  FOREIGN KEY ("site_id") REFERENCES "ehr_site_configs"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── EndUser external identity (EHR id_token mapping) ───────────────────────

CREATE TABLE "end_user_external_identities" (
  "id"             UUID NOT NULL,
  "end_user_id"    UUID NOT NULL,
  "ehr_name"       TEXT NOT NULL,
  "fhir_id"        TEXT NOT NULL,
  "email_at_seen"  TEXT,
  "first_seen_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_seen_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "end_user_external_identities_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "end_user_external_identities_ehr_name_fhir_id_key" ON "end_user_external_identities"("ehr_name", "fhir_id");
CREATE INDEX        "end_user_external_identities_end_user_id_idx"      ON "end_user_external_identities"("end_user_id");
ALTER TABLE "end_user_external_identities"
  ADD CONSTRAINT "end_user_external_identities_end_user_id_fkey"
  FOREIGN KEY ("end_user_id") REFERENCES "end_users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Consent grants (partner OIDC) ──────────────────────────────────────────

CREATE TABLE "consent_grants" (
  "id"           UUID NOT NULL,
  "end_user_id"  UUID NOT NULL,
  "client_id"    TEXT NOT NULL,
  "scopes"       TEXT[],
  "granted_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at"   TIMESTAMP(3),
  "revoked_at"   TIMESTAMP(3),
  "last_used_at" TIMESTAMP(3),
  CONSTRAINT "consent_grants_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "consent_grants_end_user_id_client_id_key" ON "consent_grants"("end_user_id", "client_id");
CREATE INDEX        "consent_grants_end_user_id_idx"           ON "consent_grants"("end_user_id");
CREATE INDEX        "consent_grants_client_id_idx"             ON "consent_grants"("client_id");
ALTER TABLE "consent_grants"
  ADD CONSTRAINT "consent_grants_end_user_id_fkey"
  FOREIGN KEY ("end_user_id") REFERENCES "end_users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Backfill: cds_providers → end_users + end_user_app_access ──────────────
--
-- Dedup by email. Existing CdsProvider rows become ACTIVE EndUsers (they
-- were already authenticating successfully, so email_verified=true).
-- One EndUserAppAccess row per (CdsProvider.applicationId), grant_source='manual'.

INSERT INTO "end_users" (
  "id", "email", "email_verified", "first_name", "last_name", "npi",
  "specialty", "status", "organization_id", "created_at", "updated_at"
)
SELECT
  gen_random_uuid(),
  cp."email",
  TRUE,
  cp."first_name",
  cp."last_name",
  cp."npi",
  cp."specialty",
  'ACTIVE',
  cp."organization_id",
  cp."created_at",
  cp."updated_at"
FROM "cds_providers" cp
WHERE cp."is_active" = TRUE
ON CONFLICT ("email") DO NOTHING;

INSERT INTO "end_user_app_access" (
  "id", "end_user_id", "application_id", "access_level",
  "granted_at", "grant_source"
)
SELECT
  gen_random_uuid(),
  eu."id",
  cp."application_id",
  'FULL',
  cp."created_at",
  'manual'
FROM "cds_providers" cp
JOIN "end_users" eu ON eu."email" = cp."email"
WHERE cp."is_active" = TRUE
ON CONFLICT ("end_user_id", "application_id") DO NOTHING;

-- CreateTable
CREATE TABLE "ehr_site_configs" (
    "id" UUID NOT NULL,
    "ehr_access_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "site_identifiers" JSONB NOT NULL DEFAULT '{}',
    "site_credentials" JSONB,
    "site_urls" JSONB,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "status" "AppStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ehr_site_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ehr_site_configs_ehr_access_id_name_key" ON "ehr_site_configs"("ehr_access_id", "name");

-- CreateIndex
CREATE INDEX "ehr_site_configs_ehr_access_id_idx" ON "ehr_site_configs"("ehr_access_id");

-- AddForeignKey
ALTER TABLE "ehr_site_configs" ADD CONSTRAINT "ehr_site_configs_ehr_access_id_fkey" FOREIGN KEY ("ehr_access_id") REFERENCES "app_ehr_access"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Data Migration: Create a Default site for every existing AppEhrAccess record
-- For EHRs with per-site fields, extract identifiers from ehr_config into site_identifiers
INSERT INTO "ehr_site_configs" ("id", "ehr_access_id", "name", "site_identifiers", "is_default", "status", "created_at", "updated_at")
SELECT
    gen_random_uuid(),
    a."id",
    'Default',
    CASE
        -- NextGen: extract siteId, accountId, tenant
        WHEN a."ehr_name" = 'nextgen' THEN jsonb_build_object(
            'siteId', COALESCE(a."ehr_config"->>'siteId', ''),
            'accountId', COALESCE(a."ehr_config"->>'accountId', ''),
            'tenant', COALESCE(a."ehr_config"->>'tenant', '')
        )
        -- AthenaNet, MEDENT: extract accountId
        WHEN a."ehr_name" IN ('athenanet', 'medent') THEN jsonb_build_object(
            'accountId', COALESCE(a."ehr_config"->>'accountId', '')
        )
        -- Cerner, eClinicalWorks, Greenways: extract tenant
        WHEN a."ehr_name" IN ('cerner', 'eclinicalworks', 'greenways') THEN jsonb_build_object(
            'tenant', COALESCE(a."ehr_config"->>'tenant', '')
        )
        -- Epic, DrChrono, Elation, MEDITECH: no per-site fields
        ELSE '{}'::jsonb
    END,
    true,
    'ACTIVE',
    NOW(),
    NOW()
FROM "app_ehr_access" a;

-- Remove per-site fields from ehr_config for multi-site EHRs (they now live in site_identifiers)
UPDATE "app_ehr_access"
SET "ehr_config" = "ehr_config" - 'tenant'
WHERE "ehr_name" IN ('cerner', 'eclinicalworks', 'greenways');

UPDATE "app_ehr_access"
SET "ehr_config" = "ehr_config" - 'accountId'
WHERE "ehr_name" IN ('athenanet', 'medent');

UPDATE "app_ehr_access"
SET "ehr_config" = "ehr_config" - 'siteId' - 'accountId' - 'tenant'
WHERE "ehr_name" = 'nextgen';

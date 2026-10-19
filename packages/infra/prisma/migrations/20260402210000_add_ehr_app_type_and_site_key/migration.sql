-- 1. Add ehrAppType to app_ehr_access (default 'system' for backward compat)
ALTER TABLE "app_ehr_access" ADD COLUMN "ehr_app_type" TEXT NOT NULL DEFAULT 'system';

-- 2. Drop old unique index, add new one including ehrAppType
DROP INDEX IF EXISTS "app_ehr_access_application_id_ehr_name_key";
CREATE UNIQUE INDEX "app_ehr_access_application_id_ehr_name_ehr_app_type_key" ON "app_ehr_access"("application_id", "ehr_name", "ehr_app_type");

-- 3. Add siteKey to ehr_site_configs
ALTER TABLE "ehr_site_configs" ADD COLUMN "site_key" TEXT;

-- 4. Backfill siteKey from existing siteIdentifiers
-- Use ehrName + first available identifier (tenant, accountId, or name as fallback)
UPDATE "ehr_site_configs" sc
SET "site_key" = CONCAT(
  (SELECT ea."ehr_name" FROM "app_ehr_access" ea WHERE ea."id" = sc."ehr_access_id"),
  ':',
  COALESCE(
    sc."site_identifiers"->>'tenant',
    sc."site_identifiers"->>'accountId',
    sc."site_identifiers"->>'siteId',
    sc."name"
  )
);

-- 5. Make siteKey NOT NULL after backfill
ALTER TABLE "ehr_site_configs" ALTER COLUMN "site_key" SET NOT NULL;

-- 6. Add unique constraint on siteKey
CREATE UNIQUE INDEX "ehr_site_configs_ehr_access_id_site_key_key" ON "ehr_site_configs"("ehr_access_id", "site_key");

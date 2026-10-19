-- Add provider restriction mode to app_ehr_access (default 'open' for backward compat)
ALTER TABLE "app_ehr_access" ADD COLUMN "provider_restriction" TEXT NOT NULL DEFAULT 'open';

-- Create provider access table (scoped to integration + optional site)
CREATE TABLE "ehr_provider_access" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ehr_access_id" UUID NOT NULL,
    "site_id" UUID,
    "provider_fhir_id" TEXT NOT NULL,
    "provider_name" TEXT,
    "provider_email" TEXT,
    "provider_npi" TEXT,
    "is_approved" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ehr_provider_access_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "ehr_provider_access_ehr_access_id_site_id_provider_fhir_id_key" ON "ehr_provider_access"("ehr_access_id", "site_id", "provider_fhir_id");
CREATE INDEX "ehr_provider_access_ehr_access_id_idx" ON "ehr_provider_access"("ehr_access_id");
CREATE INDEX "ehr_provider_access_site_id_idx" ON "ehr_provider_access"("site_id");
CREATE INDEX "ehr_provider_access_provider_fhir_id_idx" ON "ehr_provider_access"("provider_fhir_id");

-- Foreign keys
ALTER TABLE "ehr_provider_access" ADD CONSTRAINT "ehr_provider_access_ehr_access_id_fkey" FOREIGN KEY ("ehr_access_id") REFERENCES "app_ehr_access"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ehr_provider_access" ADD CONSTRAINT "ehr_provider_access_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "ehr_site_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "CarePlanStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'REVOKED');

-- CreateTable
CREATE TABLE "care_plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "application_id" UUID NOT NULL,
    "site_id" UUID,
    "patient_fhir_id" TEXT NOT NULL,
    "encounter_fhir_id" TEXT,
    "ehr_name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "CarePlanStatus" NOT NULL DEFAULT 'DRAFT',
    "cards" JSONB NOT NULL DEFAULT '[]',
    "provider_name" TEXT,
    "provider_fhir_id" TEXT,
    "metadata" JSONB,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "care_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "care_plans_application_id_site_id_patient_fhir_id_idx" ON "care_plans"("application_id", "site_id", "patient_fhir_id");

-- CreateIndex
CREATE INDEX "care_plans_application_id_patient_fhir_id_idx" ON "care_plans"("application_id", "patient_fhir_id");

-- CreateIndex
CREATE INDEX "care_plans_patient_fhir_id_ehr_name_idx" ON "care_plans"("patient_fhir_id", "ehr_name");

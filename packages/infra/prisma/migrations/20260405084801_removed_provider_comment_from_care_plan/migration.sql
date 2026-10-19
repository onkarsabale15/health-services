/*
  Warnings:

  - You are about to drop the column `provider_comment` on the `care_plans` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "care_plans" DROP COLUMN "provider_comment";

-- CreateTable
CREATE TABLE "cds_providers" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "site_id" UUID,
    "email" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "npi" TEXT,
    "provider_fhir_id" TEXT,
    "specialty" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cds_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "icd10_codes" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "icd10_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "snomed_codes" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "semantic_tag" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "snomed_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "icd10_snomed_maps" (
    "id" UUID NOT NULL,
    "icd10_id" UUID NOT NULL,
    "snomed_id" UUID NOT NULL,
    "map_type" TEXT NOT NULL DEFAULT 'equivalent',

    CONSTRAINT "icd10_snomed_maps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loinc_codes" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "long_name" TEXT NOT NULL,
    "short_name" TEXT,
    "component" TEXT,
    "property" TEXT,
    "system" TEXT,
    "scale" TEXT,
    "class_type" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "loinc_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rxnorm_codes" (
    "id" UUID NOT NULL,
    "rxcui" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tty" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "rxnorm_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cds_providers_organization_id_idx" ON "cds_providers"("organization_id");

-- CreateIndex
CREATE INDEX "cds_providers_application_id_idx" ON "cds_providers"("application_id");

-- CreateIndex
CREATE UNIQUE INDEX "cds_providers_application_id_email_key" ON "cds_providers"("application_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "icd10_codes_code_key" ON "icd10_codes"("code");

-- CreateIndex
CREATE INDEX "icd10_codes_code_idx" ON "icd10_codes"("code");

-- CreateIndex
CREATE INDEX "icd10_codes_category_idx" ON "icd10_codes"("category");

-- CreateIndex
CREATE UNIQUE INDEX "snomed_codes_code_key" ON "snomed_codes"("code");

-- CreateIndex
CREATE INDEX "snomed_codes_code_idx" ON "snomed_codes"("code");

-- CreateIndex
CREATE INDEX "snomed_codes_semantic_tag_idx" ON "snomed_codes"("semantic_tag");

-- CreateIndex
CREATE INDEX "icd10_snomed_maps_icd10_id_idx" ON "icd10_snomed_maps"("icd10_id");

-- CreateIndex
CREATE INDEX "icd10_snomed_maps_snomed_id_idx" ON "icd10_snomed_maps"("snomed_id");

-- CreateIndex
CREATE UNIQUE INDEX "icd10_snomed_maps_icd10_id_snomed_id_key" ON "icd10_snomed_maps"("icd10_id", "snomed_id");

-- CreateIndex
CREATE UNIQUE INDEX "loinc_codes_code_key" ON "loinc_codes"("code");

-- CreateIndex
CREATE INDEX "loinc_codes_code_idx" ON "loinc_codes"("code");

-- CreateIndex
CREATE INDEX "loinc_codes_class_type_idx" ON "loinc_codes"("class_type");

-- CreateIndex
CREATE UNIQUE INDEX "rxnorm_codes_rxcui_key" ON "rxnorm_codes"("rxcui");

-- CreateIndex
CREATE INDEX "rxnorm_codes_rxcui_idx" ON "rxnorm_codes"("rxcui");

-- CreateIndex
CREATE INDEX "rxnorm_codes_tty_idx" ON "rxnorm_codes"("tty");

-- AddForeignKey
ALTER TABLE "icd10_snomed_maps" ADD CONSTRAINT "icd10_snomed_maps_icd10_id_fkey" FOREIGN KEY ("icd10_id") REFERENCES "icd10_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "icd10_snomed_maps" ADD CONSTRAINT "icd10_snomed_maps_snomed_id_fkey" FOREIGN KEY ("snomed_id") REFERENCES "snomed_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

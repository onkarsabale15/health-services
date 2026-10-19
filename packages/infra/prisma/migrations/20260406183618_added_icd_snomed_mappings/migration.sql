-- CreateEnum
CREATE TYPE "MapCategory" AS ENUM ('PROPERLY_CLASSIFIED', 'CANNOT_BE_CLASSIFIED', 'CONTEXT_DEPENDENT', 'SOURCE_CONCEPT_AMBIGUOUS', 'OUTSIDE_SCOPE');

-- CreateTable
CREATE TABLE "icd_snomed_mappings" (
    "member_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "module_id" TEXT,
    "effective_time" TEXT,
    "snomed_code" TEXT NOT NULL,
    "snomed_concept_name" TEXT,
    "icd10_code" TEXT,
    "icd10_concept_name" TEXT,
    "map_group" INTEGER NOT NULL,
    "map_priority" INTEGER NOT NULL,
    "map_rule" TEXT,
    "map_advice" TEXT,
    "map_category_id" TEXT,
    "map_category" "MapCategory",
    "correlation_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "icd_snomed_mappings_pkey" PRIMARY KEY ("member_id")
);

-- CreateIndex
CREATE INDEX "icd_snomed_mappings_snomed_code_idx" ON "icd_snomed_mappings"("snomed_code");

-- CreateIndex
CREATE INDEX "icd_snomed_mappings_icd10_code_idx" ON "icd_snomed_mappings"("icd10_code");

-- CreateIndex
CREATE INDEX "icd_snomed_mappings_map_category_idx" ON "icd_snomed_mappings"("map_category");

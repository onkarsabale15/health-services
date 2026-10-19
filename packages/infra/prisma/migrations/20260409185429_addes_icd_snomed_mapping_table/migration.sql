-- AlterTable
ALTER TABLE "icd_snomed_mappings" ADD COLUMN     "last_synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "icd_snomed_mappings_last_synced_at_idx" ON "icd_snomed_mappings"("last_synced_at");

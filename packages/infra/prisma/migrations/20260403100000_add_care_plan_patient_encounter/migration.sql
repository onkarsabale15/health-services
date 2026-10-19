-- AlterTable
ALTER TABLE "care_plans" ADD COLUMN "patient_name" TEXT;
ALTER TABLE "care_plans" ADD COLUMN "encounter_type" TEXT;
ALTER TABLE "care_plans" ADD COLUMN "encounter_date" TIMESTAMP(3);

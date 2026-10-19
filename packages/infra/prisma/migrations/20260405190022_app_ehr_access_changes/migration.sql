/*
  Warnings:

  - You are about to drop the column `prod_environment` on the `app_ehr_access` table. All the data in the column will be lost.
  - You are about to drop the `core_ehrconnection` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "app_ehr_access" DROP COLUMN "prod_environment";

-- AlterTable
ALTER TABLE "care_plans" ADD COLUMN     "approved_at" TIMESTAMP(3),
ADD COLUMN     "approved_by" TEXT,
ADD COLUMN     "approved_by_name" TEXT,
ADD COLUMN     "edited_by" TEXT,
ADD COLUMN     "edited_by_name" TEXT,
ADD COLUMN     "generated_by" TEXT,
ADD COLUMN     "revoked_at" TIMESTAMP(3),
ADD COLUMN     "revoked_by" TEXT,
ADD COLUMN     "revoked_by_name" TEXT,
ADD COLUMN     "revoked_reason" TEXT;

-- DropTable
DROP TABLE "core_ehrconnection";

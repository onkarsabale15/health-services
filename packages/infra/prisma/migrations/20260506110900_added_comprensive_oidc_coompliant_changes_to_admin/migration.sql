/*
  Warnings:

  - You are about to drop the column `access_level` on the `end_user_app_access` table. All the data in the column will be lost.
  - You are about to drop the column `access_level` on the `end_user_site_access` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "end_user_app_access" DROP COLUMN "access_level",
ADD COLUMN     "accessLevel" "AccessLevel" NOT NULL DEFAULT 'FULL';

-- AlterTable
ALTER TABLE "end_user_site_access" DROP COLUMN "access_level",
ADD COLUMN     "accessLevel" "AccessLevel" NOT NULL DEFAULT 'FULL';

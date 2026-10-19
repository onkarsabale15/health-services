-- AlterTable
ALTER TABLE "care_plans" ADD COLUMN     "parent_id" UUID,
ADD COLUMN     "provider_comment" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX "care_plans_parent_id_idx" ON "care_plans"("parent_id");

-- AddForeignKey
ALTER TABLE "care_plans" ADD CONSTRAINT "care_plans_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "care_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

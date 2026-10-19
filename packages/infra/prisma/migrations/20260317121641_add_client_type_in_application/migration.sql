-- CreateEnum
CREATE TYPE "ClientType" AS ENUM ('PUBLIC', 'CONFIDENTIAL');

-- AlterTable
ALTER TABLE "applications" ADD COLUMN     "client_type" "ClientType" NOT NULL DEFAULT 'CONFIDENTIAL';

-- CreateTable
CREATE TABLE "workflow_tools" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "config_schema" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_tools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_tool_access" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "tool_id" UUID NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_tool_access_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workflow_tools_name_key" ON "workflow_tools"("name");

-- CreateIndex
CREATE INDEX "app_tool_access_application_id_idx" ON "app_tool_access"("application_id");

-- CreateIndex
CREATE UNIQUE INDEX "app_tool_access_application_id_tool_id_key" ON "app_tool_access"("application_id", "tool_id");

-- AddForeignKey
ALTER TABLE "app_tool_access" ADD CONSTRAINT "app_tool_access_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_tool_access" ADD CONSTRAINT "app_tool_access_tool_id_fkey" FOREIGN KEY ("tool_id") REFERENCES "workflow_tools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

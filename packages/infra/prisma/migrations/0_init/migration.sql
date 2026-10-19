-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "OrgRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "AppStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "AppType" AS ENUM ('BRIDGE', 'CDS', 'CUSTOM');

-- CreateEnum
CREATE TYPE "AccessLevel" AS ENUM ('READONLY', 'FULL');

-- CreateEnum
CREATE TYPE "CdsHook" AS ENUM ('patient-view', 'encounter-start', 'encounter-discharge', 'order-select', 'order-sign', 'appointment-book');

-- CreateTable
CREATE TABLE "core_ehrconnection" (
    "uuid" UUID NOT NULL,
    "connection_name" TEXT NOT NULL,
    "ehr_name" TEXT NOT NULL,
    "app_type" TEXT NOT NULL,
    "grant_type" TEXT NOT NULL,
    "site_id" TEXT,
    "scope" TEXT,
    "base_url_test" TEXT,
    "base_url_prod" TEXT,
    "auth_url_test" TEXT,
    "auth_url_prod" TEXT,
    "access_token" TEXT,
    "tenant" TEXT,
    "application_name" TEXT,
    "enterprise_id" TEXT,
    "ng_session_id" TEXT,
    "account_id" TEXT,
    "prod_environment" BOOLEAN NOT NULL DEFAULT false,
    "organization_id" TEXT,
    "network_id" TEXT,
    "email" TEXT,
    "access_token_generated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),
    "patient" TEXT,
    "encounter" TEXT,
    "ehrUser" TEXT,

    CONSTRAINT "core_ehrconnection_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "role" "OrgRole" NOT NULL DEFAULT 'MEMBER',
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING',
    "organization_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applications" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "organization_id" UUID NOT NULL,
    "client_id" TEXT NOT NULL,
    "client_secret_hash" TEXT,
    "redirect_uris" TEXT[],
    "allowed_grant_types" TEXT[],
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "token_lifetime" INTEGER NOT NULL DEFAULT 3600,
    "jwks" JSONB,
    "app_type" "AppType" NOT NULL DEFAULT 'BRIDGE',
    "smart_launch_url" TEXT,
    "cds_config" JSONB,
    "status" "AppStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_ehr_access" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "ehr_name" TEXT NOT NULL,
    "ehr_token_scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "prod_environment" BOOLEAN NOT NULL DEFAULT false,
    "ehr_config" JSONB NOT NULL DEFAULT '{}',
    "status" "AppStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_ehr_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_app_access" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "access_level" "AccessLevel" NOT NULL DEFAULT 'READONLY',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_app_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cds_rules" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "hook" "CdsHook" NOT NULL,
    "fhir_resources" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "prompt_template" TEXT,
    "model_provider" TEXT NOT NULL DEFAULT 'anthropic',
    "model_name" TEXT NOT NULL DEFAULT 'claude-sonnet-4-20250514',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cds_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_domain_key" ON "organizations"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_organization_id_idx" ON "users"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "applications_client_id_key" ON "applications"("client_id");

-- CreateIndex
CREATE INDEX "applications_organization_id_idx" ON "applications"("organization_id");

-- CreateIndex
CREATE INDEX "applications_app_type_idx" ON "applications"("app_type");

-- CreateIndex
CREATE INDEX "app_ehr_access_application_id_idx" ON "app_ehr_access"("application_id");

-- CreateIndex
CREATE UNIQUE INDEX "app_ehr_access_application_id_ehr_name_key" ON "app_ehr_access"("application_id", "ehr_name");

-- CreateIndex
CREATE INDEX "user_app_access_user_id_idx" ON "user_app_access"("user_id");

-- CreateIndex
CREATE INDEX "user_app_access_application_id_idx" ON "user_app_access"("application_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_app_access_user_id_application_id_key" ON "user_app_access"("user_id", "application_id");

-- CreateIndex
CREATE INDEX "cds_rules_application_id_idx" ON "cds_rules"("application_id");

-- CreateIndex
CREATE INDEX "cds_rules_hook_idx" ON "cds_rules"("hook");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_ehr_access" ADD CONSTRAINT "app_ehr_access_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_app_access" ADD CONSTRAINT "user_app_access_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_app_access" ADD CONSTRAINT "user_app_access_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cds_rules" ADD CONSTRAINT "cds_rules_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;


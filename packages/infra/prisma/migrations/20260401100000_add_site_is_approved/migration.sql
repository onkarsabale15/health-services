-- AlterTable: add isApproved flag (default true — existing sites are approved, only bridge auto-created sites start unapproved)
ALTER TABLE "ehr_site_configs" ADD COLUMN "is_approved" BOOLEAN NOT NULL DEFAULT true;

-- Add `email_verified` to users with backfill from `status`.
-- Existing onboarding only flips status to ACTIVE after email verification,
-- so status='ACTIVE' is a sound source-of-truth at backfill time. Going
-- forward, email_verified is a separate concept from "account active".

ALTER TABLE "users" ADD COLUMN "email_verified" BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE "users" SET "email_verified" = TRUE WHERE "status" = 'ACTIVE';

-- Idempotent guard: add Appointment reminder columns that may be missing when
-- earlier migrations were recorded as applied but their SQL never ran (P3005 baseline).
-- Safe to run multiple times — all statements use IF NOT EXISTS.

ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "reminder24hSentAt" TIMESTAMP(3);
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "reminder2hSentAt" TIMESTAMP(3);
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "reminder24hFailed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "reminder2hFailed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "reviewRequestSentAt" TIMESTAMP(3);
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "penaltyWaivedAt" TIMESTAMP(3);
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "penaltyWaivedBy" TEXT;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "cancellationPenaltyApplied" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "depositForfeited" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "addonServiceIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "csatSentAt" TIMESTAMP(3);
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "csatScore" INT;

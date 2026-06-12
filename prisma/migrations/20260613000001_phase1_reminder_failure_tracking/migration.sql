-- Phase 1: Add reminder delivery failure tracking fields to Appointment.
-- These are set to true when an Inngest reminder job fails after all retries,
-- and cleared back to false when a subsequent retry succeeds.
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "reminder24hFailed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "reminder2hFailed" BOOLEAN NOT NULL DEFAULT false;

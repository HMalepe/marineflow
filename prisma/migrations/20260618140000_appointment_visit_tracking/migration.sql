-- Track salon visit milestones for Google review timing.
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "clientArrivedAt" TIMESTAMP(3);
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "clientDepartedAt" TIMESTAMP(3);
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "googleReviewScheduledAt" TIMESTAMP(3);

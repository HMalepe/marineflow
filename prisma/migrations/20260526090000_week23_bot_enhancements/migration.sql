-- Week 23: Bot enhancements (branch selection, reschedule, CSAT)

-- Add new ConversationStep enum values
ALTER TYPE "ConversationStep" ADD VALUE IF NOT EXISTS 'PICK_BRANCH';
ALTER TYPE "ConversationStep" ADD VALUE IF NOT EXISTS 'RESCHEDULE';
ALTER TYPE "ConversationStep" ADD VALUE IF NOT EXISTS 'CSAT';

-- Analytics event table for CSAT and other events
CREATE TABLE IF NOT EXISTS "AnalyticsEvent" (
  "id" TEXT NOT NULL,
  "salonId" TEXT NOT NULL,
  "customerId" TEXT,
  "appointmentId" TEXT,
  "type" TEXT NOT NULL,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AnalyticsEvent_salonId_type_idx" ON "AnalyticsEvent"("salonId", "type");
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_createdAt_idx" ON "AnalyticsEvent"("createdAt");

DO $$ BEGIN
    ALTER TABLE "AnalyticsEvent"
  ADD CONSTRAINT "AnalyticsEvent_salonId_fkey"
  FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- RLS
ALTER TABLE "AnalyticsEvent" ENABLE ROW LEVEL SECURITY;
CREATE POLICY salon_isolation ON "AnalyticsEvent"
  USING ("salonId" = current_setting('app.current_tenant', true));

-- Add RESCHEDULED status to AppointmentStatus if not exists
ALTER TYPE "AppointmentStatus" ADD VALUE IF NOT EXISTS 'RESCHEDULED';

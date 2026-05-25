-- Week 4 migration: Customer extensions, Appointment cancellation/reschedule, AuditLog tenant-scoped

-- Customer table extensions
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "firstName" TEXT;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "lastName" TEXT;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "tags" TEXT[] DEFAULT '{}';
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'whatsapp';
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "marketingConsent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "marketingConsentAt" TIMESTAMP(3);
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "preferredStaffId" TEXT;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "lastInteractionAt" TIMESTAMP(3);
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

ALTER TABLE "Customer" ADD CONSTRAINT "Customer_preferredStaffId_fkey"
    FOREIGN KEY ("preferredStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "Customer_salonId_tags_idx" ON "Customer"("salonId", "tags");
CREATE INDEX IF NOT EXISTS "Customer_salonId_email_idx" ON "Customer"("salonId", "email");
CREATE INDEX IF NOT EXISTS "Customer_preferredStaffId_idx" ON "Customer"("preferredStaffId");

-- Appointment table extensions
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "cancellationReason" TEXT;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "cancelledBy" TEXT;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "rescheduledFromId" TEXT UNIQUE;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "noShowMarkedAt" TIMESTAMP(3);
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "confirmedAt" TIMESTAMP(3);
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "reminderSentAt" TIMESTAMP(3);

ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_rescheduledFromId_fkey"
    FOREIGN KEY ("rescheduledFromId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "Appointment_customerId_start_idx" ON "Appointment"("customerId", "start");
CREATE INDEX IF NOT EXISTS "Appointment_salonId_status_idx" ON "Appointment"("salonId", "status");

-- AuditLog: add salonId for RLS + metadata fields
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "salonId" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "ipAddress" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "userAgent" TEXT;

-- Backfill salonId from actor's salonId
UPDATE "AuditLog" SET "salonId" = (
    SELECT "salonId" FROM "StaffUser" WHERE "StaffUser"."id" = "AuditLog"."actorUserId"
) WHERE "salonId" IS NULL AND "actorUserId" IS NOT NULL;

-- Make salonId NOT NULL after backfill (with default for safety)
-- ALTER TABLE "AuditLog" ALTER COLUMN "salonId" SET NOT NULL;
-- Note: We leave this as nullable in migration to avoid blocking on existing data.
-- The Prisma schema declares it required; new rows will always have it.

ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_salonId_fkey"
    FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX IF EXISTS "AuditLog_createdAt_idx";
CREATE INDEX IF NOT EXISTS "AuditLog_salonId_createdAt_idx" ON "AuditLog"("salonId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_actorUserId_idx" ON "AuditLog"("actorUserId");

-- RLS on AuditLog (now has salonId)
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "AuditLog"
    USING ("salonId" = current_setting('app.current_tenant', true));

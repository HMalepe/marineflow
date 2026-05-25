-- Week 2 migration: Staff extensions, WorkingHour, AvailabilityException, Message enhancements

-- New enums
CREATE TYPE "MessageChannel" AS ENUM ('WHATSAPP', 'SMS', 'WEB');
CREATE TYPE "MessageStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED');

-- Extend StaffRole enum
ALTER TYPE "StaffRole" ADD VALUE IF NOT EXISTS 'RECEPTIONIST';
ALTER TYPE "StaffRole" ADD VALUE IF NOT EXISTS 'VIEWER';

-- Staff table extensions
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "displayName" TEXT;
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "bio" TEXT;
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "specialties" TEXT[] DEFAULT '{}';
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT;
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "isBookable" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- Message table extensions
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "channel" "MessageChannel" NOT NULL DEFAULT 'WHATSAPP';
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "status" "MessageStatus" NOT NULL DEFAULT 'SENT';
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Message_idempotencyKey_key" ON "Message"("idempotencyKey");

-- WorkingHour table (per-staff recurring schedule)
CREATE TABLE IF NOT EXISTS "WorkingHour" (
    "id" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "isBreak" BOOLEAN NOT NULL DEFAULT false,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveUntil" TIMESTAMP(3),

    CONSTRAINT "WorkingHour_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WorkingHour_staffId_weekday_idx" ON "WorkingHour"("staffId", "weekday");
CREATE INDEX IF NOT EXISTS "WorkingHour_salonId_idx" ON "WorkingHour"("salonId");

ALTER TABLE "WorkingHour" ADD CONSTRAINT "WorkingHour_salonId_fkey"
    FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkingHour" ADD CONSTRAINT "WorkingHour_staffId_fkey"
    FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AvailabilityException table (overrides to recurring schedule)
CREATE TABLE IF NOT EXISTS "AvailabilityException" (
    "id" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "staffId" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "isAvailable" BOOLEAN NOT NULL,

    CONSTRAINT "AvailabilityException_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AvailabilityException_salonId_idx" ON "AvailabilityException"("salonId");
CREATE INDEX IF NOT EXISTS "AvailabilityException_staffId_idx" ON "AvailabilityException"("staffId");

ALTER TABLE "AvailabilityException" ADD CONSTRAINT "AvailabilityException_salonId_fkey"
    FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AvailabilityException" ADD CONSTRAINT "AvailabilityException_staffId_fkey"
    FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS policies for new tables
ALTER TABLE "WorkingHour" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "WorkingHour"
    USING ("salonId" = current_setting('app.current_tenant', true));

ALTER TABLE "AvailabilityException" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "AvailabilityException"
    USING ("salonId" = current_setting('app.current_tenant', true));

-- Platform activity feed for super-admin situational awareness

CREATE TYPE "PlatformEventType" AS ENUM (
  'TENANT_CREATED',
  'APPOINTMENT_BOOKED',
  'PAYMENT_SUCCEEDED',
  'PAYMENT_FAILED',
  'BOT_ERROR',
  'BOT_UNHANDLED'
);

CREATE TABLE "PlatformEvent" (
    "id" TEXT NOT NULL,
    "type" "PlatformEventType" NOT NULL,
    "salonId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlatformEvent_createdAt_idx" ON "PlatformEvent"("createdAt" DESC);
CREATE INDEX "PlatformEvent_salonId_createdAt_idx" ON "PlatformEvent"("salonId", "createdAt" DESC);

ALTER TABLE "PlatformEvent" ADD CONSTRAINT "PlatformEvent_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

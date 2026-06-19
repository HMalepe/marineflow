-- Bot health telemetry — inbound/outbound delivery status per webhook hit

CREATE TYPE "MessageLogStatus" AS ENUM ('DELIVERED', 'FAILED', 'UNHANDLED');

CREATE TABLE "MessageLog" (
    "id" TEXT NOT NULL,
    "salonId" TEXT,
    "direction" "MessageDirection" NOT NULL,
    "status" "MessageLogStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MessageLog_salonId_createdAt_idx" ON "MessageLog"("salonId", "createdAt");
CREATE INDEX "MessageLog_direction_createdAt_idx" ON "MessageLog"("direction", "createdAt");
CREATE INDEX "MessageLog_status_createdAt_idx" ON "MessageLog"("status", "createdAt");

ALTER TABLE "MessageLog" ADD CONSTRAINT "MessageLog_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "PlatformAlertKind" AS ENUM ('OWNER_MESSAGE', 'BOT_ERROR');

-- CreateEnum
CREATE TYPE "PlatformAlertStatus" AS ENUM ('UNREAD', 'READ', 'ARCHIVED');

-- CreateTable
CREATE TABLE "PlatformAlert" (
    "id" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "kind" "PlatformAlertKind" NOT NULL,
    "status" "PlatformAlertStatus" NOT NULL DEFAULT 'UNREAD',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdByStaffUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "PlatformAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlatformAlert_salonId_status_createdAt_idx" ON "PlatformAlert"("salonId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "PlatformAlert_status_createdAt_idx" ON "PlatformAlert"("status", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "PlatformAlert" ADD CONSTRAINT "PlatformAlert_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformAlert" ADD CONSTRAINT "PlatformAlert_createdByStaffUserId_fkey" FOREIGN KEY ("createdByStaffUserId") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

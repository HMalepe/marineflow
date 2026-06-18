-- AlterTable
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "reviewCreditCents" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE IF NOT EXISTS "ReviewIncentiveClaim" (
    "id" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "token" TEXT NOT NULL,
    "rewardCents" INTEGER NOT NULL,
    "claimedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewIncentiveClaim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ReviewIncentiveClaim_token_key" ON "ReviewIncentiveClaim"("token");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ReviewIncentiveClaim_salonId_idx" ON "ReviewIncentiveClaim"("salonId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ReviewIncentiveClaim_customerId_idx" ON "ReviewIncentiveClaim"("customerId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ReviewIncentiveClaim_appointmentId_idx" ON "ReviewIncentiveClaim"("appointmentId");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "ReviewIncentiveClaim" ADD CONSTRAINT "ReviewIncentiveClaim_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "ReviewIncentiveClaim" ADD CONSTRAINT "ReviewIncentiveClaim_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "ReviewIncentiveClaim" ADD CONSTRAINT "ReviewIncentiveClaim_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

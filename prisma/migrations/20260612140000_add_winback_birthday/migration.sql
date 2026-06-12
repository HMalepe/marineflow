-- Automated outbound campaigns: win-back + birthday (Customer.dateOfBirth already exists)
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "lastWinBackAt" TIMESTAMP(3);

ALTER TABLE "Salon" ADD COLUMN IF NOT EXISTS "botWinbackEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Salon" ADD COLUMN IF NOT EXISTS "botBirthdayEnabled" BOOLEAN NOT NULL DEFAULT true;

-- Win-back candidate scan runs daily across all salons
CREATE INDEX IF NOT EXISTS "Customer_salonId_lastInteractionAt_idx" ON "Customer"("salonId", "lastInteractionAt");

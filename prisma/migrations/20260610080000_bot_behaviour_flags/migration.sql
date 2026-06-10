-- Bot behaviour toggles: owner-controlled from Settings
ALTER TABLE "Salon" ADD COLUMN IF NOT EXISTS "botAskMarketingConsent" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Salon" ADD COLUMN IF NOT EXISTS "botAllowStaffPick" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Salon" ADD COLUMN IF NOT EXISTS "botLoyaltyEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Salon" ADD COLUMN IF NOT EXISTS "botRequireDepositStep" BOOLEAN NOT NULL DEFAULT true;

-- Inactivity follow-up messages
ALTER TABLE "Salon" ADD COLUMN IF NOT EXISTS "inactivityMessage1" TEXT;
ALTER TABLE "Salon" ADD COLUMN IF NOT EXISTS "inactivityMessage1DelayMin" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "Salon" ADD COLUMN IF NOT EXISTS "inactivityMessage2" TEXT;
ALTER TABLE "Salon" ADD COLUMN IF NOT EXISTS "inactivityMessage2DelayMin" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "Salon" ADD COLUMN IF NOT EXISTS "closingMessage" TEXT;

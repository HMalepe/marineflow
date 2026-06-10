-- Add new ConversationStep enum values
ALTER TYPE "ConversationStep" ADD VALUE IF NOT EXISTS 'RATE_EXPERIENCE';
ALTER TYPE "ConversationStep" ADD VALUE IF NOT EXISTS 'OTHER_QUERY';
ALTER TYPE "ConversationStep" ADD VALUE IF NOT EXISTS 'HANDOFF_RATING';

-- Add contact email and maps URL to Salon
ALTER TABLE "Salon" ADD COLUMN IF NOT EXISTS "contactEmail" TEXT;
ALTER TABLE "Salon" ADD COLUMN IF NOT EXISTS "mapsUrl" TEXT;

-- Restore bot toggle fields and inactivity fields that were accidentally dropped from schema
ALTER TABLE "Salon" ADD COLUMN IF NOT EXISTS "botAskMarketingConsent" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Salon" ADD COLUMN IF NOT EXISTS "botAllowStaffPick"      BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Salon" ADD COLUMN IF NOT EXISTS "botLoyaltyEnabled"       BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Salon" ADD COLUMN IF NOT EXISTS "botRequireDepositStep"   BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Salon" ADD COLUMN IF NOT EXISTS "inactivityMessage1"          TEXT;
ALTER TABLE "Salon" ADD COLUMN IF NOT EXISTS "inactivityMessage1DelayMin"  INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "Salon" ADD COLUMN IF NOT EXISTS "inactivityMessage2"          TEXT;
ALTER TABLE "Salon" ADD COLUMN IF NOT EXISTS "inactivityMessage2DelayMin"  INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "Salon" ADD COLUMN IF NOT EXISTS "closingMessage"              TEXT;

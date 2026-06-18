-- Week 29: Marketing campaigns

CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'SENDING', 'COMPLETED', 'CANCELLED');

CREATE TABLE IF NOT EXISTS "Campaign" (
  "id" TEXT NOT NULL,
  "salonId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "templateName" TEXT NOT NULL,
  "templateLang" TEXT NOT NULL DEFAULT 'en',
  "audienceFilter" JSONB NOT NULL DEFAULT '{}',
  "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
  "scheduledAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "totalRecipients" INTEGER NOT NULL DEFAULT 0,
  "delivered" INTEGER NOT NULL DEFAULT 0,
  "failed" INTEGER NOT NULL DEFAULT 0,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Campaign_salonId_status_idx" ON "Campaign"("salonId", "status");

DO $$ BEGIN
    ALTER TABLE "Campaign"
  ADD CONSTRAINT "Campaign_salonId_fkey"
  FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Campaign" ENABLE ROW LEVEL SECURITY;
CREATE POLICY salon_isolation ON "Campaign"
  USING ("salonId" = current_setting('app.current_tenant', true));

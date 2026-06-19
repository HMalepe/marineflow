-- Campaign send performance metrics (delivery, read, reply, booking attribution)

CREATE TABLE IF NOT EXISTS "CampaignSend" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "salonId" TEXT NOT NULL,
  "sentAt" TIMESTAMP(3) NOT NULL,
  "sentCount" INTEGER NOT NULL DEFAULT 0,
  "deliveredCount" INTEGER NOT NULL DEFAULT 0,
  "readCount" INTEGER NOT NULL DEFAULT 0,
  "repliedCount" INTEGER NOT NULL DEFAULT 0,
  "bookedCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CampaignSend_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CampaignSend_campaignId_key" ON "CampaignSend"("campaignId");
CREATE INDEX IF NOT EXISTS "CampaignSend_salonId_sentAt_idx" ON "CampaignSend"("salonId", "sentAt");

CREATE TABLE IF NOT EXISTS "CampaignRecipient" (
  "id" TEXT NOT NULL,
  "campaignSendId" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "salonId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "providerSid" TEXT,
  "delivered" BOOLEAN NOT NULL DEFAULT false,
  "read" BOOLEAN NOT NULL DEFAULT false,
  "replied" BOOLEAN NOT NULL DEFAULT false,
  "booked" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CampaignRecipient_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CampaignRecipient_providerSid_key" ON "CampaignRecipient"("providerSid");
CREATE UNIQUE INDEX IF NOT EXISTS "CampaignRecipient_campaignId_customerId_key" ON "CampaignRecipient"("campaignId", "customerId");
CREATE INDEX IF NOT EXISTS "CampaignRecipient_campaignSendId_idx" ON "CampaignRecipient"("campaignSendId");
CREATE INDEX IF NOT EXISTS "CampaignRecipient_salonId_customerId_idx" ON "CampaignRecipient"("salonId", "customerId");

DO $$ BEGIN
  ALTER TABLE "CampaignSend"
    ADD CONSTRAINT "CampaignSend_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CampaignRecipient"
    ADD CONSTRAINT "CampaignRecipient_campaignSendId_fkey"
    FOREIGN KEY ("campaignSendId") REFERENCES "CampaignSend"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CampaignRecipient"
    ADD CONSTRAINT "CampaignRecipient_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "CampaignSend" ENABLE ROW LEVEL SECURITY;
CREATE POLICY salon_isolation ON "CampaignSend"
  USING ("salonId" = current_setting('app.current_tenant', true));

ALTER TABLE "CampaignRecipient" ENABLE ROW LEVEL SECURITY;
CREATE POLICY salon_isolation ON "CampaignRecipient"
  USING ("salonId" = current_setting('app.current_tenant', true));

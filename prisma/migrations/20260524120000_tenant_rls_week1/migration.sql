-- Week 1: Tenant fields on Salon + WebhookEvent + Row-Level Security (salonId = tenant_id)

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('LEAD', 'TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CHURNED');

-- AlterTable Salon (tenant anchor — no RLS)
ALTER TABLE "Salon" ADD COLUMN IF NOT EXISTS "tradingName" TEXT;
ALTER TABLE "Salon" ADD COLUMN IF NOT EXISTS "legalName" TEXT;
ALTER TABLE "Salon" ADD COLUMN IF NOT EXISTS "industryTemplate" TEXT NOT NULL DEFAULT 'salon';
ALTER TABLE "Salon" ADD COLUMN IF NOT EXISTS "status" "TenantStatus" NOT NULL DEFAULT 'TRIAL';
ALTER TABLE "Salon" ADD COLUMN IF NOT EXISTS "statusChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Salon" ADD COLUMN IF NOT EXISTS "trialEndsAt" TIMESTAMP(3);
ALTER TABLE "Salon" ADD COLUMN IF NOT EXISTS "tier" TEXT NOT NULL DEFAULT 'starter';
ALTER TABLE "Salon" ADD COLUMN IF NOT EXISTS "defaultCurrency" TEXT NOT NULL DEFAULT 'usd';
ALTER TABLE "Salon" ADD COLUMN IF NOT EXISTS "locale" TEXT NOT NULL DEFAULT 'en';
ALTER TABLE "Salon" ADD COLUMN IF NOT EXISTS "botName" TEXT NOT NULL DEFAULT 'Ava';
ALTER TABLE "Salon" ADD COLUMN IF NOT EXISTS "botVoiceBrief" TEXT;
ALTER TABLE "Salon" ADD COLUMN IF NOT EXISTS "toneFormality" INTEGER NOT NULL DEFAULT 50;
ALTER TABLE "Salon" ADD COLUMN IF NOT EXISTS "toneWarmth" INTEGER NOT NULL DEFAULT 70;
ALTER TABLE "Salon" ADD COLUMN IF NOT EXISTS "tonePlayfulness" INTEGER NOT NULL DEFAULT 40;
ALTER TABLE "Salon" ADD COLUMN IF NOT EXISTS "tonePace" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "Salon" ADD COLUMN IF NOT EXISTS "toneSalesEnergy" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "Salon" ADD COLUMN IF NOT EXISTS "whatsappPhoneId" TEXT;
ALTER TABLE "Salon" ADD COLUMN IF NOT EXISTS "whatsappWabaId" TEXT;
ALTER TABLE "Salon" ADD COLUMN IF NOT EXISTS "twilioWhatsAppFrom" TEXT;
ALTER TABLE "Salon" ADD COLUMN IF NOT EXISTS "onboardingCompletedAt" TIMESTAMP(3);
ALTER TABLE "Salon" ADD COLUMN IF NOT EXISTS "metadata" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "Salon" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "Salon_whatsappPhoneId_key" ON "Salon"("whatsappPhoneId");
CREATE UNIQUE INDEX IF NOT EXISTS "Salon_twilioWhatsAppFrom_key" ON "Salon"("twilioWhatsAppFrom");

-- CreateTable WebhookEvent
CREATE TABLE IF NOT EXISTS "WebhookEvent" (
    "id" TEXT NOT NULL,
    "salonId" TEXT,
    "provider" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WebhookEvent_provider_providerEventId_key" ON "WebhookEvent"("provider", "providerEventId");
CREATE INDEX IF NOT EXISTS "WebhookEvent_salonId_createdAt_idx" ON "WebhookEvent"("salonId", "createdAt");

ALTER TABLE "WebhookEvent" DROP CONSTRAINT IF EXISTS "WebhookEvent_salonId_fkey";
ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- =============================================================================
-- Row-Level Security: tenant isolation via app.current_tenant (= Salon.id)
-- Platform tables (no RLS): Salon, StaffUser
-- Runbook: SET LOCAL app.current_tenant = '<salonId>'; SET LOCAL row_security = on;
-- =============================================================================

CREATE OR REPLACE FUNCTION marineflow_tenant_match(row_salon_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN row_salon_id = current_setting('app.current_tenant', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$ LANGUAGE plpgsql STABLE;

-- Direct salonId tables
-- NOTE: FORCE ROW LEVEL SECURITY is omitted intentionally.
-- In dev/seed the connection is the table owner (bypasses RLS).
-- In production, use a non-owner app role (e.g. marineflow_app) so RLS is enforced.
-- See docs/adr/001-hybrid-stack.md for deployment guidance.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'Customer', 'Conversation', 'Service', 'Staff', 'BusinessHour',
    'Appointment', 'Invoice', 'Payment', 'LoyaltyProgram', 'Ticket',
    'FaqItem', 'AnalyticsEvent'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_tenant_all', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL USING (marineflow_tenant_match("salonId")) WITH CHECK (marineflow_tenant_match("salonId"))',
      t || '_tenant_all',
      t
    );
  END LOOP;
END $$;

-- Message: via Conversation
ALTER TABLE "Message" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Message_tenant_all" ON "Message";
CREATE POLICY "Message_tenant_all" ON "Message" FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "Conversation" c
      WHERE c."id" = "Message"."conversationId"
        AND marineflow_tenant_match(c."salonId")
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "Conversation" c
      WHERE c."id" = "Message"."conversationId"
        AND marineflow_tenant_match(c."salonId")
    )
  );

-- LoyaltyLedger: via LoyaltyProgram
ALTER TABLE "LoyaltyLedger" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "LoyaltyLedger_tenant_all" ON "LoyaltyLedger";
CREATE POLICY "LoyaltyLedger_tenant_all" ON "LoyaltyLedger" FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "LoyaltyProgram" lp
      WHERE lp."id" = "LoyaltyLedger"."programId"
        AND marineflow_tenant_match(lp."salonId")
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "LoyaltyProgram" lp
      WHERE lp."id" = "LoyaltyLedger"."programId"
        AND marineflow_tenant_match(lp."salonId")
    )
  );

-- TicketMessage: via Ticket
ALTER TABLE "TicketMessage" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "TicketMessage_tenant_all" ON "TicketMessage";
CREATE POLICY "TicketMessage_tenant_all" ON "TicketMessage" FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "Ticket" t
      WHERE t."id" = "TicketMessage"."ticketId"
        AND marineflow_tenant_match(t."salonId")
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "Ticket" t
      WHERE t."id" = "TicketMessage"."ticketId"
        AND marineflow_tenant_match(t."salonId")
    )
  );

-- TimeOff: via Staff
ALTER TABLE "TimeOff" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "TimeOff_tenant_all" ON "TimeOff";
CREATE POLICY "TimeOff_tenant_all" ON "TimeOff" FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "Staff" s
      WHERE s."id" = "TimeOff"."staffId"
        AND marineflow_tenant_match(s."salonId")
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "Staff" s
      WHERE s."id" = "TimeOff"."staffId"
        AND marineflow_tenant_match(s."salonId")
    )
  );

-- StaffService: via Staff
ALTER TABLE "StaffService" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "StaffService_tenant_all" ON "StaffService";
CREATE POLICY "StaffService_tenant_all" ON "StaffService" FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "Staff" s
      WHERE s."id" = "StaffService"."staffId"
        AND marineflow_tenant_match(s."salonId")
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "Staff" s
      WHERE s."id" = "StaffService"."staffId"
        AND marineflow_tenant_match(s."salonId")
    )
  );

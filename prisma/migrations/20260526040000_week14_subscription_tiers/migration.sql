-- Week 14: Subscription tiers (PayFast + Ozow billing)

-- Subscription status enum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELLED', 'PAUSED', 'TRIAL');

-- Plans table (platform-level, no RLS)
CREATE TABLE IF NOT EXISTS "SubscriptionPlan" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "tier" TEXT NOT NULL,
  "priceMonthly" INTEGER NOT NULL,
  "priceAnnual" INTEGER NOT NULL,
  "maxStaff" INTEGER NOT NULL DEFAULT 3,
  "maxBranches" INTEGER NOT NULL DEFAULT 1,
  "maxServices" INTEGER NOT NULL DEFAULT 10,
  "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "aiEnabled" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SubscriptionPlan_tier_key" ON "SubscriptionPlan"("tier");

-- Salon subscription (tenant-scoped)
CREATE TABLE IF NOT EXISTS "SalonSubscription" (
  "id" TEXT NOT NULL,
  "salonId" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
  "billingProvider" TEXT NOT NULL DEFAULT 'payfast',
  "payfastSubscriptionId" TEXT,
  "currentPeriodStart" TIMESTAMP(3),
  "currentPeriodEnd" TIMESTAMP(3),
  "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  "cancelledAt" TIMESTAMP(3),
  "trialEndsAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SalonSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SalonSubscription_salonId_key" ON "SalonSubscription"("salonId");
CREATE UNIQUE INDEX IF NOT EXISTS "SalonSubscription_payfastSubscriptionId_key" ON "SalonSubscription"("payfastSubscriptionId");
CREATE INDEX IF NOT EXISTS "SalonSubscription_salonId_idx" ON "SalonSubscription"("salonId");
CREATE INDEX IF NOT EXISTS "SalonSubscription_status_idx" ON "SalonSubscription"("status");

-- Foreign keys
DO $$ BEGIN
    ALTER TABLE "SalonSubscription"
  ADD CONSTRAINT "SalonSubscription_salonId_fkey"
  FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "SalonSubscription"
  ADD CONSTRAINT "SalonSubscription_planId_fkey"
  FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- RLS for SalonSubscription
ALTER TABLE "SalonSubscription" ENABLE ROW LEVEL SECURITY;
CREATE POLICY salon_isolation ON "SalonSubscription"
  USING ("salonId" = current_setting('app.current_tenant', true));

-- Seed default plans
INSERT INTO "SubscriptionPlan" ("id", "name", "tier", "priceMonthly", "priceAnnual", "maxStaff", "maxBranches", "maxServices", "features", "aiEnabled", "sortOrder", "updatedAt")
VALUES
  ('plan_starter', 'Starter', 'starter', 0, 0, 3, 1, 10, ARRAY['whatsapp_bot', 'basic_booking', 'loyalty'], false, 1, NOW()),
  ('plan_pro', 'Pro', 'pro', 49900, 479000, 10, 3, 50, ARRAY['whatsapp_bot', 'basic_booking', 'loyalty', 'ai_faq', 'analytics', 'multi_branch', 'crm'], true, 2, NOW()),
  ('plan_enterprise', 'Enterprise', 'enterprise', 99900, 959000, 9999, 9999, 9999, ARRAY['whatsapp_bot', 'basic_booking', 'loyalty', 'ai_faq', 'analytics', 'multi_branch', 'crm', 'custom_training', 'priority_support', 'white_label'], true, 3, NOW());

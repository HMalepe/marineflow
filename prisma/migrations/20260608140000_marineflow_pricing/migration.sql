-- MarineFlow owner pricing (ZAR cents)
-- Monthly: R1,500/mo + R3,000 setup | Annual: R12,000/yr + R1,500 setup

ALTER TABLE "SubscriptionPlan" ADD COLUMN IF NOT EXISTS "setupFeeMonthly" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "SubscriptionPlan" ADD COLUMN IF NOT EXISTS "setupFeeAnnual" INTEGER NOT NULL DEFAULT 0;

UPDATE "SubscriptionPlan" SET "isActive" = false WHERE "tier" IN ('pro', 'enterprise');

INSERT INTO "SubscriptionPlan" (
  "id", "name", "tier",
  "priceMonthly", "priceAnnual", "setupFeeMonthly", "setupFeeAnnual",
  "maxStaff", "maxBranches", "maxServices",
  "features", "aiEnabled", "isActive", "sortOrder", "updatedAt"
)
VALUES (
  'plan_marineflow',
  'MarineFlow',
  'marineflow',
  150000,
  1200000,
  300000,
  150000,
  20,
  5,
  9999,
  ARRAY['whatsapp_bot', 'booking', 'loyalty', 'ai_faq', 'analytics', 'crm', 'dashboard'],
  true,
  true,
  1,
  NOW()
)
ON CONFLICT ("tier") DO UPDATE SET
  "name" = EXCLUDED."name",
  "priceMonthly" = EXCLUDED."priceMonthly",
  "priceAnnual" = EXCLUDED."priceAnnual",
  "setupFeeMonthly" = EXCLUDED."setupFeeMonthly",
  "setupFeeAnnual" = EXCLUDED."setupFeeAnnual",
  "maxStaff" = EXCLUDED."maxStaff",
  "maxBranches" = EXCLUDED."maxBranches",
  "maxServices" = EXCLUDED."maxServices",
  "features" = EXCLUDED."features",
  "aiEnabled" = EXCLUDED."aiEnabled",
  "isActive" = EXCLUDED."isActive",
  "sortOrder" = EXCLUDED."sortOrder",
  "updatedAt" = NOW();

-- Week 30: Referral codes + loyalty tiers

CREATE TABLE "ReferralCode" (
  "id" TEXT NOT NULL,
  "salonId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "usageCount" INTEGER NOT NULL DEFAULT 0,
  "maxUses" INTEGER NOT NULL DEFAULT 0,
  "rewardStamps" INTEGER NOT NULL DEFAULT 1,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReferralCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReferralCode_code_key" ON "ReferralCode"("code");
CREATE INDEX "ReferralCode_salonId_idx" ON "ReferralCode"("salonId");

ALTER TABLE "ReferralCode"
  ADD CONSTRAINT "ReferralCode_salonId_fkey"
  FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReferralCode"
  ADD CONSTRAINT "ReferralCode_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReferralCode" ENABLE ROW LEVEL SECURITY;
CREATE POLICY salon_isolation ON "ReferralCode"
  USING ("salonId" = current_setting('app.current_tenant', true));

CREATE TABLE "ReferralRedemption" (
  "id" TEXT NOT NULL,
  "referralCodeId" TEXT NOT NULL,
  "referredCustomerId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReferralRedemption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReferralRedemption_code_customer_key"
  ON "ReferralRedemption"("referralCodeId", "referredCustomerId");

ALTER TABLE "ReferralRedemption"
  ADD CONSTRAINT "ReferralRedemption_referralCodeId_fkey"
  FOREIGN KEY ("referralCodeId") REFERENCES "ReferralCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "LoyaltyTier" (
  "id" TEXT NOT NULL,
  "salonId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "minVisits" INTEGER NOT NULL,
  "multiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  "perks" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LoyaltyTier_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LoyaltyTier_salonId_idx" ON "LoyaltyTier"("salonId");
CREATE UNIQUE INDEX "LoyaltyTier_salonId_name_key" ON "LoyaltyTier"("salonId", "name");

ALTER TABLE "LoyaltyTier"
  ADD CONSTRAINT "LoyaltyTier_salonId_fkey"
  FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LoyaltyTier" ENABLE ROW LEVEL SECURITY;
CREATE POLICY salon_isolation ON "LoyaltyTier"
  USING ("salonId" = current_setting('app.current_tenant', true));

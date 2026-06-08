-- POPIA marketing consent: explicit accept / decline / pending
CREATE TYPE "MarketingConsentStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "marketingConsentStatus" "MarketingConsentStatus" NOT NULL DEFAULT 'PENDING';

-- Existing manual opt-ins become ACCEPTED; others stay PENDING until they choose
UPDATE "Customer"
SET "marketingConsentStatus" = 'ACCEPTED'
WHERE "marketingConsent" = true;

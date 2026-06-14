-- Idempotent: POPIA consent audit log (marketing ACCEPT/DECLINE, erasure events).
CREATE TABLE IF NOT EXISTS "ConsentRecord" (
    "id" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "grantedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'whatsapp',
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ConsentRecord_salonId_idx" ON "ConsentRecord"("salonId");
CREATE INDEX IF NOT EXISTS "ConsentRecord_customerId_idx" ON "ConsentRecord"("customerId");
CREATE INDEX IF NOT EXISTS "ConsentRecord_salonId_customerId_type_idx"
  ON "ConsentRecord"("salonId", "customerId", "type");

DO $$ BEGIN
  ALTER TABLE "ConsentRecord"
    ADD CONSTRAINT "ConsentRecord_salonId_fkey"
    FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ConsentRecord"
    ADD CONSTRAINT "ConsentRecord_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "Customer_salonId_marketingConsentStatus_idx"
  ON "Customer"("salonId", "marketingConsentStatus");

CREATE INDEX IF NOT EXISTS "Customer_salonId_marketingConsentStatus_dateOfBirth_idx"
  ON "Customer"("salonId", "marketingConsentStatus", "dateOfBirth");

DO $$ BEGIN
  CREATE TYPE "MarketingConsentStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "marketingConsentStatus" "MarketingConsentStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "marketingConsentAt" TIMESTAMP(3);
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "marketingConsent" BOOLEAN NOT NULL DEFAULT false;

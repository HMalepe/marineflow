-- Week 6 migration: Payment provider expansion (Ozow, PayFast), method/provider enums, citext emails

-- Enable citext extension for case-insensitive emails
CREATE EXTENSION IF NOT EXISTS "citext";

-- New enums
CREATE TYPE "PaymentMethod" AS ENUM ('CARD', 'EFT', 'OZOW', 'PAYFAST', 'CASH', 'LOYALTY', 'OTHER');
CREATE TYPE "PaymentProvider" AS ENUM ('STRIPE', 'OZOW', 'PAYFAST', 'MANUAL');

-- Extend PaymentStatus enum
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'AUTHORISED';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'CAPTURED';

-- Payment table extensions
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "provider" "PaymentProvider" NOT NULL DEFAULT 'STRIPE';
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "method" "PaymentMethod";
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "ozowTransactionId" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "ozowReference" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "ozowSiteCode" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "payfastPaymentId" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "payfastMerchantRef" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "externalReference" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "failureReason" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "refundedAmountCents" INTEGER;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);

-- Update default currency to ZAR (South African focus)
ALTER TABLE "Payment" ALTER COLUMN "currency" SET DEFAULT 'ZAR';

-- Indexes for provider-specific lookups
CREATE INDEX IF NOT EXISTS "Payment_ozowTransactionId_idx" ON "Payment"("ozowTransactionId");
CREATE INDEX IF NOT EXISTS "Payment_payfastPaymentId_idx" ON "Payment"("payfastPaymentId");
CREATE INDEX IF NOT EXISTS "Payment_provider_status_idx" ON "Payment"("provider", "status");

-- Convert email columns to citext for case-insensitive comparison
ALTER TABLE "StaffUser" ALTER COLUMN "email" TYPE citext;
ALTER TABLE "Customer" ALTER COLUMN "email" TYPE citext;

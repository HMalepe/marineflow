-- Subscription billing issue tracking (PayFast declines + abandoned checkout)

CREATE TYPE "SubscriptionBillingIssueKind" AS ENUM ('PAYMENT_DECLINED', 'CHECKOUT_ABANDONED');

ALTER TABLE "SalonSubscription" ADD COLUMN IF NOT EXISTS "lastPaymentAt" TIMESTAMP(3);
ALTER TABLE "SalonSubscription" ADD COLUMN IF NOT EXISTS "lastPaymentAmountCents" INTEGER;
ALTER TABLE "SalonSubscription" ADD COLUMN IF NOT EXISTS "lastBillingIssueKind" "SubscriptionBillingIssueKind";
ALTER TABLE "SalonSubscription" ADD COLUMN IF NOT EXISTS "lastBillingIssueAt" TIMESTAMP(3);
ALTER TABLE "SalonSubscription" ADD COLUMN IF NOT EXISTS "lastBillingIssueDetail" TEXT;

CREATE INDEX IF NOT EXISTS "SalonSubscription_lastBillingIssueKind_idx"
  ON "SalonSubscription"("lastBillingIssueKind");

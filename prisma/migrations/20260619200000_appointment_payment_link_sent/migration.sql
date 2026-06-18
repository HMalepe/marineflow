-- Track when staff manually re-sent PayFast checkout link via dashboard

ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "paymentLinkSentAt" TIMESTAMP(3);

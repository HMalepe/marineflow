-- Week 25: Outbound webhook system (Zapier/Make/n8n integration)

CREATE TABLE "WebhookSubscription" (
  "id" TEXT NOT NULL,
  "salonId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "events" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "secret" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WebhookSubscription_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WebhookSubscription_salonId_idx" ON "WebhookSubscription"("salonId");
CREATE INDEX "WebhookSubscription_salonId_active_idx" ON "WebhookSubscription"("salonId", "active");

ALTER TABLE "WebhookSubscription"
  ADD CONSTRAINT "WebhookSubscription_salonId_fkey"
  FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WebhookSubscription" ENABLE ROW LEVEL SECURITY;
CREATE POLICY salon_isolation ON "WebhookSubscription"
  USING ("salonId" = current_setting('app.current_tenant', true));

CREATE TABLE "WebhookDelivery" (
  "id" TEXT NOT NULL,
  "subscriptionId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "statusCode" INTEGER,
  "responseBody" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 1,
  "success" BOOLEAN NOT NULL DEFAULT false,
  "deliveredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WebhookDelivery_subscriptionId_createdAt_idx"
  ON "WebhookDelivery"("subscriptionId", "createdAt");

ALTER TABLE "WebhookDelivery"
  ADD CONSTRAINT "WebhookDelivery_subscriptionId_fkey"
  FOREIGN KEY ("subscriptionId") REFERENCES "WebhookSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

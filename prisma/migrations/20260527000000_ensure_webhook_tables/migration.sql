-- Idempotent guard: re-create webhook tables if the week25 migration was recorded
-- as applied but the SQL never actually ran (common after a failed Railway deploy).

CREATE TABLE IF NOT EXISTS "WebhookSubscription" (
  "id"          TEXT        NOT NULL,
  "salonId"     TEXT        NOT NULL,
  "url"         TEXT        NOT NULL,
  "events"      TEXT[]      NOT NULL DEFAULT ARRAY[]::TEXT[],
  "secret"      TEXT        NOT NULL,
  "active"      BOOLEAN     NOT NULL DEFAULT true,
  "description" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WebhookSubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WebhookDelivery" (
  "id"             TEXT        NOT NULL,
  "subscriptionId" TEXT        NOT NULL,
  "eventType"      TEXT        NOT NULL,
  "payload"        JSONB       NOT NULL DEFAULT '{}',
  "statusCode"     INTEGER,
  "responseBody"   TEXT,
  "success"        BOOLEAN     NOT NULL DEFAULT false,
  "deliveredAt"    TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- Indexes (IF NOT EXISTS requires PG 9.5+, which Railway Postgres satisfies)
CREATE INDEX IF NOT EXISTS "WebhookSubscription_salonId_idx"        ON "WebhookSubscription"("salonId");
CREATE INDEX IF NOT EXISTS "WebhookSubscription_salonId_active_idx" ON "WebhookSubscription"("salonId", "active");
CREATE INDEX IF NOT EXISTS "WebhookDelivery_subscriptionId_idx"     ON "WebhookDelivery"("subscriptionId");
CREATE INDEX IF NOT EXISTS "WebhookDelivery_createdAt_idx"          ON "WebhookDelivery"("createdAt");

-- FK and RLS (safe to repeat — skip if already present)
DO $$ BEGIN
  ALTER TABLE "WebhookSubscription"
    ADD CONSTRAINT "WebhookSubscription_salonId_fkey"
    FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "WebhookDelivery"
    ADD CONSTRAINT "WebhookDelivery_subscriptionId_fkey"
    FOREIGN KEY ("subscriptionId") REFERENCES "WebhookSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "WebhookSubscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WebhookDelivery"     ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY salon_isolation ON "WebhookSubscription"
    USING ("salonId" = current_setting('app.current_tenant', true));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Idempotent guard: re-create any tables whose migrations were recorded as applied
-- but whose SQL never actually ran (common after a failed Railway deploy).
-- Safe to run multiple times — all statements use IF NOT EXISTS / DO/EXCEPTION blocks.

-- ── Campaign (week29) ────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'SENDING', 'COMPLETED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "Campaign" (
  "id"               TEXT              NOT NULL,
  "salonId"          TEXT              NOT NULL,
  "name"             TEXT              NOT NULL,
  "templateName"     TEXT              NOT NULL,
  "templateLang"     TEXT              NOT NULL DEFAULT 'en',
  "audienceFilter"   JSONB             NOT NULL DEFAULT '{}',
  "status"           "CampaignStatus"  NOT NULL DEFAULT 'DRAFT',
  "scheduledAt"      TIMESTAMP(3),
  "sentAt"           TIMESTAMP(3),
  "totalRecipients"  INTEGER           NOT NULL DEFAULT 0,
  "delivered"        INTEGER           NOT NULL DEFAULT 0,
  "failed"           INTEGER           NOT NULL DEFAULT 0,
  "createdBy"        TEXT,
  "createdAt"        TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3)      NOT NULL,
  CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Campaign_salonId_status_idx" ON "Campaign"("salonId", "status");

DO $$ BEGIN
  ALTER TABLE "Campaign"
    ADD CONSTRAINT "Campaign_salonId_fkey"
    FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "Campaign" ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY salon_isolation ON "Campaign"
    USING ("salonId" = current_setting('app.current_tenant', true));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Webhook tables (week25) ──────────────────────────────────────────────────

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

-- ── WebhookEvent (Twilio / provider inbound event log) ────────────────────────

CREATE TABLE IF NOT EXISTS "WebhookEvent" (
  "id"              TEXT        NOT NULL,
  "salonId"         TEXT,
  "provider"        TEXT        NOT NULL,
  "providerEventId" TEXT        NOT NULL,
  "payload"         JSONB       NOT NULL DEFAULT '{}',
  "verified"        BOOLEAN     NOT NULL DEFAULT false,
  "processedAt"     TIMESTAMP(3),
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WebhookEvent_provider_providerEventId_key"
  ON "WebhookEvent"("provider", "providerEventId");

CREATE INDEX IF NOT EXISTS "WebhookEvent_salonId_createdAt_idx"
  ON "WebhookEvent"("salonId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "WebhookEvent"
    ADD CONSTRAINT "WebhookEvent_salonId_fkey"
    FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

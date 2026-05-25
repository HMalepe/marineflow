-- Week 3 migration: Conversation enhancements, Message direction enum, ServiceCategory

-- New enums
CREATE TYPE "MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- Extend ConversationStep enum
ALTER TYPE "ConversationStep" ADD VALUE IF NOT EXISTS 'HANDOFF';
ALTER TYPE "ConversationStep" ADD VALUE IF NOT EXISTS 'CLOSED';

-- Conversation table extensions
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "lastMessageAt" TIMESTAMP(3);
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "endedAt" TIMESTAMP(3);
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "handoffReason" TEXT;
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "messageCount" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "Conversation_salonId_lastMessageAt_idx" ON "Conversation"("salonId", "lastMessageAt");

-- Message table: direction string -> enum migration
-- Step 1: Add new enum column
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "directionEnum" "MessageDirection" NOT NULL DEFAULT 'INBOUND';
-- Step 2: Migrate existing data
UPDATE "Message" SET "directionEnum" = 'OUTBOUND' WHERE "direction" = 'out';
UPDATE "Message" SET "directionEnum" = 'INBOUND' WHERE "direction" = 'in';
-- Step 3: Drop old column, rename new
ALTER TABLE "Message" DROP COLUMN IF EXISTS "direction";
ALTER TABLE "Message" RENAME COLUMN "directionEnum" TO "direction";

-- Message table: add metadata column
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "metadata" JSONB;
CREATE INDEX IF NOT EXISTS "Message_customerId_createdAt_idx" ON "Message"("customerId", "createdAt");

-- ServiceCategory table
CREATE TABLE IF NOT EXISTS "ServiceCategory" (
    "id" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ServiceCategory_salonId_slug_key" ON "ServiceCategory"("salonId", "slug");
CREATE INDEX IF NOT EXISTS "ServiceCategory_salonId_idx" ON "ServiceCategory"("salonId");

ALTER TABLE "ServiceCategory" ADD CONSTRAINT "ServiceCategory_salonId_fkey"
    FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Service table extensions
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "aliases" TEXT[] DEFAULT '{}';
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "depositPercent" INTEGER;
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "categoryId" TEXT;
CREATE INDEX IF NOT EXISTS "Service_categoryId_idx" ON "Service"("categoryId");

-- Migrate existing category strings to categoryId (run after ServiceCategory data is populated)
-- This is a data migration step that should be run manually or via seed if needed.

ALTER TABLE "Service" ADD CONSTRAINT "Service_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "ServiceCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Drop old category string column (after data migration)
ALTER TABLE "Service" DROP COLUMN IF EXISTS "category";

-- Make Service.description use TEXT storage
ALTER TABLE "Service" ALTER COLUMN "description" TYPE TEXT;

-- RLS policies for new table
ALTER TABLE "ServiceCategory" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "ServiceCategory"
    USING ("salonId" = current_setting('app.current_tenant', true));

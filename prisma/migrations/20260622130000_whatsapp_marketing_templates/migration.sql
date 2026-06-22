-- Meta-approved WhatsApp rich-card templates (image header + body + CTA button),
-- sent via Twilio's Content API to reach customers outside the 24h session window.

CREATE TYPE "WhatsappTemplateCategory" AS ENUM ('MARKETING', 'UTILITY');
CREATE TYPE "WhatsappTemplateStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE IF NOT EXISTS "WhatsappTemplate" (
  "id" TEXT NOT NULL,
  "salonId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" "WhatsappTemplateCategory" NOT NULL DEFAULT 'MARKETING',
  "language" TEXT NOT NULL DEFAULT 'en',
  "headerText" TEXT,
  "mediaUrl" TEXT,
  "body" TEXT NOT NULL,
  "footer" TEXT,
  "buttons" JSONB NOT NULL DEFAULT '[]',
  "status" "WhatsappTemplateStatus" NOT NULL DEFAULT 'DRAFT',
  "contentSid" TEXT,
  "rejectionReason" TEXT,
  "submittedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WhatsappTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WhatsappTemplate_salonId_name_key" ON "WhatsappTemplate"("salonId", "name");
CREATE INDEX IF NOT EXISTS "WhatsappTemplate_salonId_status_idx" ON "WhatsappTemplate"("salonId", "status");

DO $$ BEGIN
  ALTER TABLE "WhatsappTemplate"
    ADD CONSTRAINT "WhatsappTemplate_salonId_fkey"
    FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "WhatsappTemplate" ENABLE ROW LEVEL SECURITY;
CREATE POLICY salon_isolation ON "WhatsappTemplate"
  USING ("salonId" = current_setting('app.current_tenant', true));

ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "whatsappTemplateId" TEXT;

DO $$ BEGIN
  ALTER TABLE "Campaign"
    ADD CONSTRAINT "Campaign_whatsappTemplateId_fkey"
    FOREIGN KEY ("whatsappTemplateId") REFERENCES "WhatsappTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Per-tenant WhatsApp number routing (rename twilioWhatsAppFrom → twilioWhatsAppNumber)

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Salon' AND column_name = 'twilioWhatsAppFrom'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Salon' AND column_name = 'twilioWhatsAppNumber'
  ) THEN
    ALTER TABLE "Salon" RENAME COLUMN "twilioWhatsAppFrom" TO "twilioWhatsAppNumber";
  END IF;
END $$;

ALTER TABLE "Salon" ADD COLUMN IF NOT EXISTS "twilioWhatsAppNumber" TEXT;
ALTER TABLE "Salon" ADD COLUMN IF NOT EXISTS "twilioAccountSid" TEXT;
ALTER TABLE "Salon" ADD COLUMN IF NOT EXISTS "twilioAuthToken" TEXT;

DROP INDEX IF EXISTS "Salon_twilioWhatsAppFrom_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Salon_twilioWhatsAppNumber_key" ON "Salon"("twilioWhatsAppNumber");

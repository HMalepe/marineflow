-- Audit fix migration: RLS gaps, missing indexes, production hardening

-- F1: WebhookEvent was missing RLS
ALTER TABLE "WebhookEvent" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "WebhookEvent"
  USING ("salonId" = current_setting('app.current_tenant', true)
    OR "salonId" IS NULL);

-- Missing indexes (F3, F4, F5)
CREATE INDEX IF NOT EXISTS "Ticket_salonId_idx" ON "Ticket"("salonId");
CREATE INDEX IF NOT EXISTS "Invoice_salonId_idx" ON "Invoice"("salonId");
CREATE INDEX IF NOT EXISTS "Invoice_customerId_idx" ON "Invoice"("customerId");
CREATE INDEX IF NOT EXISTS "FaqItem_salonId_idx" ON "FaqItem"("salonId");
CREATE INDEX IF NOT EXISTS "FaqItem_salonId_status_idx" ON "FaqItem"("salonId", "status");

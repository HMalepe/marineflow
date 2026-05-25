-- Week 20: POPIA/GDPR consent tracking

CREATE TABLE "ConsentRecord" (
  "id" TEXT NOT NULL,
  "salonId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "granted" BOOLEAN NOT NULL,
  "grantedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "source" TEXT NOT NULL DEFAULT 'whatsapp',
  "ipAddress" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ConsentRecord_salonId_idx" ON "ConsentRecord"("salonId");
CREATE INDEX "ConsentRecord_customerId_idx" ON "ConsentRecord"("customerId");
CREATE INDEX "ConsentRecord_salonId_customerId_type_idx" ON "ConsentRecord"("salonId", "customerId", "type");

ALTER TABLE "ConsentRecord"
  ADD CONSTRAINT "ConsentRecord_salonId_fkey"
  FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ConsentRecord"
  ADD CONSTRAINT "ConsentRecord_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS
ALTER TABLE "ConsentRecord" ENABLE ROW LEVEL SECURITY;
CREATE POLICY salon_isolation ON "ConsentRecord"
  USING ("salonId" = current_setting('app.current_tenant', true));

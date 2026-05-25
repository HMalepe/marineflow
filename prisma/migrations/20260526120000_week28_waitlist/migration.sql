-- Week 28: Waitlist + smart capacity

CREATE TABLE "WaitlistEntry" (
  "id" TEXT NOT NULL,
  "salonId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "serviceId" TEXT NOT NULL,
  "staffId" TEXT,
  "branchId" TEXT,
  "preferredDate" TEXT,
  "notified" BOOLEAN NOT NULL DEFAULT false,
  "notifiedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WaitlistEntry_salonId_serviceId_idx" ON "WaitlistEntry"("salonId", "serviceId");
CREATE INDEX "WaitlistEntry_salonId_notified_idx" ON "WaitlistEntry"("salonId", "notified");

ALTER TABLE "WaitlistEntry"
  ADD CONSTRAINT "WaitlistEntry_salonId_fkey"
  FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WaitlistEntry"
  ADD CONSTRAINT "WaitlistEntry_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WaitlistEntry" ENABLE ROW LEVEL SECURITY;
CREATE POLICY salon_isolation ON "WaitlistEntry"
  USING ("salonId" = current_setting('app.current_tenant', true));

-- Idempotent guard: ServiceAddon table for upselling during booking.
-- May be missing when power_features migration was baselined without running SQL.

CREATE TABLE IF NOT EXISTS "ServiceAddon" (
    "id" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "addonServiceId" TEXT NOT NULL,
    "pitchMessage" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ServiceAddon_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ServiceAddon_serviceId_addonServiceId_key"
  ON "ServiceAddon"("serviceId", "addonServiceId");
CREATE INDEX IF NOT EXISTS "ServiceAddon_salonId_idx" ON "ServiceAddon"("salonId");
CREATE INDEX IF NOT EXISTS "ServiceAddon_serviceId_idx" ON "ServiceAddon"("serviceId");

DO $$ BEGIN
  ALTER TABLE "ServiceAddon"
    ADD CONSTRAINT "ServiceAddon_salonId_fkey"
    FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ServiceAddon"
    ADD CONSTRAINT "ServiceAddon_serviceId_fkey"
    FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ServiceAddon"
    ADD CONSTRAINT "ServiceAddon_addonServiceId_fkey"
    FOREIGN KEY ("addonServiceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

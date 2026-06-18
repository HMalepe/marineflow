-- Week 31: Mobile push tokens

CREATE TABLE IF NOT EXISTS "PushToken" (
  "id" TEXT NOT NULL,
  "salonId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PushToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PushToken_customerId_token_key" ON "PushToken"("customerId", "token");
CREATE INDEX IF NOT EXISTS "PushToken_salonId_idx" ON "PushToken"("salonId");

DO $$ BEGIN
    ALTER TABLE "PushToken"
  ADD CONSTRAINT "PushToken_salonId_fkey"
  FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "PushToken"
  ADD CONSTRAINT "PushToken_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "PushToken" ENABLE ROW LEVEL SECURITY;
CREATE POLICY salon_isolation ON "PushToken"
  USING ("salonId" = current_setting('app.current_tenant', true));

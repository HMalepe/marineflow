-- Business router + retail/dispensary orders (Bart Marley)

-- BusinessType.RETAIL
ALTER TYPE "BusinessType" ADD VALUE IF NOT EXISTS 'RETAIL';

-- Conversation steps for business picker + retail checkout
ALTER TYPE "ConversationStep" ADD VALUE IF NOT EXISTS 'CHOOSE_BUSINESS';
ALTER TYPE "ConversationStep" ADD VALUE IF NOT EXISTS 'RETAIL_BROWSE';
ALTER TYPE "ConversationStep" ADD VALUE IF NOT EXISTS 'RETAIL_CART';
ALTER TYPE "ConversationStep" ADD VALUE IF NOT EXISTS 'RETAIL_FULFILLMENT';
ALTER TYPE "ConversationStep" ADD VALUE IF NOT EXISTS 'RETAIL_ADDRESS';
ALTER TYPE "ConversationStep" ADD VALUE IF NOT EXISTS 'RETAIL_CONFIRM';

ALTER TABLE "Salon" ADD COLUMN IF NOT EXISTS "isBusinessRouter" BOOLEAN NOT NULL DEFAULT false;

DO $$ BEGIN
  CREATE TYPE "RetailFulfillment" AS ENUM ('DELIVERY', 'COLLECTION');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "RetailOrderStatus" AS ENUM (
    'DRAFT', 'PENDING_PAYMENT', 'PAID', 'PREPARING',
    'OUT_FOR_DELIVERY', 'READY_FOR_COLLECTION', 'COMPLETED', 'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "DeliveryAddress" (
  "id" TEXT NOT NULL,
  "salonId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "label" TEXT,
  "line1" TEXT NOT NULL,
  "line2" TEXT,
  "suburb" TEXT,
  "city" TEXT,
  "postalCode" TEXT,
  "notes" TEXT,
  "isDefault" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeliveryAddress_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DeliveryAddress_salonId_customerId_idx"
  ON "DeliveryAddress"("salonId", "customerId");

DO $$ BEGIN
  ALTER TABLE "DeliveryAddress"
    ADD CONSTRAINT "DeliveryAddress_salonId_fkey"
    FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "DeliveryAddress"
    ADD CONSTRAINT "DeliveryAddress_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "RetailOrder" (
  "id" TEXT NOT NULL,
  "salonId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "status" "RetailOrderStatus" NOT NULL DEFAULT 'DRAFT',
  "fulfillment" "RetailFulfillment" NOT NULL DEFAULT 'DELIVERY',
  "deliveryAddressId" TEXT,
  "deliveryLine1" TEXT,
  "deliverySuburb" TEXT,
  "deliveryCity" TEXT,
  "deliveryNotes" TEXT,
  "subtotalCents" INTEGER NOT NULL DEFAULT 0,
  "deliveryFeeCents" INTEGER NOT NULL DEFAULT 0,
  "totalCents" INTEGER NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'zar',
  "paymentId" TEXT,
  "customerNotes" TEXT,
  "estimatedReadyAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RetailOrder_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RetailOrder_salonId_status_idx" ON "RetailOrder"("salonId", "status");
CREATE INDEX IF NOT EXISTS "RetailOrder_salonId_customerId_createdAt_idx"
  ON "RetailOrder"("salonId", "customerId", "createdAt");
CREATE INDEX IF NOT EXISTS "RetailOrder_salonId_createdAt_idx" ON "RetailOrder"("salonId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "RetailOrder"
    ADD CONSTRAINT "RetailOrder_salonId_fkey"
    FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "RetailOrder"
    ADD CONSTRAINT "RetailOrder_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "RetailOrder"
    ADD CONSTRAINT "RetailOrder_deliveryAddressId_fkey"
    FOREIGN KEY ("deliveryAddressId") REFERENCES "DeliveryAddress"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "RetailOrderItem" (
  "id" TEXT NOT NULL,
  "salonId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "serviceId" TEXT NOT NULL,
  "nameSnapshot" TEXT NOT NULL,
  "unitPriceCents" INTEGER NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "lineTotalCents" INTEGER NOT NULL,
  CONSTRAINT "RetailOrderItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RetailOrderItem_salonId_orderId_idx" ON "RetailOrderItem"("salonId", "orderId");
CREATE INDEX IF NOT EXISTS "RetailOrderItem_serviceId_idx" ON "RetailOrderItem"("serviceId");

DO $$ BEGIN
  ALTER TABLE "RetailOrderItem"
    ADD CONSTRAINT "RetailOrderItem_salonId_fkey"
    FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "RetailOrderItem"
    ADD CONSTRAINT "RetailOrderItem_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "RetailOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "RetailOrderItem"
    ADD CONSTRAINT "RetailOrderItem_serviceId_fkey"
    FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "DeliveryAddress" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS salon_isolation ON "DeliveryAddress";
CREATE POLICY salon_isolation ON "DeliveryAddress"
  USING ("salonId" = current_setting('app.current_tenant', true));

ALTER TABLE "RetailOrder" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS salon_isolation ON "RetailOrder";
CREATE POLICY salon_isolation ON "RetailOrder"
  USING ("salonId" = current_setting('app.current_tenant', true));

ALTER TABLE "RetailOrderItem" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS salon_isolation ON "RetailOrderItem";
CREATE POLICY salon_isolation ON "RetailOrderItem"
  USING ("salonId" = current_setting('app.current_tenant', true));

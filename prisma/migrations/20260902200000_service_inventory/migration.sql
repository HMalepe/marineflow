-- Retail inventory on Service (Bart Marley / dispensary stock control)

ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "trackInventory" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "stockQty" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "lowStockThreshold" INTEGER NOT NULL DEFAULT 5;

CREATE INDEX IF NOT EXISTS "Service_salonId_trackInventory_stockQty_idx"
  ON "Service"("salonId", "trackInventory", "stockQty");

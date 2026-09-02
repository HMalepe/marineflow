-- Ensure ServiceCategory unique key exists (required for Prisma upsert; missing on some prod DBs)
CREATE UNIQUE INDEX IF NOT EXISTS "ServiceCategory_salonId_slug_key"
  ON "ServiceCategory"("salonId", "slug");

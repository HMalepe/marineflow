-- No-show risk scoring on Customer
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "noShowCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "bookingCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "noShowRisk" TEXT NOT NULL DEFAULT 'LOW';

-- Backfill counts from existing appointments so risk badges work for returning customers
UPDATE "Customer" c
SET
  "bookingCount" = sub.booking_count,
  "noShowCount" = sub.no_show_count
FROM (
  SELECT
    a."customerId",
    COUNT(*) FILTER (
      WHERE a.status NOT IN ('CANCELLED', 'RESCHEDULED')
    )::int AS booking_count,
    COUNT(*) FILTER (WHERE a.status = 'NO_SHOW')::int AS no_show_count
  FROM "Appointment" a
  GROUP BY a."customerId"
) sub
WHERE c.id = sub."customerId";

-- Recalculate risk tier from backfilled counts
UPDATE "Customer"
SET "noShowRisk" = CASE
  WHEN "bookingCount" < 3 THEN 'LOW'
  WHEN ("noShowCount"::float / NULLIF("bookingCount", 0)) >= 0.5 THEN 'HIGH'
  WHEN ("noShowCount"::float / NULLIF("bookingCount", 0)) >= 0.25 THEN 'MEDIUM'
  ELSE 'LOW'
END
WHERE "bookingCount" > 0;

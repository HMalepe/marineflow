-- Week 13: Materialized views for analytics

-- Daily bookings: count per salon per day
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_bookings AS
SELECT
  "salonId",
  DATE("start") AS booking_date,
  COUNT(*) AS total_bookings,
  COUNT(*) FILTER (WHERE status = 'COMPLETED') AS completed,
  COUNT(*) FILTER (WHERE status = 'CANCELLED') AS cancelled,
  COUNT(*) FILTER (WHERE status = 'NO_SHOW') AS no_shows
FROM "Appointment"
GROUP BY "salonId", DATE("start");

CREATE UNIQUE INDEX IF NOT EXISTS mv_daily_bookings_salon_date
  ON mv_daily_bookings ("salonId", booking_date);

-- Revenue summary: per salon per month
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_revenue_summary AS
SELECT
  i."salonId",
  DATE_TRUNC('month', i."createdAt") AS month,
  SUM(i."totalCents") AS total_revenue_cents,
  COUNT(DISTINCT i."customerId") AS unique_customers,
  COUNT(i.id) AS invoice_count
FROM "Invoice" i
WHERE i.status = 'PAID'
GROUP BY i."salonId", DATE_TRUNC('month', i."createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS mv_revenue_summary_salon_month
  ON mv_revenue_summary ("salonId", month);

-- Customer retention: repeat visit rate per salon per month
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_customer_retention AS
SELECT
  a."salonId",
  DATE_TRUNC('month', a."start") AS month,
  COUNT(DISTINCT a."customerId") AS unique_customers,
  COUNT(DISTINCT a."customerId") FILTER (
    WHERE a."customerId" IN (
      SELECT a2."customerId"
      FROM "Appointment" a2
      WHERE a2."salonId" = a."salonId"
        AND a2.status = 'COMPLETED'
        AND DATE_TRUNC('month', a2."start") = DATE_TRUNC('month', a."start") - INTERVAL '1 month'
    )
  ) AS returning_customers
FROM "Appointment" a
WHERE a.status = 'COMPLETED'
GROUP BY a."salonId", DATE_TRUNC('month', a."start");

CREATE UNIQUE INDEX IF NOT EXISTS mv_customer_retention_salon_month
  ON mv_customer_retention ("salonId", month);

-- Staff performance: completed appointments and revenue per staff per month
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_staff_performance AS
SELECT
  a."salonId",
  a."staffId",
  DATE_TRUNC('month', a."start") AS month,
  COUNT(*) AS total_appointments,
  COUNT(*) FILTER (WHERE a.status = 'COMPLETED') AS completed,
  COUNT(*) FILTER (WHERE a.status = 'NO_SHOW') AS no_shows,
  COALESCE(SUM(s."priceCents") FILTER (WHERE a.status = 'COMPLETED'), 0) AS revenue_cents
FROM "Appointment" a
LEFT JOIN "Service" s ON s.id = a."serviceId"
GROUP BY a."salonId", a."staffId", DATE_TRUNC('month', a."start");

CREATE UNIQUE INDEX IF NOT EXISTS mv_staff_performance_key
  ON mv_staff_performance ("salonId", "staffId", month);

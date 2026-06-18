import { prisma } from '../lib/prisma.js';
import { getConversationFunnel } from './observability.js';

function parseMonth(month?: string): { monthStart: Date; monthEnd: Date; monthKey: string } {
  let monthStart: Date;
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    monthStart = new Date(`${month}-01T00:00:00.000Z`);
  } else {
    const now = new Date();
    monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }
  const monthEnd = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1));
  return { monthStart, monthEnd, monthKey: monthStart.toISOString().slice(0, 7) };
}

async function assertSalonScope(salonId?: string) {
  if (!salonId) return;
  const salon = await prisma.salon.findFirst({ where: { id: salonId, deletedAt: null }, select: { id: true } });
  if (!salon) throw new Error('business_not_found');
}

async function safeQuery<T>(sql: string, ...args: unknown[]): Promise<T[]> {
  try {
    return await prisma.$queryRawUnsafe<T[]>(sql, ...args);
  } catch {
    return [];
  }
}

/** Optional salonId — omit for platform-wide aggregates across all businesses. */
export async function getAdminAnalyticsOverview(salonId?: string) {
  await assertSalonScope(salonId);
  const scope = salonId ?? null;

  const [dailyBookings, revenue, retention, staffPerformance, staffRatings, recentRatings] = await Promise.all([
    safeQuery<{ booking_date: string; total_bookings: number; completed: number; cancelled: number; no_shows: number }>(
      `SELECT booking_date::text,
              SUM(total_bookings)::int AS total_bookings,
              SUM(completed)::int AS completed,
              SUM(cancelled)::int AS cancelled,
              SUM(no_shows)::int AS no_shows
       FROM mv_daily_bookings
       WHERE ($1::text IS NULL OR "salonId" = $1)
       GROUP BY booking_date
       ORDER BY booking_date DESC
       LIMIT 90`,
      scope,
    ),
    safeQuery<{ month: string; total_revenue_cents: number; unique_customers: number; invoice_count: number }>(
      `SELECT month::text,
              SUM(total_revenue_cents)::int AS total_revenue_cents,
              SUM(unique_customers)::int AS unique_customers,
              SUM(invoice_count)::int AS invoice_count
       FROM mv_revenue_summary
       WHERE ($1::text IS NULL OR "salonId" = $1)
       GROUP BY month
       ORDER BY month DESC
       LIMIT 12`,
      scope,
    ),
    safeQuery<{ month: string; unique_customers: number; returning_customers: number }>(
      `SELECT month::text,
              SUM(unique_customers)::int AS unique_customers,
              SUM(returning_customers)::int AS returning_customers
       FROM mv_customer_retention
       WHERE ($1::text IS NULL OR "salonId" = $1)
       GROUP BY month
       ORDER BY month DESC
       LIMIT 12`,
      scope,
    ),
    safeQuery<{ staffId: string; staffName: string; total_appointments: number; completed: number; no_shows: number; revenue_cents: number }>(
      salonId
        ? `SELECT sp."staffId", s.name AS "staffName",
                  sp.total_appointments::int, sp.completed::int, sp.no_shows::int, sp.revenue_cents::int
           FROM mv_staff_performance sp
           LEFT JOIN "Staff" s ON s.id = sp."staffId"
           WHERE sp."salonId" = $1
             AND sp.month = DATE_TRUNC('month', CURRENT_DATE)
           ORDER BY sp.revenue_cents DESC`
        : `SELECT sp."staffId",
                  CONCAT(sal.name, ' · ', s.name) AS "staffName",
                  sp.total_appointments::int, sp.completed::int, sp.no_shows::int, sp.revenue_cents::int
           FROM mv_staff_performance sp
           LEFT JOIN "Staff" s ON s.id = sp."staffId"
           LEFT JOIN "Salon" sal ON sal.id = sp."salonId"
           WHERE sp.month = DATE_TRUNC('month', CURRENT_DATE)
           ORDER BY sp.revenue_cents DESC
           LIMIT 25`,
      ...(salonId ? [scope] : []),
    ),
    safeQuery<{ staffId: string; staffName: string; avg_rating: number; rating_count: number }>(
      salonId
        ? `SELECT a."staffId", s.name AS "staffName",
                  ROUND(AVG(a."csatScore")::numeric, 1)::float AS avg_rating,
                  COUNT(a."csatScore")::int AS rating_count
           FROM "Appointment" a
           LEFT JOIN "Staff" s ON s.id = a."staffId"
           WHERE a."salonId" = $1
             AND a."csatScore" IS NOT NULL
             AND a.start >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '3 months'
           GROUP BY a."staffId", s.name
           ORDER BY avg_rating DESC`
        : `SELECT a."staffId",
                  CONCAT(sal.name, ' · ', s.name) AS "staffName",
                  ROUND(AVG(a."csatScore")::numeric, 1)::float AS avg_rating,
                  COUNT(a."csatScore")::int AS rating_count
           FROM "Appointment" a
           LEFT JOIN "Staff" s ON s.id = a."staffId"
           LEFT JOIN "Salon" sal ON sal.id = a."salonId"
           WHERE a."csatScore" IS NOT NULL
             AND a.start >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '3 months'
           GROUP BY a."staffId", s.name, sal.name
           ORDER BY avg_rating DESC
           LIMIT 25`,
      ...(salonId ? [scope] : []),
    ),
    safeQuery<{ appointmentId: string; csatScore: number; start: string; firstName: string | null; lastName: string | null; waId: string; staffName: string | null; serviceName: string | null }>(
      salonId
        ? `SELECT a.id AS "appointmentId", a."csatScore", a.start::text,
                  c."firstName", c."lastName", c."waId",
                  s.name AS "staffName", svc.name AS "serviceName"
           FROM "Appointment" a
           LEFT JOIN "Customer" c ON c.id = a."customerId"
           LEFT JOIN "Staff" s ON s.id = a."staffId"
           LEFT JOIN "Service" svc ON svc.id = a."serviceId"
           WHERE a."salonId" = $1 AND a."csatScore" IS NOT NULL
           ORDER BY a.start DESC
           LIMIT 20`
        : `SELECT a.id AS "appointmentId", a."csatScore", a.start::text,
                  c."firstName", c."lastName", c."waId",
                  CONCAT(sal.name, ' · ', s.name) AS "staffName", svc.name AS "serviceName"
           FROM "Appointment" a
           LEFT JOIN "Customer" c ON c.id = a."customerId"
           LEFT JOIN "Staff" s ON s.id = a."staffId"
           LEFT JOIN "Salon" sal ON sal.id = a."salonId"
           LEFT JOIN "Service" svc ON svc.id = a."serviceId"
           WHERE a."csatScore" IS NOT NULL
           ORDER BY a.start DESC
           LIMIT 20`,
      ...(salonId ? [scope] : []),
    ),
  ]);

  return {
    scope: salonId ? 'business' : 'platform',
    salonId: salonId ?? null,
    dailyBookings: dailyBookings.reverse(),
    revenue: revenue.reverse(),
    retention: retention.reverse(),
    staffPerformance,
    staffRatings,
    recentRatings,
  };
}

export async function getAdminMonthlyReport(salonId: string | undefined, month?: string) {
  await assertSalonScope(salonId);
  const { monthStart, monthEnd, monthKey } = parseMonth(month);
  const scope = salonId ?? null;

  const salonClause = salonId ? `"salonId" = $1` : 'TRUE';
  const baseParams: unknown[] = salonId ? [scope] : [];
  const p = (n: number) => (salonId ? `$${n}` : `$${n - 1}`);

  const [bookingRows, revenueRows, topServiceRows, noShowRows, newCustomerRows, dayRows] = await Promise.all([
    safeQuery<{ total: number; completed: number }>(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE status = 'COMPLETED')::int AS completed
       FROM "Appointment"
       WHERE ${salonClause} AND start >= ${p(2)} AND start < ${p(3)}`,
      ...baseParams,
      monthStart,
      monthEnd,
    ),
    safeQuery<{ revenue_cents: number }>(
      `SELECT COALESCE(SUM(i."totalCents"), 0)::int AS revenue_cents
       FROM "Invoice" i
       WHERE ${salonClause.replace('"salonId"', 'i."salonId"')} AND i."createdAt" >= ${p(2)} AND i."createdAt" < ${p(3)} AND i."status" = 'PAID'`,
      ...baseParams,
      monthStart,
      monthEnd,
    ),
    safeQuery<{ service_name: string; cnt: number }>(
      `SELECT svc.name AS service_name, COUNT(*)::int AS cnt
       FROM "Appointment" a
       JOIN "Service" svc ON svc.id = a."serviceId"
       WHERE ${salonClause.replace('"salonId"', 'a."salonId"')} AND a.start >= ${p(2)} AND a.start < ${p(3)}
         AND a.status NOT IN ('CANCELLED','RESCHEDULED')
       GROUP BY svc.name ORDER BY cnt DESC LIMIT 1`,
      ...baseParams,
      monthStart,
      monthEnd,
    ),
    safeQuery<{ no_shows: number }>(
      `SELECT COUNT(*) FILTER (WHERE status = 'NO_SHOW')::int AS no_shows
       FROM "Appointment"
       WHERE ${salonClause} AND start >= ${p(2)} AND start < ${p(3)}`,
      ...baseParams,
      monthStart,
      monthEnd,
    ),
    salonId
      ? safeQuery<{ customer_id: string; is_first: boolean }>(
          `SELECT a."customerId" AS customer_id,
                  (MIN(a2.start) >= $2) AS is_first
           FROM "Appointment" a
           JOIN "Appointment" a2 ON a2."customerId" = a."customerId" AND a2."salonId" = $1
           WHERE a."salonId" = $1 AND a.start >= $2 AND a.start < $3
             AND a.status NOT IN ('CANCELLED','RESCHEDULED')
           GROUP BY a."customerId"`,
          scope,
          monthStart,
          monthEnd,
        )
      : safeQuery<{ customer_id: string; is_first: boolean }>(
          `SELECT a."customerId" AS customer_id,
                  (MIN(a2.start) >= $1) AS is_first
           FROM "Appointment" a
           JOIN "Appointment" a2 ON a2."customerId" = a."customerId" AND a2."salonId" = a."salonId"
           WHERE a.start >= $1 AND a.start < $2
             AND a.status NOT IN ('CANCELLED','RESCHEDULED')
           GROUP BY a."customerId", a."salonId"`,
          monthStart,
          monthEnd,
        ),
    safeQuery<{ dow: string; cnt: number }>(
      `SELECT TO_CHAR(start AT TIME ZONE 'UTC', 'Day') AS dow, COUNT(*)::int AS cnt
       FROM "Appointment"
       WHERE ${salonClause} AND start >= ${p(2)} AND start < ${p(3)}
         AND status NOT IN ('CANCELLED','RESCHEDULED')
       GROUP BY dow ORDER BY cnt DESC LIMIT 1`,
      ...baseParams,
      monthStart,
      monthEnd,
    ),
  ]);

  const totalBookings = bookingRows[0]?.total ?? 0;
  const completedBookings = bookingRows[0]?.completed ?? 0;
  const revenueCents = revenueRows[0]?.revenue_cents ?? 0;
  const topService = topServiceRows[0]?.service_name ?? null;
  const noShows = noShowRows[0]?.no_shows ?? 0;
  const noShowPct = totalBookings > 0 ? Math.round((noShows / totalBookings) * 100) : 0;
  const newCount = newCustomerRows.filter((r) => r.is_first).length;
  const totalUnique = newCustomerRows.length;
  const newCustomerPct = totalUnique > 0 ? Math.round((newCount / totalUnique) * 100) : 0;

  return {
    month: monthKey,
    totalBookings,
    completedBookings,
    revenueCents,
    topService,
    noShowPct,
    newCustomerPct,
    returningCustomerPct: 100 - newCustomerPct,
    bestDay: dayRows[0]?.dow?.trim() ?? null,
  };
}

export async function getAdminAnalyticsFunnel(salonId?: string) {
  await assertSalonScope(salonId);
  const funnel = await getConversationFunnel(salonId);
  return {
    period: '30 days',
    steps: funnel.funnel.map((step) => ({
      label: step.step.replace(/_/g, ' '),
      count: step.count,
    })),
    completedBookings7d: funnel.completedBookings7d,
  };
}

export async function getAdminNoShowPatterns(salonId?: string) {
  await assertSalonScope(salonId);
  const scope = salonId ?? null;

  const [byStaff, byService] = await Promise.all([
    safeQuery<{ staffName: string; total: number; no_shows: number }>(
      salonId
        ? `SELECT s.name AS "staffName",
                  COUNT(*)::int AS total,
                  COUNT(*) FILTER (WHERE a.status = 'NO_SHOW')::int AS no_shows
           FROM "Appointment" a
           LEFT JOIN "Staff" s ON s.id = a."staffId"
           WHERE a."salonId" = $1 AND a.start >= NOW() - INTERVAL '90 days'
           GROUP BY s.name
           HAVING COUNT(*) >= 3
           ORDER BY COUNT(*) FILTER (WHERE a.status = 'NO_SHOW') DESC
           LIMIT 10`
        : `SELECT CONCAT(sal.name, ' · ', s.name) AS "staffName",
                  COUNT(*)::int AS total,
                  COUNT(*) FILTER (WHERE a.status = 'NO_SHOW')::int AS no_shows
           FROM "Appointment" a
           LEFT JOIN "Staff" s ON s.id = a."staffId"
           LEFT JOIN "Salon" sal ON sal.id = a."salonId"
           WHERE a.start >= NOW() - INTERVAL '90 days'
           GROUP BY sal.name, s.name
           HAVING COUNT(*) >= 3
           ORDER BY COUNT(*) FILTER (WHERE a.status = 'NO_SHOW') DESC
           LIMIT 10`,
      ...(salonId ? [scope] : []),
    ),
    safeQuery<{ serviceName: string; total: number; no_shows: number }>(
      salonId
        ? `SELECT svc.name AS "serviceName",
                  COUNT(*)::int AS total,
                  COUNT(*) FILTER (WHERE a.status = 'NO_SHOW')::int AS no_shows
           FROM "Appointment" a
           JOIN "Service" svc ON svc.id = a."serviceId"
           WHERE a."salonId" = $1 AND a.start >= NOW() - INTERVAL '90 days'
           GROUP BY svc.name
           HAVING COUNT(*) >= 3
           ORDER BY COUNT(*) FILTER (WHERE a.status = 'NO_SHOW') DESC
           LIMIT 10`
        : `SELECT svc.name AS "serviceName",
                  COUNT(*)::int AS total,
                  COUNT(*) FILTER (WHERE a.status = 'NO_SHOW')::int AS no_shows
           FROM "Appointment" a
           JOIN "Service" svc ON svc.id = a."serviceId"
           WHERE a.start >= NOW() - INTERVAL '90 days'
           GROUP BY svc.name
           HAVING COUNT(*) >= 3
           ORDER BY COUNT(*) FILTER (WHERE a.status = 'NO_SHOW') DESC
           LIMIT 10`,
      ...(salonId ? [scope] : []),
    ),
  ]);

  return {
    byStaff: byStaff.map((r) => ({
      staffName: r.staffName,
      total: r.total,
      no_shows: r.no_shows,
      rate: r.total > 0 ? Math.round((r.no_shows / r.total) * 100) : 0,
    })),
    byService: byService.map((r) => ({
      serviceName: r.serviceName,
      total: r.total,
      no_shows: r.no_shows,
      rate: r.total > 0 ? Math.round((r.no_shows / r.total) * 100) : 0,
    })),
  };
}

export async function getAdminStaffRevenue(salonId?: string) {
  await assertSalonScope(salonId);
  const scope = salonId ?? null;

  const rows = await safeQuery<{
    staffId: string;
    staffName: string;
    bookings: number;
    completed: number;
    revenueCents: number;
    noShows: number;
  }>(
    salonId
      ? `SELECT sp."staffId",
                s.name AS "staffName",
                sp.total_appointments::int AS bookings,
                sp.completed::int AS completed,
                sp.revenue_cents::int AS "revenueCents",
                sp.no_shows::int AS "noShows"
         FROM mv_staff_performance sp
         LEFT JOIN "Staff" s ON s.id = sp."staffId"
         WHERE sp."salonId" = $1
           AND sp.month = DATE_TRUNC('month', CURRENT_DATE)
         ORDER BY sp.revenue_cents DESC`
      : `SELECT sp."staffId",
                CONCAT(sal.name, ' · ', s.name) AS "staffName",
                sp.total_appointments::int AS bookings,
                sp.completed::int AS completed,
                sp.revenue_cents::int AS "revenueCents",
                sp.no_shows::int AS "noShows"
         FROM mv_staff_performance sp
         LEFT JOIN "Staff" s ON s.id = sp."staffId"
         LEFT JOIN "Salon" sal ON sal.id = sp."salonId"
         WHERE sp.month = DATE_TRUNC('month', CURRENT_DATE)
         ORDER BY sp.revenue_cents DESC
         LIMIT 25`,
    ...(salonId ? [scope] : []),
  );

  return { staff: rows };
}

export async function listAnalyticsBusinesses() {
  const salons = await prisma.salon.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, slug: true, industryTemplate: true, status: true },
    orderBy: { name: 'asc' },
  });
  return salons.map((s) => ({ id: s.id, name: s.name, slug: s.slug, status: s.status }));
}

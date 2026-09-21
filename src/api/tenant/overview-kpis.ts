import { DateTime } from 'luxon';
import type { PrismaTx } from '../../lib/db/tenantSession.js';
import { isDispensarySalon } from '../../lib/retailSettings.js';

const CONFIRMED_STATUSES = ['CONFIRMED', 'CONFIRMED_PAID'] as const;

/** Retail orders that count as placed (a DRAFT cart was never submitted). */
const RETAIL_PLACED_STATUSES = [
  'PENDING_PAYMENT',
  'PAID',
  'PREPARING',
  'OUT_FOR_DELIVERY',
  'READY_FOR_COLLECTION',
  'COMPLETED',
] as const;

/** Retail orders whose money has actually been collected. */
const RETAIL_EARNED_STATUSES = [
  'PAID',
  'PREPARING',
  'OUT_FOR_DELIVERY',
  'READY_FOR_COLLECTION',
  'COMPLETED',
] as const;

export type TenantOverviewKpis = {
  bookingsToday: number;
  bookingsYesterday: number;
  bookingsDelta: number;
  revenueTodayCents: number;
  revenueMtdCents: number;
  botConversationsToday: number;
  pendingPayments: number;
  openTickets: number;
  revenueLast7Days: { date: string; revenueCents: number }[];
  currency: 'ZAR';
};

function sumServiceRevenue(rows: { service: { priceCents: number } }[]): number {
  return rows.reduce((sum, r) => sum + r.service.priceCents, 0);
}

function buildLast7Days(
  timezone: string,
  rows: { day: string; revenue_cents: number }[],
): { date: string; revenueCents: number }[] {
  const today = DateTime.now().setZone(timezone).startOf('day');
  const byDay = new Map(rows.map((r) => [r.day, r.revenue_cents]));
  const out: { date: string; revenueCents: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = today.minus({ days: i });
    const key = d.toISODate()!;
    out.push({ date: key, revenueCents: byDay.get(key) ?? 0 });
  }
  return out;
}

/**
 * Dispensary tenants have no appointments — their day is RetailOrder rows.
 * Field names stay booking-shaped so the dashboard contract is unchanged;
 * the dashboard labels them as orders for retail.
 */
async function getRetailOverviewKpis(
  db: PrismaTx,
  salonId: string,
  timezone: string,
): Promise<TenantOverviewKpis> {
  const now = DateTime.now().setZone(timezone);
  const todayStart = now.startOf('day');
  const todayEnd = todayStart.plus({ days: 1 });
  const yesterdayStart = todayStart.minus({ days: 1 });
  const monthStart = now.startOf('month');
  const sevenDaysStart = todayStart.minus({ days: 6 });

  const [
    ordersToday,
    ordersYesterday,
    revenueTodayRows,
    revenueMtdRows,
    botConversationsToday,
    pendingPayments,
    openTickets,
    revenueByDayRows,
  ] = await Promise.all([
    db.retailOrder.count({
      where: {
        salonId,
        createdAt: { gte: todayStart.toJSDate(), lt: todayEnd.toJSDate() },
        status: { in: [...RETAIL_PLACED_STATUSES] },
      },
    }),
    db.retailOrder.count({
      where: {
        salonId,
        createdAt: { gte: yesterdayStart.toJSDate(), lt: todayStart.toJSDate() },
        status: { in: [...RETAIL_PLACED_STATUSES] },
      },
    }),
    db.retailOrder.aggregate({
      _sum: { totalCents: true },
      where: {
        salonId,
        status: { in: [...RETAIL_EARNED_STATUSES] },
        createdAt: { gte: todayStart.toJSDate(), lt: todayEnd.toJSDate() },
      },
    }),
    db.retailOrder.aggregate({
      _sum: { totalCents: true },
      where: {
        salonId,
        status: { in: [...RETAIL_EARNED_STATUSES] },
        createdAt: { gte: monthStart.toJSDate(), lt: todayEnd.toJSDate() },
      },
    }),
    db.message.count({
      where: {
        createdAt: { gte: todayStart.toJSDate(), lt: todayEnd.toJSDate() },
        conversation: { salonId },
      },
    }),
    db.retailOrder.count({
      where: { salonId, status: 'PENDING_PAYMENT' },
    }),
    db.ticket.count({
      where: { salonId, status: { in: ['OPEN', 'WAITING_CUSTOMER'] } },
    }),
    db.$queryRaw<{ day: string; revenue_cents: number }[]>`
      SELECT TO_CHAR((o."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${timezone}, 'YYYY-MM-DD') AS day,
             COALESCE(SUM(o."totalCents"), 0)::int AS revenue_cents
      FROM "RetailOrder" o
      WHERE o."salonId" = ${salonId}
        AND o.status IN ('PAID', 'PREPARING', 'OUT_FOR_DELIVERY', 'READY_FOR_COLLECTION', 'COMPLETED')
        AND o."createdAt" >= ${sevenDaysStart.toJSDate()}
        AND o."createdAt" < ${todayEnd.toJSDate()}
      GROUP BY day
      ORDER BY day
    `,
  ]);

  return {
    bookingsToday: ordersToday,
    bookingsYesterday: ordersYesterday,
    bookingsDelta: ordersToday - ordersYesterday,
    revenueTodayCents: revenueTodayRows._sum.totalCents ?? 0,
    revenueMtdCents: revenueMtdRows._sum.totalCents ?? 0,
    botConversationsToday,
    pendingPayments,
    openTickets,
    revenueLast7Days: buildLast7Days(timezone, revenueByDayRows),
    currency: 'ZAR',
  };
}

export async function getTenantOverviewKpis(
  db: PrismaTx,
  salonId: string,
  timezone: string,
  industryTemplate?: string | null,
): Promise<TenantOverviewKpis> {
  if (isDispensarySalon(industryTemplate)) {
    return getRetailOverviewKpis(db, salonId, timezone);
  }
  const now = DateTime.now().setZone(timezone);
  const todayStart = now.startOf('day');
  const todayEnd = todayStart.plus({ days: 1 });
  const yesterdayStart = todayStart.minus({ days: 1 });
  const monthStart = now.startOf('month');
  const sevenDaysStart = todayStart.minus({ days: 6 });

  const [
    bookingsToday,
    bookingsYesterday,
    revenueTodayRows,
    revenueMtdRows,
    botConversationsToday,
    pendingPayments,
    openTickets,
    revenueByDayRows,
  ] = await Promise.all([
    db.appointment.count({
      where: {
        salonId,
        start: { gte: todayStart.toJSDate(), lt: todayEnd.toJSDate() },
        status: { notIn: ['CANCELLED', 'RESCHEDULED'] },
      },
    }),
    db.appointment.count({
      where: {
        salonId,
        start: { gte: yesterdayStart.toJSDate(), lt: todayStart.toJSDate() },
        status: { notIn: ['CANCELLED', 'RESCHEDULED'] },
      },
    }),
    db.appointment.findMany({
      where: {
        salonId,
        status: { in: [...CONFIRMED_STATUSES] },
        start: { gte: todayStart.toJSDate(), lt: todayEnd.toJSDate() },
      },
      select: { service: { select: { priceCents: true } } },
    }),
    db.appointment.findMany({
      where: {
        salonId,
        status: { in: [...CONFIRMED_STATUSES] },
        start: { gte: monthStart.toJSDate(), lt: todayEnd.toJSDate() },
      },
      select: { service: { select: { priceCents: true } } },
    }),
    db.message.count({
      where: {
        createdAt: { gte: todayStart.toJSDate(), lt: todayEnd.toJSDate() },
        conversation: { salonId },
      },
    }),
    db.appointment.count({
      where: { salonId, status: 'PENDING_PAYMENT' },
    }),
    db.ticket.count({
      where: { salonId, status: { in: ['OPEN', 'WAITING_CUSTOMER'] } },
    }),
    db.$queryRaw<{ day: string; revenue_cents: number }[]>`
      SELECT TO_CHAR((a.start AT TIME ZONE 'UTC') AT TIME ZONE ${timezone}, 'YYYY-MM-DD') AS day,
             COALESCE(SUM(s."priceCents"), 0)::int AS revenue_cents
      FROM "Appointment" a
      JOIN "Service" s ON s.id = a."serviceId"
      WHERE a."salonId" = ${salonId}
        AND a.status IN ('CONFIRMED', 'CONFIRMED_PAID')
        AND a.start >= ${sevenDaysStart.toJSDate()}
        AND a.start < ${todayEnd.toJSDate()}
      GROUP BY day
      ORDER BY day
    `,
  ]);

  return {
    bookingsToday,
    bookingsYesterday,
    bookingsDelta: bookingsToday - bookingsYesterday,
    revenueTodayCents: sumServiceRevenue(revenueTodayRows),
    revenueMtdCents: sumServiceRevenue(revenueMtdRows),
    botConversationsToday,
    pendingPayments,
    openTickets,
    revenueLast7Days: buildLast7Days(timezone, revenueByDayRows),
    currency: 'ZAR',
  };
}

import { DateTime } from 'luxon';
import type { PrismaTx } from '../../lib/db/tenantSession.js';

const CONFIRMED_STATUSES = ['CONFIRMED', 'CONFIRMED_PAID'] as const;

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

export async function getTenantOverviewKpis(
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

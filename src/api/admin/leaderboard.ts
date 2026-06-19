import type { BusinessType } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

const MS_DAY = 24 * 60 * 60 * 1000;
const SUCCESS_STATUSES = ['SUCCEEDED', 'CAPTURED'] as const;
const TOP_N = 10;

export type LeaderboardEntry = {
  rank: number;
  salonId: string;
  name: string;
  slug: string;
  businessType: BusinessType;
  value: number;
  previousValue: number;
  delta: number;
};

export type AdminLeaderboardSummary = {
  byAppointments: LeaderboardEntry[];
  byRevenue: LeaderboardEntry[];
  byRetention: LeaderboardEntry[];
  periodDays: 30;
};

type SalonMeta = {
  id: string;
  name: string;
  slug: string;
  businessType: BusinessType;
};

function rankTop(
  rows: { salonId: string; value: number; previousValue: number }[],
  salonById: Map<string, SalonMeta>,
): LeaderboardEntry[] {
  return rows
    .filter((r) => salonById.has(r.salonId))
    .sort((a, b) => b.value - a.value || b.previousValue - a.previousValue)
    .slice(0, TOP_N)
    .map((row, index) => {
      const salon = salonById.get(row.salonId)!;
      return {
        rank: index + 1,
        salonId: row.salonId,
        name: salon.name,
        slug: salon.slug,
        businessType: salon.businessType,
        value: row.value,
        previousValue: row.previousValue,
        delta: row.value - row.previousValue,
      };
    });
}

/** Top tenants by 30d appointments, payment revenue, and customer retention vs prior 30d. */
export async function getAdminLeaderboard(): Promise<AdminLeaderboardSummary> {
  const now = new Date();
  const d30 = new Date(now.getTime() - 30 * MS_DAY);
  const d60 = new Date(now.getTime() - 60 * MS_DAY);
  const d90 = new Date(now.getTime() - 90 * MS_DAY);

  const appointmentWhere = {
    status: { not: 'CANCELLED' as const },
  };

  const [salons, apptsCurrent, apptsPrevious, revCurrent, revPrevious, retentionRows] =
    await Promise.all([
      prisma.salon.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true, slug: true, businessType: true },
      }),
      prisma.appointment.groupBy({
        by: ['salonId'],
        where: { ...appointmentWhere, start: { gte: d30 } },
        _count: { id: true },
      }),
      prisma.appointment.groupBy({
        by: ['salonId'],
        where: { ...appointmentWhere, start: { gte: d60, lt: d30 } },
        _count: { id: true },
      }),
      prisma.payment.groupBy({
        by: ['salonId'],
        where: {
          status: { in: [...SUCCESS_STATUSES] },
          createdAt: { gte: d30 },
        },
        _sum: { amountCents: true },
      }),
      prisma.payment.groupBy({
        by: ['salonId'],
        where: {
          status: { in: [...SUCCESS_STATUSES] },
          createdAt: { gte: d60, lt: d30 },
        },
        _sum: { amountCents: true },
      }),
      prisma.$queryRaw<
        { salonId: string; retention_current: number; retention_previous: number }[]
      >`
        WITH appt_flags AS (
          SELECT
            "salonId",
            "customerId",
            bool_or("start" >= ${d30}) AS booked_current,
            bool_or("start" >= ${d60} AND "start" < ${d30}) AS booked_prev_period,
            bool_or("start" >= ${d90} AND "start" < ${d60}) AS booked_older_period
          FROM "Appointment"
          WHERE "start" >= ${d90}
            AND status <> 'CANCELLED'
          GROUP BY "salonId", "customerId"
        ),
        metrics AS (
          SELECT
            "salonId",
            COUNT(*) FILTER (WHERE booked_prev_period) AS cohort_current,
            COUNT(*) FILTER (WHERE booked_prev_period AND booked_current) AS retained_current,
            COUNT(*) FILTER (WHERE booked_older_period) AS cohort_previous,
            COUNT(*) FILTER (WHERE booked_older_period AND booked_prev_period) AS retained_previous
          FROM appt_flags
          GROUP BY "salonId"
        )
        SELECT
          "salonId",
          CASE WHEN cohort_current > 0
            THEN ROUND((retained_current::numeric / cohort_current * 100), 1)
            ELSE 0
          END AS retention_current,
          CASE WHEN cohort_previous > 0
            THEN ROUND((retained_previous::numeric / cohort_previous * 100), 1)
            ELSE 0
          END AS retention_previous
        FROM metrics
        WHERE cohort_current > 0
      `,
    ]);

  const salonById = new Map(salons.map((s) => [s.id, s]));

  const apptPrevMap = new Map(apptsPrevious.map((r) => [r.salonId, r._count.id]));
  const revPrevMap = new Map(revPrevious.map((r) => [r.salonId, r._sum.amountCents ?? 0]));

  const byAppointments = rankTop(
    apptsCurrent.map((r) => ({
      salonId: r.salonId,
      value: r._count.id,
      previousValue: apptPrevMap.get(r.salonId) ?? 0,
    })),
    salonById,
  );

  const byRevenue = rankTop(
    revCurrent.map((r) => ({
      salonId: r.salonId,
      value: r._sum.amountCents ?? 0,
      previousValue: revPrevMap.get(r.salonId) ?? 0,
    })),
    salonById,
  );

  const byRetention = rankTop(
    retentionRows.map((r) => ({
      salonId: r.salonId,
      value: Number(r.retention_current),
      previousValue: Number(r.retention_previous),
    })),
    salonById,
  );

  return {
    byAppointments,
    byRevenue,
    byRetention,
    periodDays: 30,
  };
}

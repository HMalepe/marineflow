import { prisma } from '../../lib/prisma.js';

const SUCCESS_STATUSES = ['SUCCEEDED', 'CAPTURED'] as const;

export type AdminRevenueTopTenant = {
  salonId: string;
  name: string;
  slug: string;
  revenueCents: number;
};

export type AdminRevenueMonth = {
  month: string;
  revenueCents: number;
};

export type AdminRevenueSummary = {
  totalGmvCents: number;
  mrrCents: number;
  avgRevenuePerTenantCents: number;
  tenantCount: number;
  topTenants: AdminRevenueTopTenant[];
  revenueLast6Months: AdminRevenueMonth[];
  currency: 'ZAR';
};

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function buildLast6Months(rows: { month: string; revenue_cents: number }[]): AdminRevenueMonth[] {
  const byMonth = new Map(rows.map((r) => [r.month, r.revenue_cents]));
  const out: AdminRevenueMonth[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = monthKey(d);
    out.push({ month: key, revenueCents: byMonth.get(key) ?? 0 });
  }
  return out;
}

/** Platform revenue metrics — Payment GMV + Subscription MRR (Postgres only, no Stripe/PayFast API). */
export async function getAdminRevenue(): Promise<AdminRevenueSummary> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const sixMonthsAgo = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 5, 1));

  const paymentSuccessWhere = { status: { in: [...SUCCESS_STATUSES] } };

  const [
    gmvAgg,
    recurringLast30Agg,
    tenantCount,
    topBySalon,
    monthlyRows,
    activeSubscriptions,
  ] = await Promise.all([
    prisma.payment.aggregate({
      where: paymentSuccessWhere,
      _sum: { amountCents: true },
    }),
    prisma.payment.aggregate({
      where: {
        ...paymentSuccessWhere,
        createdAt: { gte: thirtyDaysAgo },
        OR: [
          { externalReference: { startsWith: 'sub_' } },
          { payfastMerchantRef: { startsWith: 'sub_' } },
        ],
      },
      _sum: { amountCents: true },
    }),
    prisma.salon.count({ where: { deletedAt: null } }),
    prisma.payment.groupBy({
      by: ['salonId'],
      where: paymentSuccessWhere,
      _sum: { amountCents: true },
      orderBy: { _sum: { amountCents: 'desc' } },
      take: 5,
    }),
    prisma.$queryRaw<{ month: string; revenue_cents: number }[]>`
      SELECT TO_CHAR(DATE_TRUNC('month', COALESCE("paidAt", "createdAt")), 'YYYY-MM') AS month,
             COALESCE(SUM("amountCents"), 0)::int AS revenue_cents
      FROM "Payment"
      WHERE status IN ('SUCCEEDED', 'CAPTURED')
        AND COALESCE("paidAt", "createdAt") >= ${sixMonthsAgo}
      GROUP BY month
      ORDER BY month
    `,
    prisma.salonSubscription.findMany({
      where: { status: { in: ['ACTIVE', 'PAST_DUE'] } },
      select: { plan: { select: { priceMonthly: true } } },
    }),
  ]);

  const totalGmvCents = gmvAgg._sum.amountCents ?? 0;
  const recurringLast30Cents = recurringLast30Agg._sum.amountCents ?? 0;
  const subscriptionMrrCents = activeSubscriptions.reduce((sum, s) => sum + s.plan.priceMonthly, 0);
  const mrrCents = recurringLast30Cents > 0 ? recurringLast30Cents : subscriptionMrrCents;

  const topSalonIds = topBySalon.map((r) => r.salonId);
  const salons =
    topSalonIds.length > 0
      ? await prisma.salon.findMany({
          where: { id: { in: topSalonIds } },
          select: { id: true, name: true, slug: true },
        })
      : [];
  const salonById = new Map(salons.map((s) => [s.id, s]));

  const topTenants: AdminRevenueTopTenant[] = topBySalon.map((row) => {
    const salon = salonById.get(row.salonId);
    return {
      salonId: row.salonId,
      name: salon?.name ?? 'Unknown',
      slug: salon?.slug ?? '',
      revenueCents: row._sum.amountCents ?? 0,
    };
  });

  const avgRevenuePerTenantCents =
    tenantCount > 0 ? Math.round(totalGmvCents / tenantCount) : 0;

  return {
    totalGmvCents,
    mrrCents,
    avgRevenuePerTenantCents,
    tenantCount,
    topTenants,
    revenueLast6Months: buildLast6Months(monthlyRows),
    currency: 'ZAR',
  };
}

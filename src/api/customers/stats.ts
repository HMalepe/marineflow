import type { PrismaTx } from '../../lib/db/tenantSession.js';

export type LtvBadge = 'champion' | 'regular' | 'new' | 'at_risk';

export type CustomerStats = {
  totalSpentCents: number;
  visitCount: number;
  lastVisitAt: string | null;
  ltvBadge: LtvBadge | null;
};

const VISIT_STATUSES = ['COMPLETED', 'CONFIRMED', 'CONFIRMED_PAID', 'NO_SHOW', 'HELD'] as const;
const CHAMPION_MIN_VISITS = 6;
const CHAMPION_MIN_CENTS = 50_000;
const AT_RISK_MS = 60 * 24 * 60 * 60 * 1000;

export function computeLtvBadge(params: {
  visitCount: number;
  totalSpentCents: number;
  lastVisitAt: Date | null;
}): LtvBadge | null {
  const { visitCount, totalSpentCents, lastVisitAt } = params;

  if (visitCount === 0) return null;

  if (lastVisitAt && Date.now() - lastVisitAt.getTime() > AT_RISK_MS) {
    return 'at_risk';
  }

  if (visitCount >= CHAMPION_MIN_VISITS && totalSpentCents > CHAMPION_MIN_CENTS) {
    return 'champion';
  }
  if (visitCount >= 2 && visitCount <= 5) return 'regular';
  if (visitCount === 1) return 'new';
  return null;
}

function serializeStats(
  totalSpentCents: number,
  visitCount: number,
  lastVisitAt: Date | null,
): CustomerStats {
  return {
    totalSpentCents,
    visitCount,
    lastVisitAt: lastVisitAt?.toISOString() ?? null,
    ltvBadge: computeLtvBadge({ visitCount, totalSpentCents, lastVisitAt }),
  };
}

export async function getCustomerStats(
  db: PrismaTx,
  salonId: string,
  customerId: string,
): Promise<CustomerStats | null> {
  const customer = await db.customer.findFirst({
    where: { id: customerId, salonId, deletedAt: null },
    select: { id: true },
  });
  if (!customer) return null;

  const batch = await getCustomerStatsBatch(db, salonId, [customerId]);
  return batch[customerId] ?? null;
}

/** Efficient stats for list views — batched payments, visits, and last visit. */
export async function getCustomerStatsBatch(
  db: PrismaTx,
  salonId: string,
  customerIds: string[],
): Promise<Record<string, CustomerStats>> {
  if (customerIds.length === 0) return {};

  const uniqueIds = [...new Set(customerIds)];

  const [paymentRows, visitRows, lastVisits] = await Promise.all([
    db.payment.groupBy({
      by: ['customerId'],
      where: {
        customerId: { in: uniqueIds },
        salonId,
        status: 'SUCCEEDED',
      },
      _sum: { amountCents: true },
    }),
    db.appointment.groupBy({
      by: ['customerId'],
      where: {
        customerId: { in: uniqueIds },
        salonId,
        status: { in: [...VISIT_STATUSES] },
      },
      _count: { _all: true },
    }),
    db.appointment.findMany({
      where: {
        customerId: { in: uniqueIds },
        salonId,
        status: { notIn: ['CANCELLED', 'RESCHEDULED'] },
      },
      orderBy: { start: 'desc' },
      distinct: ['customerId'],
      select: { customerId: true, start: true },
    }),
  ]);

  const spentByCustomer = new Map(
    paymentRows.map((r) => [r.customerId, r._sum.amountCents ?? 0]),
  );
  const visitsByCustomer = new Map(
    visitRows.map((r) => [r.customerId, r._count._all]),
  );
  const lastVisitByCustomer = new Map(
    lastVisits.map((r) => [r.customerId, r.start]),
  );

  const out: Record<string, CustomerStats> = {};
  for (const id of uniqueIds) {
    out[id] = serializeStats(
      spentByCustomer.get(id) ?? 0,
      visitsByCustomer.get(id) ?? 0,
      lastVisitByCustomer.get(id) ?? null,
    );
  }
  return out;
}

export function customerMatchesSegment(
  customer: { id: string; createdAt: Date | string; tags: string[] },
  stats: CustomerStats | undefined,
  segment: 'all' | 'new' | 'at_risk' | 'champions' | 'vip',
): boolean {
  if (segment === 'all') return true;

  const createdAt = new Date(customer.createdAt);
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const sixtyDaysAgo = Date.now() - AT_RISK_MS;

  if (segment === 'new') {
    return createdAt.getTime() >= thirtyDaysAgo;
  }

  if (segment === 'vip') {
    return customer.tags.some((t) => t.toLowerCase() === 'vip');
  }

  if (segment === 'champions') {
    return stats?.ltvBadge === 'champion';
  }

  if (segment === 'at_risk') {
    if (stats?.ltvBadge === 'at_risk') return true;
    if (!stats?.lastVisitAt && stats?.visitCount === 0) {
      return createdAt.getTime() < sixtyDaysAgo;
    }
    if (stats?.lastVisitAt) {
      return new Date(stats.lastVisitAt).getTime() < sixtyDaysAgo;
    }
    return false;
  }

  return true;
}

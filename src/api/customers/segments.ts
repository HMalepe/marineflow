import type { PrismaTx } from '../../lib/db/tenantSession.js';
import { getCustomerStatsBatch } from './stats.js';

export type CustomerSegmentCounts = {
  all: number;
  new: number;
  at_risk: number;
  champions: number;
  vip: number;
};

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000;

/** Segment pill counts for the customers filter bar. */
export async function getCustomerSegmentCounts(
  db: PrismaTx,
  salonId: string,
): Promise<CustomerSegmentCounts> {
  const customers = await db.customer.findMany({
    where: { salonId, deletedAt: null },
    select: { id: true, createdAt: true, tags: true },
  });

  if (customers.length === 0) {
    return { all: 0, new: 0, at_risk: 0, champions: 0, vip: 0 };
  }

  const statsById = await getCustomerStatsBatch(
    db,
    salonId,
    customers.map((c) => c.id),
  );

  const now = Date.now();
  const thirtyDaysAgo = now - THIRTY_DAYS_MS;
  const sixtyDaysAgo = now - SIXTY_DAYS_MS;

  let newCount = 0;
  let atRiskCount = 0;
  let championsCount = 0;
  let vipCount = 0;

  for (const customer of customers) {
    const stats = statsById[customer.id];
    const createdMs = customer.createdAt.getTime();

    if (createdMs >= thirtyDaysAgo) newCount++;

    if (customer.tags.some((t) => t.toLowerCase() === 'vip')) vipCount++;

    if (stats?.ltvBadge === 'champion') championsCount++;

    const lastMs = stats?.lastVisitAt ? new Date(stats.lastVisitAt).getTime() : null;
    const isAtRisk =
      stats?.ltvBadge === 'at_risk' ||
      (stats?.visitCount === 0 && createdMs < sixtyDaysAgo) ||
      (lastMs != null && lastMs < sixtyDaysAgo);
    if (isAtRisk) atRiskCount++;
  }

  return {
    all: customers.length,
    new: newCount,
    at_risk: atRiskCount,
    champions: championsCount,
    vip: vipCount,
  };
}

import type { PrismaTx } from '../../lib/db/tenantSession.js';

export type FaqAskStats = Record<string, { askCount: number }>;

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/** FAQ serve counts from MessageLog (last 30 days, faqId set on serve). */
export async function getFaqAskStatsLast30d(
  db: PrismaTx,
  salonId: string,
): Promise<FaqAskStats> {
  const since = new Date(Date.now() - THIRTY_DAYS_MS);

  const rows = await db.messageLog.groupBy({
    by: ['faqId'],
    where: {
      salonId,
      faqId: { not: null },
      createdAt: { gte: since },
    },
    _count: { _all: true },
  });

  const stats: FaqAskStats = {};
  for (const row of rows) {
    if (row.faqId) {
      stats[row.faqId] = { askCount: row._count._all };
    }
  }
  return stats;
}

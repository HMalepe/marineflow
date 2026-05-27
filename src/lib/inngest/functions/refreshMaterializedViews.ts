import { inngest } from '../client.js';
import { prisma } from '../../prisma.js';

const VIEWS = [
  'mv_daily_bookings',
  'mv_revenue_summary',
  'mv_customer_retention',
  'mv_staff_performance',
] as const;

export const refreshMaterializedViews = inngest.createFunction(
  {
    id: 'refresh-materialized-views',
    triggers: [{ cron: '*/15 * * * *' }],
  },
  async () => {
    let refreshed = 0;
    for (const view of VIEWS) {
      try {
        await prisma.$executeRawUnsafe(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${view}`);
        refreshed++;
      } catch (err) {
        // View doesn't exist yet (migration pending) — log once and continue
        import('../../logger.js').then(({ logger }) =>
          logger.warn({ view, err }, 'refresh_materialized_view_skipped'),
        ).catch(() => {});
      }
    }
    return { refreshed };
  },
);

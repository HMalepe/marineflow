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
    for (const view of VIEWS) {
      await prisma.$executeRawUnsafe(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${view}`);
    }
    return { refreshed: VIEWS.length };
  },
);

import { DateTime } from 'luxon';
import { prisma } from '../../lib/prisma.js';
import { getActiveSessionCount } from '../../lib/redis.js';

export type AdminBotHealthSummary = {
  messagesInToday: number;
  messagesOutToday: number;
  failedToday: number;
  unhandledToday: number;
  webhookErrorRate24h: number;
  activeSessions: number;
};

const PLATFORM_TZ = 'Africa/Johannesburg';

export async function getAdminBotHealth(): Promise<AdminBotHealthSummary> {
  const now = DateTime.now().setZone(PLATFORM_TZ);
  const todayStart = now.startOf('day').toJSDate();
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [
    messagesInToday,
    messagesOutToday,
    failedToday,
    unhandledToday,
    total24h,
    errors24h,
    activeSessions,
  ] = await Promise.all([
    prisma.messageLog.count({
      where: { direction: 'INBOUND', createdAt: { gte: todayStart } },
    }),
    prisma.messageLog.count({
      where: { direction: 'OUTBOUND', createdAt: { gte: todayStart } },
    }),
    prisma.messageLog.count({
      where: { status: 'FAILED', createdAt: { gte: todayStart } },
    }),
    prisma.messageLog.count({
      where: { status: 'UNHANDLED', createdAt: { gte: todayStart } },
    }),
    prisma.messageLog.count({
      where: { createdAt: { gte: twentyFourHoursAgo } },
    }),
    prisma.messageLog.count({
      where: {
        status: { in: ['FAILED', 'UNHANDLED'] },
        createdAt: { gte: twentyFourHoursAgo },
      },
    }),
    getActiveSessionCount(),
  ]);

  const webhookErrorRate24h = total24h > 0 ? errors24h / total24h : 0;

  return {
    messagesInToday,
    messagesOutToday,
    failedToday,
    unhandledToday,
    webhookErrorRate24h,
    activeSessions,
  };
}

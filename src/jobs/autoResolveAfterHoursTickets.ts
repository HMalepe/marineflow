import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

const AUTO_RESOLVE_NOTE = 'Auto-resolved: no customer reply';
const STALE_MS = 24 * 60 * 60 * 1000;

/**
 * Close stale after-hours noise tickets where the customer never followed up.
 * Matches: type AFTER_HOURS_MESSAGE, OPEN, inboundCount = 0, created > 24h ago.
 */
export async function autoResolveAfterHoursTickets(): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_MS);

  const stale = await prisma.ticket.findMany({
    where: {
      type: 'AFTER_HOURS_MESSAGE',
      status: 'OPEN',
      inboundCount: 0,
      createdAt: { lt: cutoff },
    },
    select: { id: true },
    take: 500,
  });

  if (stale.length === 0) return 0;

  const ids = stale.map((t) => t.id);
  const now = new Date();

  await prisma.$transaction([
    prisma.ticket.updateMany({
      where: { id: { in: ids } },
      data: { status: 'AUTO_RESOLVED', updatedAt: now },
    }),
    ...ids.map((ticketId) =>
      prisma.ticketMessage.create({
        data: {
          ticketId,
          direction: 'internal',
          body: AUTO_RESOLVE_NOTE,
        },
      }),
    ),
  ]);

  logger.info({ count: ids.length }, 'auto_resolved_after_hours_tickets');
  return ids.length;
}

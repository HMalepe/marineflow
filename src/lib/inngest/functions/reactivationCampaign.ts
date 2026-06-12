// Configurable customer reactivation campaigns (21 / 45 / 90 / 180 days).
// Replaces fixed 21–60 day win-back window when reactivation automation is enabled.

import { Prisma } from '@prisma/client';
import { inngest } from '../client.js';
import { prisma } from '../../prisma.js';
import { withTenantContext, getTenantDb } from '../../db/tenantSession.js';
import { logger } from '../../logger.js';
import { sendWithFallback } from '../../../services/channelRouter.js';
import { isOutboundDelivered } from '../../../services/outboundCampaigns.js';
import { parseAutomationsFromMetadata } from '../../automationSettings.js';

const DAY_MS = 86_400_000;

interface SalonTarget {
  id: string;
  name: string;
  tradingName: string | null;
  metadata: unknown;
}

interface ReactivationCandidate {
  id: string;
  waId: string;
  firstName: string | null;
  lastInteractionAt: Date | null;
  lastWinBackAt: Date | null;
}

function buildReactivationBody(
  firstName: string | null,
  salonName: string,
  inactiveDays: number,
): string {
  const weeks = Math.round(inactiveDays / 7);
  return (
    `Hey ${firstName ?? 'there'}! We miss you at ${salonName}. ` +
    `It's been about ${weeks} weeks — we'd love to see you again.\n\n` +
    `Reply 1 to book your next appointment.\n\n` +
    `Reply STOP to opt out.`
  );
}

export const reactivationCampaign = inngest.createFunction(
  {
    id: 'daily-reactivation-check',
    retries: 1,
    triggers: [{ cron: 'TZ=Africa/Johannesburg 0 9 * * *' }],
  },
  async () => {
    let salons: SalonTarget[];
    try {
      salons = await prisma.salon.findMany({
        where: { status: { in: ['ACTIVE', 'TRIAL'] }, deletedAt: null },
        select: { id: true, name: true, tradingName: true, metadata: true },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2022') {
        logger.warn('reactivation_campaign_skipped_pending_migration');
        return { salons: 0, totalReached: 0 };
      }
      throw err;
    }

    let totalReached = 0;
    for (const salon of salons) {
      const automations = parseAutomationsFromMetadata(salon.metadata);
      if (!automations.reactivation.enabled) continue;

      try {
        totalReached += await runReactivationForSalon(salon, automations.reactivation);
      } catch (err) {
        logger.error({ err, salonId: salon.id }, 'reactivation_campaign_salon_failed');
      }
    }
    return { salons: salons.length, totalReached };
  },
);

async function runReactivationForSalon(
  salon: SalonTarget,
  config: ReturnType<typeof parseAutomationsFromMetadata>['reactivation'],
): Promise<number> {
  const now = Date.now();
  const salonName = salon.tradingName ?? salon.name;
  let reached = 0;
  let dailyCount = 0;

  for (const inactiveDays of config.inactiveDays) {
    if (dailyCount >= config.dailyLimit) break;

    const windowStart = inactiveDays - 2;
    const windowEnd = inactiveDays + 2;

    const candidates = await withTenantContext(salon.id, async () => {
      return getTenantDb().customer.findMany({
        where: {
          salonId: salon.id,
          deletedAt: null,
          marketingConsentStatus: 'ACCEPTED',
          lastInteractionAt: {
            not: null,
            lt: new Date(now - windowStart * DAY_MS),
            gt: new Date(now - windowEnd * DAY_MS),
          },
          OR: [
            { lastWinBackAt: null },
            { lastWinBackAt: { lt: new Date(now - config.cooldownDays * DAY_MS) } },
          ],
          NOT: [{ waId: { startsWith: 'erased_' } }, { waId: '' }],
        },
        orderBy: { lastInteractionAt: 'asc' },
        take: config.dailyLimit - dailyCount,
        select: {
          id: true,
          waId: true,
          firstName: true,
          lastInteractionAt: true,
          lastWinBackAt: true,
        },
      }) as Promise<ReactivationCandidate[]>;
    });

    for (const customer of candidates) {
      if (dailyCount >= config.dailyLimit) break;

      let delivered = false;
      try {
        await withTenantContext(salon.id, async () => {
          const db = getTenantDb();
          const fresh = await db.customer.findFirst({
            where: {
              id: customer.id,
              deletedAt: null,
              marketingConsentStatus: 'ACCEPTED',
            },
            select: { id: true, waId: true, firstName: true, lastWinBackAt: true },
          });
          if (!fresh) return;

          const alreadySent = await db.analyticsEvent.findFirst({
            where: {
              salonId: salon.id,
              customerId: fresh.id,
              type: 'reactivation_sent',
              createdAt: { gt: new Date(now - config.cooldownDays * DAY_MS) },
            },
          });
          if (alreadySent) {
            const payload = alreadySent.payload as { inactiveDays?: number } | null;
            if (payload?.inactiveDays === inactiveDays) return;
          }

          const prevWinBackAt = fresh.lastWinBackAt;
          await db.customer.update({
            where: { id: fresh.id },
            data: { lastWinBackAt: new Date() },
          });

          try {
            const { channel, result } = await sendWithFallback({
              salonId: salon.id,
              to: fresh.waId,
              body: buildReactivationBody(fresh.firstName, salonName, inactiveDays),
            });

            if (!isOutboundDelivered(result)) throw new Error('reactivation_delivery_failed');

            await db.analyticsEvent.create({
              data: {
                salonId: salon.id,
                customerId: fresh.id,
                type: 'reactivation_sent',
                payload: { inactiveDays, channel },
              },
            });
            delivered = true;
          } catch (sendErr) {
            await db.customer.update({
              where: { id: fresh.id },
              data: { lastWinBackAt: prevWinBackAt },
            });
            throw sendErr;
          }
        });
        if (delivered) {
          reached++;
          dailyCount++;
        }
      } catch (err) {
        logger.warn({ err, salonId: salon.id, customerId: customer.id }, 'reactivation_send_failed');
      }
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  logger.info({ salonId: salon.id, customersReached: reached }, 'reactivation_campaign_run');
  return reached;
}

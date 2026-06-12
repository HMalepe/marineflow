// Daily win-back campaign (spec: proactive outbound).
// Runs every day at 09:00 Africa/Johannesburg. For each ACTIVE salon with
// botWinbackEnabled, messages customers who:
//   - last interacted 21–60 days ago (recent enough to win back, not spam-old)
//   - haven't received a win-back in the last 30 days
//   - have ACCEPTED marketing consent
// Capped at 50 customers per salon per day.

import { Prisma } from '@prisma/client';
import { inngest } from '../client.js';
import { prisma } from '../../prisma.js';
import { withTenantContext, getTenantDb } from '../../db/tenantSession.js';
import { logger } from '../../logger.js';
import { sendWithFallback } from '../../../services/channelRouter.js';
import {
  WINBACK_COOLDOWN_DAYS,
  WINBACK_DAILY_LIMIT,
  WINBACK_INACTIVE_MAX_DAYS,
  WINBACK_INACTIVE_MIN_DAYS,
  buildWinbackBody,
  isOutboundDelivered,
} from '../../../services/outboundCampaigns.js';
import { parseAutomationsFromMetadata } from '../../automationSettings.js';

const DAY_MS = 86_400_000;

interface SalonTarget {
  id: string;
  name: string;
  tradingName: string | null;
  metadata: unknown;
}

interface WinbackCandidate {
  id: string;
  waId: string;
  firstName: string | null;
  lastWinBackAt: Date | null;
}

export const winbackCampaign = inngest.createFunction(
  {
    id: 'daily-winback-check',
    retries: 1,
    triggers: [{ cron: 'TZ=Africa/Johannesburg 0 9 * * *' }],
  },
  async () => {
    let salons: SalonTarget[];
    try {
      salons = await prisma.salon.findMany({
        where: { status: { in: ['ACTIVE', 'TRIAL'] }, botWinbackEnabled: true, deletedAt: null },
        select: { id: true, name: true, tradingName: true, metadata: true },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2022') {
        logger.warn('winback_campaign_skipped_pending_migration');
        return { salons: 0, totalReached: 0 };
      }
      throw err;
    }

    let totalReached = 0;
    for (const salon of salons) {
      try {
        totalReached += await runWinbackForSalon(salon);
      } catch (err) {
        logger.error({ err, salonId: salon.id }, 'winback_campaign_salon_failed');
      }
    }
    return { salons: salons.length, totalReached };
  },
);

async function runWinbackForSalon(salon: SalonTarget): Promise<number> {
  const automations = parseAutomationsFromMetadata(salon.metadata);
  // Avoid double-messaging: reactivation campaign handles configurable inactive tiers.
  if (automations.reactivation.enabled) {
    logger.info({ salonId: salon.id }, 'winback_skipped_reactivation_enabled');
    return 0;
  }

  const now = Date.now();

  const candidates = await withTenantContext(salon.id, async () => {
    return getTenantDb().customer.findMany({
      where: {
        salonId: salon.id,
        deletedAt: null,
        marketingConsentStatus: 'ACCEPTED',
        lastInteractionAt: {
          not: null,
          lt: new Date(now - WINBACK_INACTIVE_MIN_DAYS * DAY_MS),
          gt: new Date(now - WINBACK_INACTIVE_MAX_DAYS * DAY_MS),
        },
        OR: [
          { lastWinBackAt: null },
          { lastWinBackAt: { lt: new Date(now - WINBACK_COOLDOWN_DAYS * DAY_MS) } },
        ],
        NOT: [{ waId: { startsWith: 'erased_' } }, { waId: '' }],
      },
      orderBy: { lastInteractionAt: 'asc' },
      take: WINBACK_DAILY_LIMIT,
      select: { id: true, waId: true, firstName: true, lastWinBackAt: true },
    }) as Promise<WinbackCandidate[]>;
  });

  const salonName = salon.tradingName ?? salon.name;
  let reached = 0;

  for (const customer of candidates) {
    let delivered = false;
    try {
      await withTenantContext(salon.id, async () => {
        const db = getTenantDb();

        // Re-check consent at send time — customer may have STOP'd since the batch query
        const fresh = await db.customer.findFirst({
          where: {
            id: customer.id,
            deletedAt: null,
            marketingConsentStatus: 'ACCEPTED',
            NOT: [{ waId: { startsWith: 'erased_' } }, { waId: '' }],
          },
          select: { id: true, waId: true, firstName: true, lastWinBackAt: true },
        });
        if (!fresh) return;

        const prevWinBackAt = fresh.lastWinBackAt;
        await db.customer.update({
          where: { id: fresh.id },
          data: { lastWinBackAt: new Date() },
        });

        try {
          const { channel, result } = await sendWithFallback({
            salonId: salon.id,
            to: fresh.waId,
            body: buildWinbackBody(fresh.firstName, salonName),
          });

          if (!isOutboundDelivered(result)) {
            throw new Error('winback_delivery_failed');
          }

          await db.analyticsEvent.create({
            data: {
              salonId: salon.id,
              customerId: fresh.id,
              type: 'winback_sent',
              payload: { channel },
            },
          });
          delivered = true;
        } catch (sendErr) {
          // Roll back cooldown so a delivery failure doesn't block retries for 30 days
          await db.customer.update({
            where: { id: fresh.id },
            data: { lastWinBackAt: prevWinBackAt },
          });
          throw sendErr;
        }
      });
      if (delivered) reached++;
    } catch (err) {
      logger.warn({ err, salonId: salon.id, customerId: customer.id }, 'winback_send_failed');
    }
    await new Promise((r) => setTimeout(r, 100));
  }

  logger.info({ salonId: salon.id, customersReached: reached }, 'winback_campaign_run');
  return reached;
}

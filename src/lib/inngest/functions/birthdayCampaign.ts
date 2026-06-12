// Daily birthday messages (spec: proactive outbound).
// Runs every day at 08:00 Africa/Johannesburg. For each ACTIVE salon with
// botBirthdayEnabled, messages consented customers whose birthday is today
// (in the salon's own timezone). Customers born on 29 Feb are celebrated on
// 28 Feb in non-leap years. The "reply BIRTHDAY" treat is handled in bot.ts.

import { Prisma } from '@prisma/client';
import { inngest } from '../client.js';
import { prisma } from '../../prisma.js';
import { withTenantContext, getTenantDb } from '../../db/tenantSession.js';
import { logger } from '../../logger.js';
import { sendWithFallback } from '../../../services/channelRouter.js';
import {
  buildBirthdayBody,
  birthdayPartsForTimezone,
  isOutboundDelivered,
} from '../../../services/outboundCampaigns.js';

const DAY_MS = 86_400_000;
/** Re-send guard window — well past any year boundary edge cases. */
const DEDUP_WINDOW_DAYS = 300;

interface SalonTarget {
  id: string;
  name: string;
  tradingName: string | null;
  timezone: string;
}

interface BirthdayCandidate {
  id: string;
  waId: string;
  firstName: string | null;
}

export const birthdayCampaign = inngest.createFunction(
  {
    id: 'daily-birthday-messages',
    retries: 1,
    triggers: [{ cron: 'TZ=Africa/Johannesburg 0 8 * * *' }],
  },
  async () => {
    let salons: SalonTarget[];
    try {
      salons = await prisma.salon.findMany({
        where: { status: { in: ['ACTIVE', 'TRIAL'] }, botBirthdayEnabled: true, deletedAt: null },
        select: { id: true, name: true, tradingName: true, timezone: true },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2022') {
        logger.warn('birthday_campaign_skipped_pending_migration');
        return { salons: 0, totalSent: 0 };
      }
      throw err;
    }

    let totalSent = 0;
    for (const salon of salons) {
      try {
        totalSent += await runBirthdaysForSalon(salon);
      } catch (err) {
        logger.error({ err, salonId: salon.id }, 'birthday_campaign_salon_failed');
      }
    }
    return { salons: salons.length, totalSent };
  },
);

async function runBirthdaysForSalon(salon: SalonTarget): Promise<number> {
  const { month, day, includeLeapDay } = birthdayPartsForTimezone(salon.timezone);

  const candidates = await withTenantContext(salon.id, async () => {
    return getTenantDb().$queryRaw<BirthdayCandidate[]>`
      SELECT c."id", c."waId", c."firstName"
      FROM "Customer" c
      WHERE c."salonId" = ${salon.id}
        AND c."deletedAt" IS NULL
        AND c."marketingConsentStatus" = 'ACCEPTED'::"MarketingConsentStatus"
        AND c."waId" NOT LIKE 'erased\\_%'
        AND c."waId" <> ''
        AND c."dateOfBirth" IS NOT NULL
        AND (
          (EXTRACT(MONTH FROM c."dateOfBirth") = ${month} AND EXTRACT(DAY FROM c."dateOfBirth") = ${day})
          OR (${includeLeapDay} AND EXTRACT(MONTH FROM c."dateOfBirth") = 2 AND EXTRACT(DAY FROM c."dateOfBirth") = 29)
        )
        AND NOT EXISTS (
          SELECT 1 FROM "AnalyticsEvent" ae
          WHERE ae."salonId" = c."salonId"
            AND ae."customerId" = c."id"
            AND ae."type" = 'birthday_sent'
            AND ae."createdAt" > ${new Date(Date.now() - DEDUP_WINDOW_DAYS * DAY_MS)}
        )
    `;
  });

  const salonName = salon.tradingName ?? salon.name;
  let sent = 0;

  for (const customer of candidates) {
    let delivered = false;
    try {
      await withTenantContext(salon.id, async () => {
        const db = getTenantDb();

        const fresh = await db.customer.findFirst({
          where: {
            id: customer.id,
            deletedAt: null,
            marketingConsentStatus: 'ACCEPTED',
            dateOfBirth: { not: null },
            NOT: [{ waId: { startsWith: 'erased_' } }, { waId: '' }],
          },
          select: { id: true, waId: true, firstName: true },
        });
        if (!fresh) return;

        const { result } = await sendWithFallback({
          salonId: salon.id,
          to: fresh.waId,
          body: buildBirthdayBody(fresh.firstName, salonName),
        });

        if (!isOutboundDelivered(result)) {
          throw new Error('birthday_delivery_failed');
        }

        // Record AFTER successful delivery — a failed send must not block
        // the dedup guard and prevent a retry on the next cron run.
        await db.analyticsEvent.create({
          data: {
            salonId: salon.id,
            customerId: fresh.id,
            type: 'birthday_sent',
            payload: { month, day },
          },
        });
        delivered = true;
      });
      if (delivered) sent++;
    } catch (err) {
      logger.warn({ err, salonId: salon.id, customerId: customer.id }, 'birthday_send_failed');
    }
    await new Promise((r) => setTimeout(r, 100));
  }

  logger.info({ salonId: salon.id, birthdaysSent: sent }, 'birthday_campaign_run');
  return sent;
}

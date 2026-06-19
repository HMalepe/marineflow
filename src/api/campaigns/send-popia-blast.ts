import { getTenantDb } from '../../lib/db/tenantSession.js';
import { logger } from '../../lib/logger.js';
import { buildPopiaConsentMessage } from '../../services/marketingConsent.js';
import { sendWithFallback } from '../../services/channelRouter.js';

export type PopiaBlastResult = {
  sent: number;
  failed: number;
  skipped: number;
  total: number;
};

/**
 * One-click bulk WhatsApp to customers who have not replied to POPIA marketing consent yet.
 */
export async function sendPopiaConsentBlast(salonId: string): Promise<PopiaBlastResult> {
  const db = getTenantDb();
  const salon = await db.salon.findUniqueOrThrow({
    where: { id: salonId },
    select: { name: true },
  });

  const pending = await db.customer.findMany({
    where: {
      salonId,
      deletedAt: null,
      marketingConsentStatus: 'PENDING',
      waId: { not: { startsWith: 'erased_' } },
    },
    select: { id: true, waId: true },
    orderBy: { lastInteractionAt: 'desc' },
    take: 500,
  });

  const body = buildPopiaConsentMessage(salon.name);
  let sent = 0;
  let failed = 0;

  for (const customer of pending) {
    if (!customer.waId?.trim()) continue;
    try {
      const { result } = await sendWithFallback({
        salonId,
        to: customer.waId,
        body,
      });
      if (result.providerMessageId) sent++;
      else failed++;
    } catch (err) {
      failed++;
      logger.warn({ err, customerId: customer.id, salonId }, 'popia_blast_send_failed');
    }
    await new Promise((r) => setTimeout(r, 25));
  }

  return {
    sent,
    failed,
    skipped: pending.length - sent - failed,
    total: pending.length,
  };
}

export async function countPopiaPendingCustomers(salonId: string): Promise<number> {
  const db = getTenantDb();
  return db.customer.count({
    where: {
      salonId,
      deletedAt: null,
      marketingConsentStatus: 'PENDING',
      waId: { not: { startsWith: 'erased_' } },
    },
  });
}

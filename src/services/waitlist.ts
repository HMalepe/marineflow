import { getTenantDb } from '../lib/db/tenantSession.js';
import { sendWithFallback } from './channelRouter.js';
import { logger } from '../lib/logger.js';
import { newWaitlistClaim } from '../lib/powerFeaturesMenu.js';

const WAITLIST_EXPIRY_HOURS = 24;

/**
 * Add a customer to the waitlist for a specific service.
 */
export async function addToWaitlist(params: {
  salonId: string;
  customerId: string;
  serviceId: string;
  staffId?: string;
  branchId?: string;
  preferredDate?: string;
}) {
  const db = getTenantDb();

  const existing = await db.waitlistEntry.findFirst({
    where: {
      salonId: params.salonId,
      customerId: params.customerId,
      serviceId: params.serviceId,
      notified: false,
    },
  });

  if (existing) return existing;

  return db.waitlistEntry.create({
    data: {
      salonId: params.salonId,
      customerId: params.customerId,
      serviceId: params.serviceId,
      staffId: params.staffId,
      branchId: params.branchId,
      preferredDate: params.preferredDate,
      expiresAt: new Date(Date.now() + WAITLIST_EXPIRY_HOURS * 60 * 60 * 1000),
    },
  });
}

/**
 * Called when an appointment is cancelled — notify waitlisted customers.
 * Picks the first matching waitlist entry and sends a notification.
 */
export async function notifyWaitlistOnCancel(params: {
  salonId: string;
  serviceId: string;
  staffId?: string;
  staffName?: string;
  slotStart?: Date;
  timezone?: string;
  date?: string;
}) {
  const db = getTenantDb();

  const entries = await db.waitlistEntry.findMany({
    where: {
      salonId: params.salonId,
      serviceId: params.serviceId,
      notified: false,
      expiresAt: { gt: new Date() },
      ...(params.staffId ? { OR: [{ staffId: params.staffId }, { staffId: null }] } : {}),
    },
    include: { customer: true },
    orderBy: { createdAt: 'asc' },
    take: 3,
  });

  const staff = params.staffId
    ? await db.staff.findUnique({ where: { id: params.staffId }, select: { name: true } })
    : null;
  const staffName = params.staffName ?? staff?.name ?? 'your stylist';

  let slotLabel = 'soon';
  if (params.slotStart && params.timezone) {
    slotLabel = params.slotStart.toLocaleString('en-ZA', {
      timeZone: params.timezone,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  for (const entry of entries) {
    try {
      const customer = entry.customer;
      if (!customer.waId || customer.waId.startsWith('erased_')) continue;
      if (customer.deletedAt) continue;
      if (customer.marketingConsentStatus !== 'ACCEPTED') continue;

      const service = await db.service.findUnique({
        where: { id: params.serviceId },
        select: { name: true, active: true, deletedAt: true },
      });
      if (!service?.active || service.deletedAt) continue;

      await sendWithFallback({
        salonId: params.salonId,
        to: customer.waId,
        body:
          `Good news! A ${slotLabel} slot has opened with ${staffName} for ${service.name}.\n\n` +
          `Reply *YES* to claim it, or *SKIP* to pass.`,
      });

      await db.waitlistEntry.update({
        where: { id: entry.id },
        data: { notified: true, notifiedAt: new Date() },
      });

      const conv = await db.conversation.findUnique({
        where: { salonId_customerId: { salonId: params.salonId, customerId: customer.id } },
        select: { id: true, context: true },
      });
      if (conv) {
        const existingCtx =
          typeof conv.context === 'object' && conv.context ? (conv.context as Record<string, unknown>) : {};
        const claim = newWaitlistClaim({
          serviceId: params.serviceId,
          staffId: params.staffId,
          slotStart: params.slotStart,
        });
        await db.conversation.update({
          where: { id: conv.id },
          data: {
            context: { ...existingCtx, waitlistClaim: claim },
            step: 'MENU',
          },
        });
      }

      logger.info({ entryId: entry.id, customerId: customer.id }, 'waitlist_notified');
      break;
    } catch (err) {
      logger.error({ err, entryId: entry.id }, 'waitlist_notify_error');
    }
  }
}

/**
 * Clean up expired waitlist entries.
 */
export async function cleanExpiredWaitlist(salonId: string) {
  const db = getTenantDb();
  const result = await db.waitlistEntry.deleteMany({
    where: {
      salonId,
      OR: [
        { expiresAt: { lt: new Date() } },
        { notified: true, notifiedAt: { lt: new Date(Date.now() - 2 * 60 * 60 * 1000) } },
      ],
    },
  });
  return result.count;
}

/**
 * Get the waitlist for a salon (for dashboard display).
 */
export async function getWaitlist(salonId: string) {
  const db = getTenantDb();
  return db.waitlistEntry.findMany({
    where: { salonId, notified: false, expiresAt: { gt: new Date() } },
    include: { customer: { select: { firstName: true, lastName: true, waId: true } } },
    orderBy: { createdAt: 'asc' },
  });
}

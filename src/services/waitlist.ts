import { getTenantDb } from '../lib/db/tenantSession.js';
import { sendWithFallback } from './channelRouter.js';
import { logger } from '../lib/logger.js';

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

  for (const entry of entries) {
    try {
      const customer = entry.customer;
      if (!customer.waId) continue;

      await sendWithFallback({
        salonId: params.salonId,
        to: customer.waId,
        body: `Good news! A spot has opened up for the service you were waiting for. Reply BOOK to grab it, or reply SKIP to stay on the waitlist.`,
      });

      await db.waitlistEntry.update({
        where: { id: entry.id },
        data: { notified: true, notifiedAt: new Date() },
      });

      logger.info({ entryId: entry.id, customerId: customer.id }, 'waitlist_notified');
      break; // Only notify the first eligible person
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

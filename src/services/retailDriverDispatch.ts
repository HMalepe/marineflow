/**
 * Uber-style driver dispatch over the shared WhatsApp business number.
 * First ACCEPT wins; others get “job taken”. DECLINE records and stands down.
 */

import type { RetailOrder, RetailOrderItem, RetailOrderStatus } from '@prisma/client';
import { getTenantDb, withTenantContext } from '../lib/db/tenantSession.js';
import { prisma } from '../lib/prisma.js';
import { normalizeWaId } from '../lib/phone.js';
import { getLinkedBusinesses, isBusinessRouterSalon, isSwitchBusinessCommand } from '../lib/businessRouter.js';
import {
  formatZarFromCents,
  getRetailSettings,
  type RetailDriver,
  type RetailSettings,
} from '../lib/retailSettings.js';
import { logger } from '../lib/logger.js';
import { redis } from '../lib/redis.js';
import { isConversationWakeMessage } from '../lib/conversationWake.js';
import { sendWithFallback } from './channelRouter.js';
import { emitRetailOrderUpdated } from './retailOrderNotify.js';

const OFFER_TTL_SEC = 15 * 60;

export type RetailOrderWithItems = RetailOrder & {
  items: RetailOrderItem[];
  customer?: {
    waId: string;
    displayName?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  } | null;
};

type DriverDispatchMeta = {
  status: 'offered' | 'assigned' | 'expired';
  offeredAt: string;
  offeredTo: string[];
  declinedBy: string[];
  assignedWaId?: string;
  assignedName?: string;
  assignedAt?: string;
};

function orderRef(orderId: string): string {
  return `#${orderId.slice(-6).toUpperCase()}`;
}

function sanitize(s: string): string {
  return s.replace(/[*_`~]/g, '').trim().slice(0, 80);
}

function addressLine(order: RetailOrder): string {
  return [order.deliveryLine1, order.deliverySuburb, order.deliveryCity]
    .filter((x) => typeof x === 'string' && x.trim())
    .join(', ');
}

function itemsSummary(items: RetailOrderItem[]): string {
  return items.map((i) => `• ${i.nameSnapshot} ×${i.quantity}`).join('\n');
}

function customerLabel(order: RetailOrderWithItems): string {
  const c = order.customer;
  if (!c) return 'Customer';
  return (
    c.displayName?.trim() ||
    [c.firstName, c.lastName].filter(Boolean).join(' ') ||
    c.waId
  );
}

function readDispatchMeta(metadata: unknown): DriverDispatchMeta | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const raw = (metadata as Record<string, unknown>).driverDispatch;
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Record<string, unknown>;
  if (d.status !== 'offered' && d.status !== 'assigned' && d.status !== 'expired') return null;
  return {
    status: d.status,
    offeredAt: typeof d.offeredAt === 'string' ? d.offeredAt : new Date().toISOString(),
    offeredTo: Array.isArray(d.offeredTo)
      ? d.offeredTo.filter((x): x is string => typeof x === 'string')
      : [],
    declinedBy: Array.isArray(d.declinedBy)
      ? d.declinedBy.filter((x): x is string => typeof x === 'string')
      : [],
    assignedWaId: typeof d.assignedWaId === 'string' ? d.assignedWaId : undefined,
    assignedName: typeof d.assignedName === 'string' ? d.assignedName : undefined,
    assignedAt: typeof d.assignedAt === 'string' ? d.assignedAt : undefined,
  };
}

function offerRedisKey(waId: string): string {
  return `retail:driver:offer:${normalizeWaId(waId)}`;
}

async function rememberOffer(waId: string, salonId: string, orderId: string): Promise<void> {
  try {
    await redis.set(
      offerRedisKey(waId),
      JSON.stringify({ salonId, orderId }),
      'EX',
      OFFER_TTL_SEC,
    );
  } catch (err) {
    logger.warn({ err, waId, orderId }, 'retail_driver_offer_redis_failed');
  }
}

async function readRememberedOffer(
  waId: string,
): Promise<{ salonId: string; orderId: string } | null> {
  try {
    const raw = await redis.get(offerRedisKey(waId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { salonId?: string; orderId?: string };
    if (!parsed.salonId || !parsed.orderId) return null;
    return { salonId: parsed.salonId, orderId: parsed.orderId };
  } catch {
    return null;
  }
}

async function clearRememberedOffer(waId: string): Promise<void> {
  try {
    await redis.del(offerRedisKey(waId));
  } catch {
    // ignore
  }
}

export function listRegisteredDrivers(settings: RetailSettings): RetailDriver[] {
  if (settings.drivers.length > 0) {
    return settings.drivers
      .map((d) => ({
        name: d.name.trim() || 'Driver',
        phone: normalizeWaId(d.phone),
      }))
      .filter((d) => d.phone.length >= 10);
  }
  return settings.driverPhones
    .map((p, i) => ({ name: `Driver ${i + 1}`, phone: normalizeWaId(p) }))
    .filter((d) => d.phone.length >= 10);
}

export function isDriverDispatchEnabled(settings: RetailSettings): boolean {
  return settings.driverNotifyEnabled && listRegisteredDrivers(settings).length > 0;
}

/** Resolve which dispensary salon(s) register this WhatsApp as a driver. */
export async function findDriverSalonsForWaId(waId: string): Promise<
  { salonId: string; driver: RetailDriver }[]
> {
  const digits = normalizeWaId(waId);
  if (!digits) return [];

  const salons = await prisma.salon.findMany({
    where: {
      deletedAt: null,
      OR: [{ industryTemplate: 'dispensary' }, { isBusinessRouter: true }],
    },
    select: {
      id: true,
      industryTemplate: true,
      isBusinessRouter: true,
      metadata: true,
    },
  });

  const hits: { salonId: string; driver: RetailDriver }[] = [];
  const seen = new Set<string>();

  async function considerSalon(salonId: string, metadata: unknown) {
    if (seen.has(salonId)) return;
    const settings = getRetailSettings(metadata);
    if (!isDriverDispatchEnabled(settings)) return;
    const driver = listRegisteredDrivers(settings).find((d) => d.phone === digits);
    if (!driver) return;
    seen.add(salonId);
    hits.push({ salonId, driver });
  }

  for (const salon of salons) {
    if (salon.industryTemplate === 'dispensary') {
      await considerSalon(salon.id, salon.metadata);
    }
    if (isBusinessRouterSalon(salon)) {
      for (const linked of getLinkedBusinesses(salon)) {
        const linkedSalon = await prisma.salon.findFirst({
          where: { id: linked.salonId, deletedAt: null },
          select: { id: true, industryTemplate: true, metadata: true },
        });
        if (linkedSalon?.industryTemplate === 'dispensary') {
          await considerSalon(linkedSalon.id, linkedSalon.metadata);
        }
      }
    }
  }

  return hits;
}

function buildOfferMessage(
  shopName: string,
  order: RetailOrderWithItems,
  driverName: string,
): string {
  const addr = addressLine(order) || 'Address in dashboard';
  return [
    `🛵 *Delivery request ${orderRef(order.id)}* — ${shopName}`,
    `Hi ${sanitize(driverName)} — new job available.`,
    '',
    `Customer: ${sanitize(customerLabel(order))}`,
    `📍 ${addr}`,
    `Paid online: *${formatZarFromCents(order.totalCents)}*`,
    '',
    itemsSummary(order.items),
    '',
    'Reply *ACCEPT* to take this job',
    'Reply *DECLINE* to pass',
    '',
    '_First ACCEPT wins — same as Uber._',
  ].join('\n');
}

export function isRetailOrderReadyForDriverOffer(status: RetailOrderStatus): boolean {
  return status === 'PAID' || status === 'PREPARING';
}

/**
 * Broadcast a delivery job to all registered drivers on the shared WhatsApp number.
 * Uses the operating salon id for send — outbound falls back to the router number.
 */
export async function offerDeliveryToDrivers(
  order: RetailOrderWithItems,
): Promise<{ offered: number }> {
  if (order.fulfillment !== 'DELIVERY') return { offered: 0 };
  if (!isRetailOrderReadyForDriverOffer(order.status)) {
    logger.info({ orderId: order.id, status: order.status }, 'retail_driver_offer_skipped_unpaid');
    return { offered: 0 };
  }

  const salon = await getTenantDb().salon.findUnique({
    where: { id: order.salonId },
    select: { metadata: true, tradingName: true, name: true },
  });
  if (!salon) return { offered: 0 };

  const settings = getRetailSettings(salon.metadata);
  const drivers = listRegisteredDrivers(settings);
  if (!isDriverDispatchEnabled(settings) || drivers.length === 0) {
    logger.info({ orderId: order.id }, 'retail_driver_offer_skipped_disabled');
    return { offered: 0 };
  }

  const existing = readDispatchMeta(order.metadata);
  if (existing?.status === 'assigned') {
    return { offered: 0 };
  }

  const shopName = salon.tradingName?.trim() || salon.name;
  const offeredTo = drivers.map((d) => d.phone);

  const meta: DriverDispatchMeta = {
    status: 'offered',
    offeredAt: new Date().toISOString(),
    offeredTo,
    declinedBy: existing?.declinedBy ?? [],
  };

  await getTenantDb().retailOrder.update({
    where: { id: order.id },
    data: {
      metadata: {
        ...((order.metadata && typeof order.metadata === 'object'
          ? order.metadata
          : {}) as object),
        driverDispatch: meta,
      },
    },
  });

  await Promise.allSettled(
    drivers.map(async (driver) => {
      await rememberOffer(driver.phone, order.salonId, order.id);
      await sendWithFallback({
        salonId: order.salonId,
        to: driver.phone,
        body: buildOfferMessage(shopName, order, driver.name),
      });
    }),
  );

  logger.info(
    { orderId: order.id, offered: drivers.length },
    'retail_driver_offers_sent',
  );
  return { offered: drivers.length };
}

function wantsToShopAsCustomer(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (isConversationWakeMessage(text) || isSwitchBusinessCommand(text)) return true;
  return /^(thanks|thank you|ok|okay|shop|order|buy|menu)$/i.test(t);
}

const SHOP_FOR_YOURSELF =
  'Want to shop for yourself? Reply *HI* and pick BontleEntle or Dr Marley.';

function parseDriverReply(text: string): 'accept' | 'decline' | null {
  const t = text.trim().toLowerCase();
  if (
    t === 'accept' ||
    t === 'yes' ||
    t === '1' ||
    t === 'take' ||
    t === "i'll take it" ||
    t === 'ill take it'
  ) {
    return 'accept';
  }
  if (t === 'decline' || t === 'no' || t === '2' || t === 'pass' || t === 'busy') {
    return 'decline';
  }
  return null;
}

/**
 * If this WhatsApp belongs to a registered driver, handle ACCEPT/DECLINE
 * (and short help). Returns true when the inbound message is fully handled.
 */
export async function tryHandleDriverWhatsApp(input: {
  waId: string;
  text: string;
}): Promise<boolean> {
  const hits = await findDriverSalonsForWaId(input.waId);
  if (hits.length === 0) return false;

  const intent = parseDriverReply(input.text);
  const remembered = await readRememberedOffer(input.waId);

  // No live job, or they said hi/thanks/shop — send them into the customer picker
  if (!remembered || (!intent && wantsToShopAsCustomer(input.text))) {
    return false;
  }

  // Prefer remembered offer salon, else first matching dispensary
  const salonId = remembered?.salonId ?? hits[0]!.salonId;
  const driver = hits.find((h) => h.salonId === salonId)?.driver ?? hits[0]!.driver;

  return withTenantContext(salonId, async () => {
    const db = getTenantDb();

    if (!intent) {
      await sendWithFallback({
        salonId,
        to: input.waId,
        body: [
          `Hi ${sanitize(driver.name)} — you’re registered for deliveries.`,
          '',
          'When a job comes in, reply *ACCEPT* or *DECLINE*.',
          remembered
            ? `You have an open offer for order ${orderRef(remembered.orderId)}.`
            : 'No open job on your phone right now.',
          '',
          SHOP_FOR_YOURSELF,
        ].join('\n'),
      });
      return true;
    }

    const orderId = remembered?.orderId;
    if (!orderId) {
      await sendWithFallback({
        salonId,
        to: input.waId,
        body: [
          'No open delivery offer right now. You’ll get a WhatsApp when the next job drops.',
          '',
          SHOP_FOR_YOURSELF,
        ].join('\n'),
      });
      return true;
    }

    const order = await db.retailOrder.findFirst({
      where: { id: orderId, salonId },
      include: {
        items: true,
        customer: {
          select: { waId: true, displayName: true, firstName: true, lastName: true },
        },
      },
    });

    if (!order) {
      await clearRememberedOffer(input.waId);
      await sendWithFallback({
        salonId,
        to: input.waId,
        body: [
          'That offer expired. Wait for the next ping.',
          '',
          SHOP_FOR_YOURSELF,
        ].join('\n'),
      });
      return true;
    }

    if (order.status === 'PENDING_PAYMENT' || order.status === 'DRAFT') {
      await sendWithFallback({
        salonId,
        to: input.waId,
        body: [
          `${orderRef(order.id)} isn’t paid yet — wait for the PayFast confirmation ping.`,
          '',
          SHOP_FOR_YOURSELF,
        ].join('\n'),
      });
      return true;
    }

    const dispatch = readDispatchMeta(order.metadata) ?? {
      status: 'offered' as const,
      offeredAt: new Date().toISOString(),
      offeredTo: [],
      declinedBy: [],
    };

    if (intent === 'decline') {
      const declinedBy = [...new Set([...dispatch.declinedBy, normalizeWaId(input.waId)])];
      await db.retailOrder.update({
        where: { id: order.id },
        data: {
          metadata: {
            ...((order.metadata && typeof order.metadata === 'object'
              ? order.metadata
              : {}) as object),
            driverDispatch: { ...dispatch, declinedBy },
          },
        },
      });
      await clearRememberedOffer(input.waId);
      await sendWithFallback({
        salonId,
        to: input.waId,
        body: [
          `👍 Noted — you declined ${orderRef(order.id)}. We’ll ping you on the next one.`,
          '',
          SHOP_FOR_YOURSELF,
        ].join('\n'),
      });
      return true;
    }

    // ACCEPT — first wins
    if (dispatch.status === 'assigned' && dispatch.assignedWaId !== normalizeWaId(input.waId)) {
      await clearRememberedOffer(input.waId);
      await sendWithFallback({
        salonId,
        to: input.waId,
        body: `Too late — ${orderRef(order.id)} was already taken by another rider.`,
      });
      return true;
    }

    if (dispatch.status === 'assigned' && dispatch.assignedWaId === normalizeWaId(input.waId)) {
      await sendWithFallback({
        salonId,
        to: input.waId,
        body: `You’re already on ${orderRef(order.id)}. Head to pick-up when ready.`,
      });
      return true;
    }

    const assignedAt = new Date().toISOString();
    const nextMeta: DriverDispatchMeta = {
      ...dispatch,
      status: 'assigned',
      assignedWaId: normalizeWaId(input.waId),
      assignedName: driver.name,
      assignedAt,
    };

    const updated = await db.retailOrder.update({
      where: { id: order.id },
      data: {
        status: 'OUT_FOR_DELIVERY' as RetailOrderStatus,
        metadata: {
          ...((order.metadata && typeof order.metadata === 'object'
            ? order.metadata
            : {}) as object),
          driverDispatch: nextMeta,
        },
      },
      include: {
        items: true,
        customer: {
          select: { waId: true, displayName: true, firstName: true, lastName: true },
        },
      },
    });

    await clearRememberedOffer(input.waId);

    const addr = addressLine(updated) || 'See dashboard';
    await sendWithFallback({
      salonId,
      to: input.waId,
      body: [
        `✅ *You’re on ${orderRef(updated.id)}*`,
        `Customer: ${sanitize(customerLabel(updated))}`,
        `📍 ${addr}`,
        `Paid: *${formatZarFromCents(updated.totalCents)}* (already collected via PayFast)`,
        '',
        'Pick up at the shop, then deliver. Reply when done if staff ask.',
      ].join('\n'),
    });

    // Notify losers + clear their redis offers
    const others = dispatch.offeredTo.filter((p) => p !== normalizeWaId(input.waId));
    await Promise.allSettled(
      others.map(async (phone) => {
        await clearRememberedOffer(phone);
        await sendWithFallback({
          salonId,
          to: phone,
          body: `ℹ️ ${orderRef(updated.id)} was taken by another rider.`,
        });
      }),
    );

    // Customer + shop
    if (updated.customer?.waId) {
      await sendWithFallback({
        salonId,
        to: updated.customer.waId,
        body: `🛵 *${orderRef(updated.id)} is on the way*\n\nYour rider *${sanitize(driver.name)}* accepted the job. Keep your phone handy.`,
      });
    }

    const staff = await db.staffUser.findMany({
      where: {
        salonId,
        active: true,
        role: { in: ['OWNER', 'MANAGER', 'RECEPTIONIST'] },
        phone: { not: null },
      },
      select: { phone: true },
    });
    await Promise.allSettled(
      staff.map(async (s) => {
        const to = normalizeWaId(s.phone ?? '');
        if (!to) return;
        await sendWithFallback({
          salonId,
          to,
          body: `✅ Driver *${sanitize(driver.name)}* accepted ${orderRef(updated.id)} — marked out for delivery.`,
        });
      }),
    );

    await emitRetailOrderUpdated(salonId, updated.id, {
      status: updated.status,
      driverWaId: normalizeWaId(input.waId),
      driverName: driver.name,
    });

    return true;
  });
}

/** Fire-and-forget broadcast after a delivery order is ready for riders. */
export function offerDeliveryToDriversLater(order: RetailOrderWithItems): void {
  void offerDeliveryToDrivers(order).catch((err) =>
    logger.warn({ err, orderId: order.id }, 'retail_driver_offer_failed'),
  );
}

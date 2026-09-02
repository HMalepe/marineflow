/**
 * Uber Eats–style retail order notifications:
 * - Shop (owner/manager WhatsApp) on new order
 * - Customer WhatsApp on status changes
 * - Driver ACCEPT/DECLINE offers via retailDriverDispatch (same shared number)
 */

import type { RetailFulfillment, RetailOrder, RetailOrderItem, RetailOrderStatus } from '@prisma/client';
import { getTenantDb } from '../lib/db/tenantSession.js';
import { publishEvent } from '../lib/eventBus.js';
import { formatZarFromCents, getRetailSettings } from '../lib/retailSettings.js';
import { logger } from '../lib/logger.js';
import { normalizeWaId } from '../lib/phone.js';
import { sendWithFallback } from './channelRouter.js';

export type RetailOrderWithItems = RetailOrder & {
  items: RetailOrderItem[];
  customer?: {
    waId: string;
    displayName?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  } | null;
};

function sanitize(s: string): string {
  return s.replace(/[*_`~]/g, '').trim().slice(0, 80);
}

function orderRef(orderId: string): string {
  return `#${orderId.slice(-6).toUpperCase()}`;
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

function itemsSummary(items: RetailOrderItem[]): string {
  return items.map((i) => `• ${i.nameSnapshot} ×${i.quantity}`).join('\n');
}

function addressLine(order: RetailOrder): string {
  return [order.deliveryLine1, order.deliverySuburb, order.deliveryCity]
    .filter((x) => typeof x === 'string' && x.trim())
    .join(', ');
}

export function emitRetailOrderCreated(salonId: string, orderId: string, summary: Record<string, unknown>) {
  return publishEvent({
    type: 'retail.order.created',
    salonId,
    payload: { orderId, ...summary },
    timestamp: new Date().toISOString(),
  });
}

export function emitRetailOrderUpdated(salonId: string, orderId: string, changes: Record<string, unknown>) {
  return publishEvent({
    type: 'retail.order.updated',
    salonId,
    payload: { orderId, ...changes },
    timestamp: new Date().toISOString(),
  });
}

async function shopNotifyPhones(salonId: string): Promise<string[]> {
  const staff = await getTenantDb().staffUser.findMany({
    where: {
      salonId,
      active: true,
      role: { in: ['OWNER', 'MANAGER', 'RECEPTIONIST'] },
      phone: { not: null },
    },
    select: { phone: true },
  });
  const phones = new Set<string>();
  for (const row of staff) {
    const digits = normalizeWaId(row.phone ?? '');
    if (digits) phones.add(digits);
  }
  return [...phones];
}

/** Ping shop staff when a new WhatsApp order lands — like a restaurant tablet ping. */
export async function notifyShopOfNewOrder(order: RetailOrderWithItems): Promise<void> {
  const salon = await getTenantDb().salon.findUnique({
    where: { id: order.salonId },
    select: { metadata: true, tradingName: true, name: true },
  });
  if (!salon) return;

  const settings = getRetailSettings(salon.metadata);
  if (settings.notifyStaffOnOrder === false) return;

  const shopName = salon.tradingName?.trim() || salon.name;
  const fulfillment =
    order.fulfillment === 'COLLECTION' ? '🏪 Collection' : '🚚 Delivery';
  const addr = addressLine(order);
  const body = [
    `🔔 *New order ${orderRef(order.id)}* — ${shopName}`,
    '',
    `${sanitize(customerLabel(order))} · ${formatZarFromCents(order.totalCents)}`,
    fulfillment + (addr ? `\n📍 ${addr}` : ''),
    '',
    itemsSummary(order.items),
    '',
    'Open *Orders* in the dashboard to prep & dispatch.',
  ].join('\n');

  const phones = await shopNotifyPhones(order.salonId);
  if (phones.length === 0) {
    logger.warn({ salonId: order.salonId, orderId: order.id }, 'retail_order_no_staff_phone_to_notify');
  }

  await Promise.allSettled(
    phones.map((to) =>
      sendWithFallback({ salonId: order.salonId, to, body }).catch((err) => {
        logger.warn({ err, to, orderId: order.id }, 'retail_shop_notify_failed');
      }),
    ),
  );

  await getTenantDb()
    .analyticsEvent.create({
      data: {
        salonId: order.salonId,
        customerId: order.customerId,
        type: 'retail_order_placed',
        payload: {
          orderId: order.id,
          totalCents: order.totalCents,
          fulfillment: order.fulfillment,
          notifiedStaff: phones.length,
        },
      },
    })
    .catch((err) => logger.warn({ err }, 'retail_order_analytics_failed'));

  await emitRetailOrderCreated(order.salonId, order.id, {
    status: order.status,
    totalCents: order.totalCents,
    fulfillment: order.fulfillment,
  });
}

function customerStatusCopy(
  status: RetailOrderStatus,
  fulfillment: RetailFulfillment,
  orderId: string,
): string | null {
  const ref = orderRef(orderId);
  switch (status) {
    case 'PREPARING':
      return `👨‍🍳 *${ref} is being prepared*\n\nWe’re packing your order now — hang tight.`;
    case 'OUT_FOR_DELIVERY':
      return `🛵 *${ref} is on the way*\n\nYour rider is heading to you. Please keep your phone nearby for delivery.`;
    case 'READY_FOR_COLLECTION':
      return `✅ *${ref} is ready for collection*\n\nCome through whenever you’re ready — bring this chat as reference.`;
    case 'COMPLETED':
      return fulfillment === 'DELIVERY'
        ? `🙌 *${ref} delivered*\n\nThanks for ordering with us. Reply *MENU* anytime for another drop.`
        : `🙌 *${ref} collected*\n\nThanks for stopping by. Reply *MENU* anytime for another order.`;
    case 'CANCELLED':
      return `❌ *${ref} was cancelled*\n\nIf this looks wrong, reply *SUPPORT* and we’ll help.`;
    default:
      return null;
  }
}

/** Customer WhatsApp updates when shop changes order status (Uber Eats style). */
export async function notifyCustomerOfOrderStatus(
  order: RetailOrderWithItems,
  status: RetailOrderStatus,
): Promise<void> {
  const waId = order.customer?.waId;
  if (!waId) return;
  const copy = customerStatusCopy(status, order.fulfillment, order.id);
  if (!copy) return;

  try {
    await sendWithFallback({ salonId: order.salonId, to: waId, body: copy });
  } catch (err) {
    logger.warn({ err, orderId: order.id }, 'retail_customer_status_notify_failed');
  }
}

/** Fire-and-forget fan-out after an order is created in the bot. */
export function notifyNewRetailOrderLater(order: RetailOrderWithItems): void {
  void (async () => {
    try {
      await notifyShopOfNewOrder(order);
      if (order.fulfillment === 'DELIVERY') {
        // Dynamic import avoids circular dep with retailDriverDispatch
        const { offerDeliveryToDriversLater } = await import('./retailDriverDispatch.js');
        offerDeliveryToDriversLater(order);
      }
    } catch (err) {
      logger.warn({ err, orderId: order.id }, 'retail_new_order_notify_failed');
    }
  })();
}

/** After dashboard status change — customer ping + optional driver re-offer. */
export function notifyRetailOrderStatusLater(
  order: RetailOrderWithItems,
  status: RetailOrderStatus,
): void {
  void (async () => {
    try {
      await notifyCustomerOfOrderStatus(order, status);
      await emitRetailOrderUpdated(order.salonId, order.id, { status });

      // Re-broadcast to drivers when kitchen marks preparing (if not yet assigned)
      if (order.fulfillment === 'DELIVERY' && status === 'PREPARING') {
        const { offerDeliveryToDriversLater } = await import('./retailDriverDispatch.js');
        offerDeliveryToDriversLater(order);
      }
    } catch (err) {
      logger.warn({ err, orderId: order.id, status }, 'retail_status_notify_failed');
    }
  })();
}

import { prisma } from '../lib/prisma.js';
import { getTenantDb } from '../lib/db/tenantSession.js';
import { logger } from '../lib/logger.js';
import { env } from '../config.js';
import { payfastAdapter } from '../lib/integrations/payments/payfast.js';
import { isPayfastConfigured } from '../lib/integrations/payments/index.js';
import { sendWithFallback } from './channelRouter.js';
import { emitPlatformEvent } from './platformEvents.js';
import { scheduleAppointmentReminders } from './appointmentReminders.js';
import { scheduleGoogleReviewForAppointment } from '../lib/googleReviewSchedule.js';
import { notifyAppointmentChangedLater } from './rosterSync.js';
import { scheduleBookingRatingPrompt } from '../lib/inngest/functions/bookingRatingPrompt.js';
import { parseAutomationsFromMetadata } from '../lib/automationSettings.js';
import { startNextChainedBooking } from './chainedBooking.js';
import { MessageDirection, ConversationStep } from '@prisma/client';
import type { Service } from '@prisma/client';
import { DateTime } from 'luxon';

const PAYFAST_NOTIFY_PATH = '/webhooks/payfast/appointment';

/** Strip WhatsApp markdown control characters from user-supplied names. */
function sanitizeForMessage(s: string): string {
  return s.replace(/[*_~`[\]]/g, '');
}

function appointmentPaymentReference(appointmentId: string): string {
  return `appt_${appointmentId}`;
}

export function retailOrderPaymentReference(orderId: string): string {
  return `retail_${orderId}`;
}

export function parsePayfastMerchantReference(
  reference: string | undefined | null,
): { kind: 'appointment'; id: string } | { kind: 'retail'; id: string } | null {
  const ref = reference?.trim();
  if (!ref) return null;
  if (ref.startsWith('appt_')) return { kind: 'appointment', id: ref.slice('appt_'.length) };
  if (ref.startsWith('retail_')) return { kind: 'retail', id: ref.slice('retail_'.length) };
  return null;
}

/** Whether the salon has post-confirm online payment enabled (legacy column alias supported). */
export function salonRequiresPostConfirmPayment(salon: {
  botRequirePaymentStep?: boolean | null;
  botRequireDepositStep?: boolean | null;
}): boolean {
  if (typeof salon.botRequirePaymentStep === 'boolean') return salon.botRequirePaymentStep;
  if (typeof salon.botRequireDepositStep === 'boolean') return salon.botRequireDepositStep;
  return true;
}

/** Full PayFast checkout after booking confirmation — full price or nothing. */
export function resolvePostConfirmPayment(input: {
  bookingTotalCents: number;
  loyaltyRedeemed: boolean;
  requirePaymentStep: boolean;
}): { amountCents: number } | null {
  if (!input.requirePaymentStep || input.loyaltyRedeemed || input.bookingTotalCents <= 0) {
    return null;
  }
  return { amountCents: input.bookingTotalCents };
}

export async function createPaymentCheckoutSession(input: {
  salonId: string;
  customerId: string;
  appointmentId: string;
  service: Service;
  amountCents: number;
}): Promise<string | null> {
  if (!isPayfastConfigured()) {
    logger.warn({ salonId: input.salonId, appointmentId: input.appointmentId }, 'payfast_not_configured');
    return null;
  }
  if (input.amountCents <= 0) return null;

  const baseUrl = env.PUBLIC_BASE_URL ?? 'http://localhost:3000';
  const reference = appointmentPaymentReference(input.appointmentId);

  try {
    const result = await payfastAdapter.createCheckout({
      salonId: input.salonId,
      customerId: input.customerId,
      amountCents: input.amountCents,
      currency: 'ZAR',
      reference,
      description: input.service.name,
      returnUrl: `${baseUrl}/pay/success?ref=${reference}`,
      cancelUrl: `${baseUrl}/pay/cancel?ref=${reference}`,
      notifyUrl: `${baseUrl}${PAYFAST_NOTIFY_PATH}`,
    });

    if (!result.form) {
      logger.error({ appointmentId: input.appointmentId }, 'payfast_checkout_form_missing');
      return null;
    }

    const payment = await getTenantDb().payment.create({
      data: {
        salonId: input.salonId,
        appointmentId: input.appointmentId,
        customerId: input.customerId,
        provider: 'PAYFAST',
        status: 'PENDING',
        amountCents: input.amountCents,
        currency: 'ZAR',
        externalReference: reference,
        payfastMerchantRef: reference,
        metadata: {
          reference,
          provider: 'payfast',
          payfastForm: result.form,
        },
      },
    });

    return `${baseUrl}/pay/checkout/${payment.id}`;
  } catch (err) {
    logger.error(
      { err, salonId: input.salonId, appointmentId: input.appointmentId },
      'payment_checkout_create_failed',
    );
    return null;
  }
}

/** Same PayFast merchant + notify URL as salon bookings; reference is `retail_<orderId>`. */
export async function createRetailPaymentCheckoutSession(input: {
  salonId: string;
  customerId: string;
  orderId: string;
  amountCents: number;
  description: string;
}): Promise<string | null> {
  if (!isPayfastConfigured()) {
    logger.warn({ salonId: input.salonId, orderId: input.orderId }, 'payfast_not_configured_retail');
    return null;
  }
  if (input.amountCents <= 0) return null;

  const baseUrl = env.PUBLIC_BASE_URL ?? 'http://localhost:3000';
  const reference = retailOrderPaymentReference(input.orderId);

  try {
    const result = await payfastAdapter.createCheckout({
      salonId: input.salonId,
      customerId: input.customerId,
      amountCents: input.amountCents,
      currency: 'ZAR',
      reference,
      description: input.description.slice(0, 100),
      returnUrl: `${baseUrl}/pay/success?ref=${reference}`,
      cancelUrl: `${baseUrl}/pay/cancel?ref=${reference}`,
      notifyUrl: `${baseUrl}${PAYFAST_NOTIFY_PATH}`,
    });

    if (!result.form) {
      logger.error({ orderId: input.orderId }, 'payfast_retail_checkout_form_missing');
      return null;
    }

    const payment = await getTenantDb().payment.create({
      data: {
        salonId: input.salonId,
        customerId: input.customerId,
        provider: 'PAYFAST',
        status: 'PENDING',
        amountCents: input.amountCents,
        currency: 'ZAR',
        externalReference: reference,
        payfastMerchantRef: reference,
        metadata: {
          reference,
          provider: 'payfast',
          retailOrderId: input.orderId,
          payfastForm: result.form,
        },
      },
    });

    await getTenantDb().retailOrder.update({
      where: { id: input.orderId },
      data: { paymentId: payment.id },
    });

    return `${baseUrl}/pay/checkout/${payment.id}`;
  } catch (err) {
    logger.error(
      { err, salonId: input.salonId, orderId: input.orderId },
      'retail_payment_checkout_create_failed',
    );
    return null;
  }
}
/**
 * Marks the appointment paid, sends the WhatsApp confirmation, and schedules the
 * rating prompt — shared by the verified ITN webhook and (in sandbox only) the
 * /pay/success return-page fallback, since PayFast's sandbox ITN delivery to a
 * test environment is unreliable while the browser redirect always fires.
 */
export async function confirmAppointmentPaid(
  appointmentId: string,
  transactionId: string | null,
): Promise<boolean> {
  const ratingSchedule = await prisma.$transaction(async (tx) => {
    const appt = await tx.appointment.findUnique({
      where: { id: appointmentId },
      include: { service: true, staff: true, customer: true, salon: true },
    });
    if (!appt || appt.status === 'CONFIRMED_PAID') return null;

    await tx.payment.updateMany({
      where: { appointmentId, status: 'PENDING' },
      data: {
        status: 'SUCCEEDED',
        payfastPaymentId: transactionId,
      },
    });

    await tx.appointment.update({
      where: { id: appointmentId },
      data: { status: 'CONFIRMED_PAID', confirmedAt: new Date() },
    });

    const waId = appt.customer.waId;
    if (!waId) return null;

    const salonName = appt.salon.tradingName?.trim() || appt.salon.name;

    let conv = await tx.conversation.findUnique({
      where: { salonId_customerId: { salonId: appt.salonId, customerId: appt.customerId } },
    });

    if (!conv) {
      conv = await tx.conversation.create({
        data: {
          salonId: appt.salonId,
          customerId: appt.customerId,
          step: ConversationStep.IDLE,
        },
      });
    }

    const zone = appt.salon.timezone;
    const startDt = DateTime.fromJSDate(appt.start).setZone(zone);
    const endDt = DateTime.fromJSDate(appt.end).setZone(zone);
    const firstName = appt.customer.firstName?.trim();
    const ref = appt.id.slice(0, 8).toUpperCase();

    const automations = parseAutomationsFromMetadata(appt.salon.metadata);
    const customPolicy = automations.messaging.cancellationPolicyText.trim();
    const policyLine = customPolicy
      ? customPolicy
      : `Plans change — we get it. To reschedule or cancel, just reply *MENU* and tap *My Bookings*. A heads-up at least ${automations.cancellation.cancelHoursBefore} hours ahead lets us offer your slot to someone else. 🙏`;

    let confirmMsg = [
      firstName ? `🎉 *You're all set, ${sanitizeForMessage(firstName)}!*` : `🎉 *You're all set!*`,
      '',
      `Thank you — your payment came through and your spot is officially reserved. 💈`,
      '',
      `📋 *${sanitizeForMessage(appt.service.name)}*`,
      `👤 with ${sanitizeForMessage(appt.staff.name)}`,
      `📅 ${startDt.toFormat('cccc, d MMMM yyyy')}`,
      `🕐 ${startDt.toFormat('HH:mm')} – ${endDt.toFormat('HH:mm')}`,
      '',
      `🔖 Ref: *${ref}*`,
      '',
      policyLine,
      '',
      `We can't wait to see you at ${sanitizeForMessage(salonName)}! ✨`,
    ].join('\n');

    let confirmSid: string | null = null;
    try {
      const { result } = await sendWithFallback({ salonId: appt.salonId, to: waId, body: confirmMsg });
      confirmSid = result.providerMessageId ?? null;
    } catch { /* best-effort */ }

    const currentCtx = (conv.context ?? {}) as Record<string, unknown>;
    await tx.conversation.update({
      where: { id: conv.id },
      data: {
        context: {
          ...currentCtx,
          pendingAppointmentId: appointmentId,
          pendingPaymentCheckoutUrl: undefined,
          pendingPaymentAmountCents: undefined,
          awaitingCashConfirm: undefined,
        } as object,
      },
    });

    await tx.message.create({
      data: { conversationId: conv.id, customerId: appt.customerId, direction: MessageDirection.OUTBOUND, body: confirmMsg, providerSid: confirmSid },
    });

    return {
      conversationId: conv.id,
      salonId: appt.salonId,
      customerId: appt.customerId,
      waId,
      appointmentId,
      serviceId: appt.serviceId,
      staffId: appt.staffId,
      end: appt.end,
      pendingExtraBookings: (currentCtx.pendingExtraBookings as number | undefined) ?? 0,
    };
  });

  if (ratingSchedule) {
    await scheduleBookingRatingPrompt(ratingSchedule);
  }

  if (ratingSchedule && ratingSchedule.pendingExtraBookings > 0) {
    await startNextChainedBooking({
      salonId: ratingSchedule.salonId,
      customerId: ratingSchedule.customerId,
      serviceId: ratingSchedule.serviceId,
      staffId: ratingSchedule.staffId,
      afterStart: ratingSchedule.end,
      remaining: ratingSchedule.pendingExtraBookings,
    }).catch((err) =>
      logger.warn({ err, appointmentId: ratingSchedule.appointmentId }, 'chained_booking_start_failed'),
    );
  }

  const paidAppt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: { salonId: true, id: true },
  });
  if (paidAppt) {
    emitPlatformEvent({
      type: 'PAYMENT_SUCCEEDED',
      salonId: paidAppt.salonId,
      metadata: { appointmentId: paidAppt.id, reference: appointmentPaymentReference(appointmentId) },
    });
  }

  const confirmed = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: { id: true, salonId: true, start: true, status: true, salon: { select: { metadata: true, timezone: true } } },
  });
  if (confirmed) {
    notifyAppointmentChangedLater(confirmed.salonId, appointmentId, {
      status: confirmed.status,
      source: 'payfast',
    });
    void scheduleAppointmentReminders({
      id: confirmed.id,
      salonId: confirmed.salonId,
      start: confirmed.start,
      status: confirmed.status,
      salon: confirmed.salon,
    }).catch(() => undefined);
    void scheduleGoogleReviewForAppointment(confirmed.id).catch(() => undefined);
  }

  return Boolean(ratingSchedule || paidAppt);
}

/**
 * Marks a retail order paid, then pings shop + all drivers (first ACCEPT wins).
 * Shared by verified ITN and sandbox /pay/success fallback.
 */
export async function confirmRetailOrderPaid(
  orderId: string,
  transactionId: string | null,
): Promise<boolean> {
  const order = await prisma.retailOrder.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      customer: {
        select: { waId: true, displayName: true, firstName: true, lastName: true },
      },
      salon: { select: { id: true, metadata: true, tradingName: true, name: true } },
    },
  });
  if (!order || order.status === 'CANCELLED') return false;

  const alreadyPaid = order.status !== 'DRAFT' && order.status !== 'PENDING_PAYMENT';
  if (alreadyPaid) return true;

  const reference = retailOrderPaymentReference(orderId);
  await prisma.payment.updateMany({
    where: {
      status: 'PENDING',
      OR: [{ payfastMerchantRef: reference }, { externalReference: reference }],
    },
    data: {
      status: 'SUCCEEDED',
      payfastPaymentId: transactionId,
      paidAt: new Date(),
    },
  });

  const updated = await prisma.retailOrder.update({
    where: { id: orderId },
    data: { status: 'PAID' },
    include: {
      items: true,
      customer: {
        select: { waId: true, displayName: true, firstName: true, lastName: true },
      },
    },
  });

  const { decrementInventoryForOrder } = await import('./retailInventory.js');
  await decrementInventoryForOrder({
    salonId: updated.salonId,
    items: updated.items.map((it) => ({ serviceId: it.serviceId, quantity: it.quantity })),
  }).catch((err) => {
    logger.warn({ err, orderId }, 'retail_inventory_decrement_failed');
  });

  const { getRetailSettings, formatZarFromCents } = await import('../lib/retailSettings.js');
  const settings = getRetailSettings(order.salon.metadata);
  const ref = `#${orderId.slice(-6).toUpperCase()}`;
  const waId = updated.customer?.waId;
  if (waId) {
    const body =
      updated.fulfillment === 'DELIVERY'
        ? [
            `✅ *Payment received* for ${ref}`,
            `Total *${formatZarFromCents(updated.totalCents)}*`,
            '',
            `We've pinged every driver on WhatsApp. The *first to reply ACCEPT* takes your delivery.`,
            `ETA ~${settings.deliveryEtaMinutes} min once a rider is assigned.`,
            '',
            'Reply *MENU* anytime.',
          ].join('\n')
        : [
            `✅ *Payment received* for ${ref}`,
            `Total *${formatZarFromCents(updated.totalCents)}*`,
            '',
            `The shop is packing for collection — ready in ~${settings.collectionEtaMinutes} min.`,
            '',
            'Reply *MENU* anytime.',
          ].join('\n');

    try {
      await sendWithFallback({ salonId: updated.salonId, to: waId, body });
    } catch (err) {
      logger.warn({ err, orderId }, 'retail_paid_customer_notify_failed');
    }
  }

  const { notifyNewRetailOrderLater } = await import('./retailOrderNotify.js');
  notifyNewRetailOrderLater(updated);

  emitPlatformEvent({
    type: 'PAYMENT_SUCCEEDED',
    salonId: updated.salonId,
    metadata: { retailOrderId: orderId, reference, transactionId },
  });

  return true;
}

export async function handlePayfastAppointmentWebhook(body: Record<string, string>): Promise<void> {
  const verified = payfastAdapter.verifyWebhook(body, {});
  if (!verified.valid) {
    logger.warn({ reference: body.m_payment_id }, 'payfast_appointment_itn_invalid');
    return;
  }

  const parsed = parsePayfastMerchantReference(verified.reference);
  if (!parsed) return;

  if (verified.status !== 'success') {
    const payment = await prisma.payment.findFirst({
      where:
        parsed.kind === 'appointment'
          ? { appointmentId: parsed.id }
          : {
              OR: [
                { payfastMerchantRef: verified.reference },
                { externalReference: verified.reference },
              ],
            },
      orderBy: { createdAt: 'desc' },
    });
    if (payment) {
      await prisma.payment.updateMany({
        where: { id: payment.id, status: 'PENDING' },
        data: { status: 'FAILED', failureReason: verified.status ?? 'failed' },
      });
      emitPlatformEvent({
        type: 'PAYMENT_FAILED',
        salonId: payment.salonId,
        metadata: {
          ...(parsed.kind === 'appointment'
            ? { appointmentId: parsed.id }
            : { retailOrderId: parsed.id }),
          reference: verified.reference,
          status: verified.status,
        },
      });
    }
    return;
  }

  if (parsed.kind === 'retail') {
    await confirmRetailOrderPaid(parsed.id, verified.transactionId ?? null);
    return;
  }

  await confirmAppointmentPaid(parsed.id, verified.transactionId ?? null);
}

export async function refundPayfastPayment(input: {
  paymentId: string;
  salonId: string;
  actorUserId: string;
  reason: string;
}): Promise<void> {
  const payment = await prisma.payment.findFirst({
    where: { id: input.paymentId, salonId: input.salonId },
  });
  if (!payment) {
    const err = new Error('payment_not_found') as Error & { statusCode?: number };
    err.statusCode = 404;
    throw err;
  }
  if (!payment.payfastPaymentId) throw new Error('no_payfast_payment_id');

  await prisma.$transaction([
    prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'REFUNDED' },
    }),
    prisma.auditLog.create({
      data: {
        salonId: payment.salonId,
        actorUserId: input.actorUserId,
        action: 'payment_refund',
        entity: 'Payment',
        entityId: payment.id,
        payload: { reason: input.reason, provider: 'payfast' },
      },
    }),
  ]);
}

export const refundPaymentStaff = refundPayfastPayment;

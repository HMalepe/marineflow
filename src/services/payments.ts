import { prisma } from '../lib/prisma.js';
import { env } from '../config.js';
import { payfastAdapter } from '../lib/integrations/payments/payfast.js';
import { sendWithFallback } from './channelRouter.js';
import { scheduleAppointmentReminders } from './appointmentReminders.js';
import { notifyAppointmentChangedLater } from './rosterSync.js';
import { buildPopiaRightsHint, shouldAttachPopiaRightsHint } from './compliance.js';
import { MessageDirection, ConversationStep } from '@prisma/client';
import type { Service } from '@prisma/client';
import { DateTime } from 'luxon';

const PAYFAST_NOTIFY_PATH = '/webhooks/payfast/appointment';

function appointmentPaymentReference(appointmentId: string): string {
  return `appt_${appointmentId}`;
}

export async function createDepositCheckoutSession(input: {
  salonId: string;
  customerId: string;
  appointmentId: string;
  service: Service;
  mode: 'deposit' | 'full';
}): Promise<string | null> {
  if (!env.PAYFAST_MERCHANT_ID || !env.PAYFAST_MERCHANT_KEY) return null;

  const amountCents =
    input.mode === 'full'
      ? input.service.priceCents
      : (input.service.depositCents ?? input.service.priceCents);
  if (amountCents <= 0) return null;

  const baseUrl = env.PUBLIC_BASE_URL ?? 'http://localhost:3000';
  const reference = appointmentPaymentReference(input.appointmentId);

  const result = await payfastAdapter.createCheckout({
    salonId: input.salonId,
    customerId: input.customerId,
    amountCents,
    currency: 'ZAR',
    reference,
    description: `${input.service.name} (${input.mode})`,
    returnUrl: `${baseUrl}/pay/success?ref=${reference}`,
    cancelUrl: `${baseUrl}/pay/cancel?ref=${reference}`,
    notifyUrl: `${baseUrl}${PAYFAST_NOTIFY_PATH}`,
  });

  await prisma.payment.create({
    data: {
      salonId: input.salonId,
      appointmentId: input.appointmentId,
      customerId: input.customerId,
      status: 'PENDING',
      amountCents,
      currency: 'ZAR',
      metadata: { mode: input.mode, reference, provider: 'payfast' },
    },
  });

  return result.redirectUrl;
}

export async function handlePayfastAppointmentWebhook(body: Record<string, string>): Promise<void> {
  const verified = payfastAdapter.verifyWebhook(body, {});
  if (!verified.valid || verified.status !== 'success') return;

  const reference = verified.reference;
  if (!reference?.startsWith('appt_')) return;
  const appointmentId = reference.replace('appt_', '');

  await prisma.$transaction(async (tx) => {
    const appt = await tx.appointment.findUnique({
      where: { id: appointmentId },
      include: { service: true, staff: true, customer: true, salon: true },
    });
    if (!appt || appt.status === 'CONFIRMED_PAID') return;

    const priorSucceededPayments = await tx.payment.count({
      where: { customerId: appt.customerId, status: 'SUCCEEDED' },
    });

    await tx.payment.updateMany({
      where: { appointmentId, status: 'PENDING' },
      data: {
        status: 'SUCCEEDED',
        payfastPaymentId: verified.transactionId ?? null,
      },
    });

    await tx.appointment.update({
      where: { id: appointmentId },
      data: { status: 'CONFIRMED_PAID', confirmedAt: new Date() },
    });

    const waId = appt.customer.waId;
    if (!waId) return;

    const salonName = appt.salon.tradingName?.trim() || appt.salon.name;
    const tz = appt.salon.timezone;
    const dateStr = DateTime.fromJSDate(appt.start).setZone(tz).toFormat('cccc dd LLL yyyy HH:mm');

    const conv = await tx.conversation.findFirst({
      where: { salonId: appt.salonId, customerId: appt.customerId },
      orderBy: { updatedAt: 'desc' },
    });

    const convCtx = (conv?.context ?? {}) as Record<string, unknown>;
    const includePopiaHint = shouldAttachPopiaRightsHint({
      priorSucceededPayments,
      popiaRightsNotified: Boolean(convCtx.popiaRightsNotified),
    });

    let confirmMsg =
      `✅ Payment received! Your booking is confirmed.\n\n` +
      `${appt.service.name} with ${appt.staff.name}\n` +
      `${dateStr}\n\n` +
      `Reference: ${appointmentId.slice(0, 8)}\n\n` +
      `See you at ${salonName}! 💈`;
    if (includePopiaHint) {
      confirmMsg += `\n\n${buildPopiaRightsHint()}`;
    }

    const ratingMsg = `How was the booking process? Rate us 1–5 ⭐\n(1 = frustrating, 5 = super easy)`;

    // Send confirmation message
    let confirmSid: string | null = null;
    try {
      const { result } = await sendWithFallback({ salonId: appt.salonId, to: waId, body: confirmMsg });
      confirmSid = result.providerMessageId ?? null;
    } catch { /* best-effort */ }

    if (conv) {
      await tx.message.create({
        data: { conversationId: conv.id, customerId: appt.customerId, direction: MessageDirection.OUTBOUND, body: confirmMsg, providerSid: confirmSid },
      });

      // Send rating prompt and move to BOOKING_RATING
      let ratingSid: string | null = null;
      try {
        const { result } = await sendWithFallback({ salonId: appt.salonId, to: waId, body: ratingMsg });
        ratingSid = result.providerMessageId ?? null;
      } catch { /* best-effort */ }

      await tx.message.create({
        data: { conversationId: conv.id, customerId: appt.customerId, direction: MessageDirection.OUTBOUND, body: ratingMsg, providerSid: ratingSid },
      });

      const currentCtx = (conv.context ?? {}) as Record<string, unknown>;
      await tx.conversation.update({
        where: { id: conv.id },
        data: {
          step: ConversationStep.BOOKING_RATING,
          context: {
            ...currentCtx,
            pendingAppointmentId: appointmentId,
            ...(includePopiaHint ? { popiaRightsNotified: true } : {}),
          } as object,
        },
      });
    }
  });

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
  }
}

export async function refundPayfastPayment(input: {
  paymentId: string;
  actorUserId: string;
  reason: string;
}): Promise<void> {
  const payment = await prisma.payment.findUniqueOrThrow({ where: { id: input.paymentId } });
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

// Alias — keeps dashboardApi import working
export const refundPaymentStaff = refundPayfastPayment;

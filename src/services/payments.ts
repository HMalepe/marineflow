import { prisma } from '../lib/prisma.js';
import { getTenantDb } from '../lib/db/tenantSession.js';
import { logger } from '../lib/logger.js';
import { env } from '../config.js';
import { payfastAdapter } from '../lib/integrations/payments/payfast.js';
import { isPayfastConfigured } from '../lib/integrations/payments/index.js';
import { sendWithFallback } from './channelRouter.js';
import { emitPlatformEvent } from './platformEvents.js';
import { scheduleAppointmentReminders } from './appointmentReminders.js';
import { notifyAppointmentChangedLater } from './rosterSync.js';
import { buildPopiaRightsHint, shouldAttachPopiaRightsHint } from './compliance.js';
import { scheduleBookingRatingPrompt } from '../lib/inngest/functions/bookingRatingPrompt.js';
import { MessageDirection } from '@prisma/client';
import type { Service } from '@prisma/client';

const PAYFAST_NOTIFY_PATH = '/webhooks/payfast/appointment';

function appointmentPaymentReference(appointmentId: string): string {
  return `appt_${appointmentId}`;
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
export async function handlePayfastAppointmentWebhook(body: Record<string, string>): Promise<void> {
  const verified = payfastAdapter.verifyWebhook(body, {});
  if (!verified.valid) return;

  const reference = verified.reference;
  if (!reference?.startsWith('appt_')) return;
  const appointmentId = reference.replace('appt_', '');

  if (verified.status !== 'success') {
    const payment = await prisma.payment.findFirst({
      where: { appointmentId },
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
        metadata: { appointmentId, reference, status: verified.status },
      });
    }
    return;
  }

  const ratingSchedule = await prisma.$transaction(async (tx) => {
    const appt = await tx.appointment.findUnique({
      where: { id: appointmentId },
      include: { service: true, staff: true, customer: true, salon: true },
    });
    if (!appt || appt.status === 'CONFIRMED_PAID') return null;

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
    if (!waId) return null;

    const salonName = appt.salon.tradingName?.trim() || appt.salon.name;

    const conv = await tx.conversation.findFirst({
      where: { salonId: appt.salonId, customerId: appt.customerId },
      orderBy: { updatedAt: 'desc' },
    });

    const convCtx = (conv?.context ?? {}) as Record<string, unknown>;
    const includePopiaHint = shouldAttachPopiaRightsHint({
      priorSucceededPayments,
      popiaRightsNotified: Boolean(convCtx.popiaRightsNotified),
    });

    let confirmMsg = `✅ *Payment received!*\n\nYour booking is paid and confirmed. See you at ${salonName}! 💈`;
    if (includePopiaHint) {
      confirmMsg += `\n\n${buildPopiaRightsHint()}`;
    }

    let confirmSid: string | null = null;
    try {
      const { result } = await sendWithFallback({ salonId: appt.salonId, to: waId, body: confirmMsg });
      confirmSid = result.providerMessageId ?? null;
    } catch { /* best-effort */ }

    if (!conv) return null;

    await tx.message.create({
      data: { conversationId: conv.id, customerId: appt.customerId, direction: MessageDirection.OUTBOUND, body: confirmMsg, providerSid: confirmSid },
    });

    if (includePopiaHint) {
      const currentCtx = (conv.context ?? {}) as Record<string, unknown>;
      await tx.conversation.update({
        where: { id: conv.id },
        data: { context: { ...currentCtx, popiaRightsNotified: true } as object },
      });
    }

    return { conversationId: conv.id, salonId: appt.salonId, customerId: appt.customerId, waId, appointmentId };
  });

  if (ratingSchedule) {
    await scheduleBookingRatingPrompt(ratingSchedule);
  }

  const paidAppt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: { salonId: true, id: true },
  });
  if (paidAppt) {
    emitPlatformEvent({
      type: 'PAYMENT_SUCCEEDED',
      salonId: paidAppt.salonId,
      metadata: { appointmentId: paidAppt.id, reference },
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

export const refundPaymentStaff = refundPayfastPayment;

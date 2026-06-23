import type { PrismaTx } from '../../lib/db/tenantSession.js';
import { env } from '../../config.js';
import { formatZaWhatsAppPhone } from '../../lib/twilio.js';
import { buildManualPaymentLinkBody, buildPaymentCheckoutCta } from '../../lib/paymentPromptCopy.js';
import { sendWithFallback } from '../../services/channelRouter.js';
import { createPaymentCheckoutSession } from '../../services/payments.js';

function checkoutUrl(paymentId: string): string {
  const baseUrl = env.PUBLIC_BASE_URL ?? 'http://localhost:3000';
  return `${baseUrl}/pay/checkout/${paymentId}`;
}
export type SendPaymentLinkResult =
  | { ok: true; phone: string; paymentLinkSentAt: string; checkoutUrl: string }
  | { ok: false; error: string; message?: string };

/** Resend stored PayFast checkout link to customer via WhatsApp. */
export async function sendAppointmentPaymentLink(
  db: PrismaTx,
  input: { salonId: string; appointmentId: string; actorUserId: string },
): Promise<SendPaymentLinkResult> {
  const appt = await db.appointment.findFirst({
    where: { id: input.appointmentId, salonId: input.salonId },
    include: {
      service: true,
      customer: { select: { waId: true, displayName: true, firstName: true } },
      salon: { select: { name: true, tradingName: true, twilioWhatsAppNumber: true } },
      payments: {
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!appt) {
    return { ok: false, error: 'not_found', message: 'Appointment not found' };
  }

  if (appt.status !== 'PENDING_PAYMENT') {
    return {
      ok: false,
      error: 'invalid_status',
      message: 'Payment link can only be sent for pending-payment bookings',
    };
  }

  const waId = appt.customer.waId?.trim();
  if (!waId || waId.startsWith('erased_')) {
    return { ok: false, error: 'no_phone', message: 'Customer has no WhatsApp number on file' };
  }

  let pendingPayment = appt.payments[0] ?? null;
  let link: string | null = pendingPayment ? checkoutUrl(pendingPayment.id) : null;

  if (!link) {
    link = await createPaymentCheckoutSession({
      salonId: appt.salonId,
      customerId: appt.customerId,
      appointmentId: appt.id,
      service: appt.service,
      amountCents: appt.service.priceCents,
    });
    if (!link) {
      return {
        ok: false,
        error: 'link_unavailable',
        message: 'Could not find or create a payment link for this booking',
      };
    }
  }

  const amountCents = pendingPayment?.amountCents ?? appt.service.priceCents;
  const body = buildManualPaymentLinkBody({
    salonName: appt.salon.tradingName?.trim() || appt.salon.name,
    serviceName: appt.service.name,
    amountCents,
  });
  const cta = buildPaymentCheckoutCta(body, link);

  const { result } = await sendWithFallback({
    salonId: input.salonId,
    to: waId,
    body,
    interactive: cta,
  });
  const sid = result.providerMessageId ?? null;

  if (!sid) {
    return {
      ok: false,
      error: 'send_failed',
      message: 'Could not send WhatsApp message — check Twilio configuration',
    };
  }

  const sentAt = new Date();
  await db.appointment.update({
    where: { id: appt.id },
    data: { paymentLinkSentAt: sentAt },
  });

  await db.auditLog.create({
    data: {
      salonId: input.salonId,
      actorUserId: input.actorUserId,
      action: 'payment_link_sent',
      entity: 'Appointment',
      entityId: appt.id,
      payload: { channel: 'whatsapp', checkoutUrl: link },
    },
  });

  return {
    ok: true,
    phone: formatZaWhatsAppPhone(waId),
    paymentLinkSentAt: sentAt.toISOString(),
    checkoutUrl: link,
  };
}

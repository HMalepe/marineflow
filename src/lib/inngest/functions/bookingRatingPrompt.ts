import { ConversationStep, MessageDirection } from '@prisma/client';
import { inngest } from '../client.js';
import { prisma } from '../../prisma.js';
import { sendWithFallback } from '../../../services/channelRouter.js';
import { logger } from '../../logger.js';
import {
  buildBookingRatingBody,
  buildBookingRatingInteractive,
} from '../../../services/botInteractiveMenus.js';

/** Wait after payment confirmation before the rating prompt — avoids WhatsApp dropping back-to-back messages. */
export const BOOKING_RATING_DELAY = '25s';

export type BookingRatingPromptEvent = {
  data: {
    conversationId: string;
    salonId: string;
    customerId: string;
    waId: string;
    appointmentId: string;
  };
};

async function withJobTenant<T>(salonId: string, fn: () => Promise<T>): Promise<T> {
  await prisma.$executeRawUnsafe(`SELECT set_config('app.current_tenant', $1, true)`, salonId);
  return fn();
}

/** Send the booking-process rating prompt (interactive list). */
export async function sendBookingRatingPromptNow(input: BookingRatingPromptEvent['data']): Promise<void> {
  const { conversationId, salonId, customerId, waId, appointmentId } = input;
  await withJobTenant(salonId, async () => {
    let conv = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { salon: true },
    });
    if (!conv) {
      conv = await prisma.conversation.findUnique({
        where: { salonId_customerId: { salonId, customerId } },
        include: { salon: true },
      });
    }
    if (!conv) {
      conv = await prisma.conversation.create({
        data: { salonId, customerId, step: ConversationStep.IDLE },
        include: { salon: true },
      });
    }
    if (conv.step === ConversationStep.HANDOFF || conv.step === ConversationStep.CLOSED) return;
    if (conv.step === ConversationStep.BOOKING_RATING) return;

    const body = buildBookingRatingBody();
    const interactive = buildBookingRatingInteractive(conv.salon);

    let providerSid: string | null = null;
    try {
      const { result } = await sendWithFallback({
        salonId,
        to: waId,
        body,
        interactive,
      });
      providerSid = result.providerMessageId ?? null;
    } catch (err) {
      logger.warn({ err, conversationId: conv.id, appointmentId }, 'booking_rating_send_failed');
      return;
    }

    await prisma.message.create({
      data: {
        conversationId: conv.id,
        customerId,
        direction: MessageDirection.OUTBOUND,
        body,
        providerSid,
      },
    });

    const currentCtx = (conv.context ?? {}) as Record<string, unknown>;
    await prisma.conversation.update({
      where: { id: conv.id },
      data: {
        step: ConversationStep.BOOKING_RATING,
        context: {
          ...currentCtx,
          pendingAppointmentId: appointmentId,
          pendingPaymentCheckoutUrl: undefined,
          pendingPaymentAmountCents: undefined,
          awaitingCashConfirm: undefined,
        } as object,
        lastMessageAt: new Date(),
      },
    });
  });
}

export const bookingRatingPrompt = inngest.createFunction(
  {
    id: 'booking-rating-prompt',
    triggers: [{ event: 'whatsapp/booking.rating.requested' }],
  },
  async ({ event, step }) => {
    const data = event.data as BookingRatingPromptEvent['data'];
    await step.sleep('wait-after-payment-confirmation', BOOKING_RATING_DELAY);
    await step.run('send-rating-prompt', () => sendBookingRatingPromptNow(data));
  },
);

export async function scheduleBookingRatingPrompt(input: {
  conversationId: string;
  salonId: string;
  customerId: string;
  waId: string;
  appointmentId: string;
}): Promise<void> {
  try {
    await inngest.send({
      name: 'whatsapp/booking.rating.requested',
      data: input,
    });
  } catch (err) {
    logger.warn({ err, conversationId: input.conversationId }, 'booking_rating_inngest_failed');
    // Fallback when Inngest is unavailable (e.g. local dev without dev server).
    setTimeout(() => {
      void sendBookingRatingPromptNow(input).catch((sendErr) => {
        logger.warn({ err: sendErr, conversationId: input.conversationId }, 'booking_rating_fallback_failed');
      });
    }, 25_000);
  }
}

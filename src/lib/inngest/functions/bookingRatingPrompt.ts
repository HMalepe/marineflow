import { ConversationStep, MessageDirection } from '@prisma/client';
import { inngest } from '../client.js';
import { prisma } from '../../prisma.js';
import { sendWithFallback } from '../../../services/channelRouter.js';
import { logger } from '../../logger.js';
import {
  buildBookingRatingBody,
  buildBookingRatingInteractive,
} from '../../../services/botInteractiveMenus.js';

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

/** Send the booking-process rating prompt immediately (interactive list). */
export async function sendBookingRatingPromptNow(input: BookingRatingPromptEvent['data']): Promise<void> {
  const { conversationId, salonId, customerId, waId, appointmentId } = input;
  await withJobTenant(salonId, async () => {
    const conv = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { salon: true },
    });
    if (!conv) return;
    if (conv.step === ConversationStep.HANDOFF || conv.step === ConversationStep.CLOSED) return;
    // Already collecting a rating from the live booking flow — avoid a duplicate prompt.
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
    } catch {
      /* best-effort */
    }

    await prisma.message.create({
      data: {
        conversationId,
        customerId,
        direction: MessageDirection.OUTBOUND,
        body,
        providerSid,
      },
    });

    const currentCtx = (conv.context ?? {}) as Record<string, unknown>;
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        step: ConversationStep.BOOKING_RATING,
        context: { ...currentCtx, pendingAppointmentId: appointmentId } as object,
      },
    });
  });
}

/** @deprecated Kept for in-flight Inngest events — now sends immediately with no delay. */
export const bookingRatingPrompt = inngest.createFunction(
  {
    id: 'booking-rating-prompt',
    triggers: [{ event: 'whatsapp/booking.rating.requested' }],
  },
  async ({ event, step }) => {
    const data = event.data as BookingRatingPromptEvent['data'];
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
    await sendBookingRatingPromptNow(input);
  } catch (err) {
    logger.warn({ err, conversationId: input.conversationId }, 'booking_rating_prompt_failed');
  }
}

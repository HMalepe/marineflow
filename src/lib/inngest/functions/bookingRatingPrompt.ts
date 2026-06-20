import { ConversationStep, MessageDirection } from '@prisma/client';
import { inngest } from '../client.js';
import { prisma } from '../../prisma.js';
import { sendWithFallback } from '../../../services/channelRouter.js';
import { logger } from '../../logger.js';
import { env } from '../../../config.js';

const BOOKING_RATING_PROMPT =
  'How was the booking process? Reply 1–5 ⭐ (1 = frustrating, 5 = super easy)\nOr reply *SKIP* to go to the menu.';

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

async function sendBookingRatingPromptNow(input: BookingRatingPromptEvent['data']): Promise<void> {
  const { conversationId, salonId, customerId, waId, appointmentId } = input;
  await withJobTenant(salonId, async () => {
    const conv = await prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conv) return;
    if (conv.step === ConversationStep.HANDOFF || conv.step === ConversationStep.CLOSED) return;

    let providerSid: string | null = null;
    try {
      const { result } = await sendWithFallback({ salonId, to: waId, body: BOOKING_RATING_PROMPT });
      providerSid = result.providerMessageId ?? null;
    } catch { /* best-effort */ }

    await prisma.message.create({
      data: {
        conversationId,
        customerId,
        direction: MessageDirection.OUTBOUND,
        body: BOOKING_RATING_PROMPT,
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

export const bookingRatingPrompt = inngest.createFunction(
  {
    id: 'booking-rating-prompt',
    triggers: [{ event: 'whatsapp/booking.rating.requested' }],
  },
  async ({ event, step }) => {
    const data = event.data as BookingRatingPromptEvent['data'];

    // Randomised 2-5 minute delay, computed once so retries stay deterministic.
    const delayMin = await step.run('pick-delay', () => 2 + Math.floor(Math.random() * 4));
    await step.sleep('wait-before-prompt', `${delayMin}m`);

    await step.run('send-rating-prompt', () => sendBookingRatingPromptNow(data));
  },
);

/**
 * In-process fallback used while testing against PayFast's sandbox, where Inngest
 * Cloud may not be synced/reachable yet. Same randomised 2-5 minute delay as the
 * Inngest function, but runs directly in this process instead of via the queue.
 */
function scheduleBookingRatingPromptDirect(input: BookingRatingPromptEvent['data']): void {
  const delayMin = 2 + Math.floor(Math.random() * 4);
  setTimeout(() => {
    sendBookingRatingPromptNow(input).catch((err) =>
      logger.warn({ err, conversationId: input.conversationId }, 'booking_rating_prompt_direct_failed'),
    );
  }, delayMin * 60_000);
}

export async function scheduleBookingRatingPrompt(input: {
  conversationId: string;
  salonId: string;
  customerId: string;
  waId: string;
  appointmentId: string;
}): Promise<void> {
  if (env.PAYFAST_IS_TEST) {
    scheduleBookingRatingPromptDirect(input);
    return;
  }
  try {
    await inngest.send({
      name: 'whatsapp/booking.rating.requested',
      data: input,
    });
  } catch (err) {
    logger.warn({ err, conversationId: input.conversationId }, 'booking_rating_prompt_schedule_failed');
  }
}

import { ConversationStep, MessageDirection } from '@prisma/client';
import { inngest } from '../client.js';
import { prisma } from '../../prisma.js';
import { sendWithFallback } from '../../../services/channelRouter.js';
import { logger } from '../../logger.js';

export type ConversationActivityEvent = {
  data: {
    conversationId: string;
    salonId: string;
    customerWaId: string;
    activityAt: string;
  };
};

async function withJobTenant<T>(salonId: string, fn: () => Promise<T>): Promise<T> {
  await prisma.$executeRawUnsafe(`SELECT set_config('app.current_tenant', $1, true)`, salonId);
  return fn();
}

async function hasInboundSince(conversationId: string, activityAt: string): Promise<boolean> {
  const newer = await prisma.message.findFirst({
    where: {
      conversationId,
      direction: MessageDirection.INBOUND,
      createdAt: { gt: new Date(activityAt) },
    },
    select: { id: true },
  });
  return newer !== null;
}

function buildMainMenu(salon: { name: string; welcomeMessage: string | null }): string {
  const welcome =
    salon.welcomeMessage?.trim() ||
    `Welcome to ${salon.name}! Reply with a number:`;
  return [
    welcome,
    '1 — Book an appointment',
    '2 — My bookings',
    '3 — My rewards / loyalty',
    '4 — FAQs',
    '5 — File a complaint',
    '6 — Hours & address',
    '0 — Talk to a human (we will reply soon)',
  ].join('\n');
}

export const conversationInactivity = inngest.createFunction(
  {
    id: 'conversation-inactivity',
    cancelOn: [{ event: 'whatsapp/conversation.activity', match: 'data.conversationId' }],
    triggers: [{ event: 'whatsapp/conversation.activity' }],
  },
  async ({ event, step }) => {
    const { conversationId, salonId, customerWaId, activityAt } =
      event.data as ConversationActivityEvent['data'];

    await step.sleep('wait-5m', '5m');

    await step.run('nudge-if-idle-5m', async () =>
      withJobTenant(salonId, async () => {
        const conv = await prisma.conversation.findUnique({ where: { id: conversationId } });
        if (!conv) return;
        if (conv.step === ConversationStep.HANDOFF || conv.step === ConversationStep.CLOSED) return;
        if (await hasInboundSince(conversationId, activityAt)) return;

        const body = `Hi — are you still there? Just reply when you're ready, or type BACK for the main menu.`;
        await sendWithFallback({ salonId, to: customerWaId, body });
        await prisma.message.create({
          data: {
            conversationId,
            customerId: conv.customerId,
            direction: MessageDirection.OUTBOUND,
            body,
          },
        });
      }),
    );

    await step.sleep('wait-25m', '25m');

    await step.run('reset-menu-if-idle-30m', async () =>
      withJobTenant(salonId, async () => {
        const conv = await prisma.conversation.findUnique({
          where: { id: conversationId },
          include: { salon: true },
        });
        if (!conv) return;
        if (conv.step === ConversationStep.HANDOFF || conv.step === ConversationStep.CLOSED) return;
        if (await hasInboundSince(conversationId, activityAt)) return;

        const menu = buildMainMenu(conv.salon);
        const body = `I'll take you back to the main menu — pick up whenever you're ready.\n\n${menu}`;

        await prisma.conversation.update({
          where: { id: conversationId },
          data: { step: ConversationStep.MENU, context: {}, lastMessageAt: new Date() },
        });

        await sendWithFallback({ salonId, to: customerWaId, body });
        await prisma.message.create({
          data: {
            conversationId,
            customerId: conv.customerId,
            direction: MessageDirection.OUTBOUND,
            body,
          },
        });
      }),
    );
  },
);

export async function scheduleConversationActivity(input: {
  conversationId: string;
  salonId: string;
  customerWaId: string;
  activityAt: string;
}): Promise<void> {
  try {
    await inngest.send({
      name: 'whatsapp/conversation.activity',
      data: input,
    });
  } catch (err) {
    logger.warn({ err, conversationId: input.conversationId }, 'inactivity_schedule_failed');
  }
}

import { ConversationStep, MessageDirection } from '@prisma/client';
import { inngest } from '../client.js';
import { prisma } from '../../prisma.js';
import { buildMainMenuText } from '../../hierarchicalMenu.js';
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

async function sendAndRecord(opts: {
  conversationId: string;
  customerId: string;
  salonId: string;
  to: string;
  body: string;
}) {
  await sendWithFallback({ salonId: opts.salonId, to: opts.to, body: opts.body });
  await prisma.message.create({
    data: {
      conversationId: opts.conversationId,
      customerId: opts.customerId,
      direction: MessageDirection.OUTBOUND,
      body: opts.body,
    },
  });
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

    // Load salon to get owner-configured delays and messages
    const salon = await step.run('load-salon', () =>
      withJobTenant(salonId, () =>
        prisma.salon.findUniqueOrThrow({
          where: { id: salonId },
          select: {
            name: true,
            tradingName: true,
            welcomeMessage: true,
            botLoyaltyEnabled: true,
            inactivityMessage1: true,
            inactivityMessage1DelayMin: true,
            inactivityMessage2: true,
            inactivityMessage2DelayMin: true,
          },
        }),
      ),
    );

    const delay1Min = salon.inactivityMessage1DelayMin ?? 10;
    const delay2Min = salon.inactivityMessage2DelayMin ?? 30;

    // First follow-up
    await step.sleep('wait-followup-1', `${delay1Min}m`);

    await step.run('followup-1', async () =>
      withJobTenant(salonId, async () => {
        const conv = await prisma.conversation.findUnique({ where: { id: conversationId } });
        if (!conv) return;
        if (conv.step === ConversationStep.HANDOFF || conv.step === ConversationStep.CLOSED) return;
        if (await hasInboundSince(conversationId, activityAt)) return;

        const body =
          salon.inactivityMessage1?.trim() ||
          `Hi — still there? Just reply when you're ready, or type BACK for the main menu 😊`;

        await sendAndRecord({ conversationId, customerId: conv.customerId, salonId, to: customerWaId, body });
      }),
    );

    // Second follow-up (waits the *additional* time beyond the first)
    const additionalWait = Math.max(1, delay2Min - delay1Min);
    await step.sleep('wait-followup-2', `${additionalWait}m`);

    await step.run('followup-2-and-reset', async () =>
      withJobTenant(salonId, async () => {
        const conv = await prisma.conversation.findUnique({ where: { id: conversationId } });
        if (!conv) return;
        if (conv.step === ConversationStep.HANDOFF || conv.step === ConversationStep.CLOSED) return;
        if (await hasInboundSince(conversationId, activityAt)) return;

        const salonRow = await prisma.salon.findUniqueOrThrow({
          where: { id: salonId },
          select: {
            name: true,
            tradingName: true,
            welcomeMessage: true,
            metadata: true,
          },
        });

        const menu = buildMainMenuText(salonRow);

        const nudge =
          salon.inactivityMessage2?.trim() ||
          `No worries — we'll be here whenever you're ready 💚`;
        const body = `${nudge}\n\nI'll take you back to the main menu:\n\n${menu}`;

        await prisma.conversation.update({
          where: { id: conversationId },
          data: { step: ConversationStep.MENU, context: {}, lastMessageAt: new Date() },
        });

        await sendAndRecord({ conversationId, customerId: conv.customerId, salonId, to: customerWaId, body });
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

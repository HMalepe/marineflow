import { ConversationStep, MessageDirection } from '@prisma/client';
import { inngest } from '../client.js';
import { prisma } from '../../prisma.js';
import { sendWithFallback } from '../../../services/channelRouter.js';
import { buildInactivityReminderInteractive } from '../../../services/botInteractiveMenus.js';
import type { InteractiveMessage } from '../../integrations/messaging/types.js';
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
  interactive?: InteractiveMessage;
}) {
  await sendWithFallback({ salonId: opts.salonId, to: opts.to, body: opts.body, interactive: opts.interactive });
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

    // Load salon to get owner-configured delay/message + customer's first name for personalisation
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
          },
        }),
      ),
    );

    // Single reminder — defaults to 15 minutes of inactivity.
    const delayMin = salon.inactivityMessage1DelayMin ?? 15;
    await step.sleep('wait-reminder', `${delayMin}m`);

    await step.run('send-reminder', async () =>
      withJobTenant(salonId, async () => {
        const conv = await prisma.conversation.findUnique({
          where: { id: conversationId },
          include: { customer: { select: { firstName: true } } },
        });
        if (!conv) return;
        if (conv.step === ConversationStep.HANDOFF || conv.step === ConversationStep.CLOSED) return;
        if (await hasInboundSince(conversationId, activityAt)) return;

        const firstName = conv.customer.firstName?.trim();
        const body =
          salon.inactivityMessage1?.trim() ||
          (firstName
            ? `Hey *${firstName}*, still there? No rush — just tap below when you're ready to carry on 😊`
            : `Hi — still there? No rush — just tap below when you're ready to carry on 😊`);

        await sendAndRecord({
          conversationId,
          customerId: conv.customerId,
          salonId,
          to: customerWaId,
          body,
          interactive: buildInactivityReminderInteractive(salon, body),
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

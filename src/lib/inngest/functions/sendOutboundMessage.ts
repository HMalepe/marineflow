import { inngest } from '../client.js';
import { prisma } from '../../prisma.js';
import { messaging } from '../../integrations/messaging/index.js';
import type { SendOptions } from '../../integrations/messaging/types.js';

export type OutboundMessageEvent = {
  data: {
    messageId: string;
    salonId: string;
    to: string;
    body: string;
    phoneNumberId?: string;
    idempotencyKey?: string;
  };
};

async function withJobTenant<T>(salonId: string, fn: () => Promise<T>): Promise<T> {
  await prisma.$executeRawUnsafe(`SELECT set_config('app.current_tenant', $1, true)`, salonId);
  return fn();
}

export const sendOutboundMessage = inngest.createFunction(
  {
    id: 'send-outbound-message',
    retries: 3,
    concurrency: [{ limit: 50 }],
    triggers: [{ event: 'message/send.outbound' }],
  },
  async ({ event, step }) => {
    const { messageId, salonId, to, body, phoneNumberId, idempotencyKey } = event.data as OutboundMessageEvent['data'];

    await step.run('mark-queued', async () => {
      await withJobTenant(salonId, () =>
        prisma.message.update({
          where: { id: messageId },
          data: { status: 'QUEUED' },
        }),
      );
    });

    const result = await step.run('send-via-provider', async () => {
      const opts: SendOptions = { to, body, phoneNumberId, idempotencyKey };
      return messaging.sendText(opts);
    });

    await step.run('mark-sent', async () => {
      await withJobTenant(salonId, () =>
        prisma.message.update({
          where: { id: messageId },
          data: {
            status: 'SENT',
            providerSid: result.providerMessageId,
          },
        }),
      );
    });

    return { messageId, providerMessageId: result.providerMessageId };
  },
);

export const sendOutboundMessageFailure = inngest.createFunction(
  {
    id: 'send-outbound-message-failure',
    triggers: [{ event: 'inngest/function.failed' }],
  },
  async ({ event }) => {
    const originalEvent = (event.data as { event?: { name?: string; data?: OutboundMessageEvent['data'] } })?.event;
    if (originalEvent?.name !== 'message/send.outbound') return;
    const { messageId, salonId } = originalEvent.data!;
    await prisma.$executeRawUnsafe(`SELECT set_config('app.current_tenant', $1, true)`, salonId);
    await prisma.message.update({
      where: { id: messageId },
      data: { status: 'FAILED' },
    });
  },
);

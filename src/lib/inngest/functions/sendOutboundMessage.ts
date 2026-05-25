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

export const sendOutboundMessage = inngest.createFunction(
  {
    id: 'send-outbound-message',
    retries: 3,
    concurrency: [{ limit: 50 }],
    triggers: [{ event: 'message/send.outbound' }],
  },
  async ({ event, step }) => {
    const { messageId, to, body, phoneNumberId, idempotencyKey } = event.data as OutboundMessageEvent['data'];

    await step.run('mark-queued', async () => {
      await prisma.message.update({
        where: { id: messageId },
        data: { status: 'QUEUED' },
      });
    });

    const result = await step.run('send-via-provider', async () => {
      const opts: SendOptions = { to, body, phoneNumberId, idempotencyKey };
      return messaging.sendText(opts);
    });

    await step.run('mark-sent', async () => {
      await prisma.message.update({
        where: { id: messageId },
        data: {
          status: 'SENT',
          providerSid: result.providerMessageId,
        },
      });
    });

    return { messageId, providerMessageId: result.providerMessageId };
  },
);

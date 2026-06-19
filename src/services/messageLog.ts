import type { MessageDirection, MessageLogStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

export type MessageLogInput = {
  salonId?: string | null;
  faqId?: string | null;
  direction: MessageDirection;
  status: MessageLogStatus;
};

/** Fire-and-forget bot delivery log — never blocks webhooks or sends. */
export function logMessageLog(input: MessageLogInput): void {
  void prisma.messageLog
    .create({
      data: {
        salonId: input.salonId ?? null,
        faqId: input.faqId ?? null,
        direction: input.direction,
        status: input.status,
      },
    })
    .catch((err) => {
      logger.warn({ err, direction: input.direction, status: input.status }, 'message_log_write_failed');
    });
}

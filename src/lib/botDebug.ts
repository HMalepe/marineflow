import { env } from '../config.js';
import { Prisma } from '@prisma/client';

/** True only in non-production when BOT_DEBUG=true. */
export const BOT_DEBUG = env.NODE_ENV !== 'production' && process.env.BOT_DEBUG === 'true';

if (BOT_DEBUG) {
  console.warn(
    '[BOT] BOT_DEBUG=true — raw errors are sent to customers via WhatsApp. Disable before production deploy.',
  );
}

export function debugMsg(label: string, err: unknown, extra?: Record<string, unknown>): string {
  const msg = err instanceof Error ? err.message : String(err);
  const code =
    err instanceof Prisma.PrismaClientKnownRequestError ? ` [Prisma ${err.code}]` : '';
  const stack =
    err instanceof Error && err.stack
      ? '\n' + err.stack.split('\n').slice(1, 4).join('\n')
      : '';
  const extraStr = extra ? '\n' + JSON.stringify(extra, null, 2) : '';
  return `🛠 *[BOT DEBUG — ${label}]*\n${msg}${code}${stack}${extraStr}`;
}

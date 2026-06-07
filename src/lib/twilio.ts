import twilio from 'twilio';
import { env, isTwilioAccountConfigured } from '../config.js';
import { logger } from './logger.js';

let client: ReturnType<typeof twilio> | null = null;

/** Twilio REST client (account SID + auth token only). */
export function getTwilioAccountClient(): ReturnType<typeof twilio> | null {
  if (!isTwilioAccountConfigured()) return null;
  if (!client) {
    client = twilio(env.TWILIO_ACCOUNT_SID!, env.TWILIO_AUTH_TOKEN!);
  }
  return client;
}

/** @deprecated Prefer getTwilioAccountClient — same client, clearer name. */
export function getTwilioClient(): ReturnType<typeof twilio> | null {
  return getTwilioAccountClient();
}

export async function sendWhatsAppReply(toWaId: string, body: string): Promise<string | null> {
  const tw = getTwilioClient();
  if (!tw || !env.TWILIO_WHATSAPP_FROM) {
    logger.error({ hasClient: !!tw, hasFrom: !!env.TWILIO_WHATSAPP_FROM }, 'twilio_send_aborted_no_config');
    return null;
  }
  // Twilio WhatsApp requires E.164 with leading +: whatsapp:+27XXXXXXXXX
  // normalizeWaId strips the +, so we must add it back here.
  const toDigits = toWaId.replace(/^whatsapp:/i, '').replace(/^\+/, '');
  const to = `whatsapp:+${toDigits}`;
  const from = env.TWILIO_WHATSAPP_FROM.startsWith('whatsapp:')
    ? env.TWILIO_WHATSAPP_FROM
    : `whatsapp:+${env.TWILIO_WHATSAPP_FROM.replace(/^\+/, '')}`;
  try {
    const msg = await tw.messages.create({ from, to, body });
    logger.info({ sid: msg.sid, to, from }, 'twilio_message_sent');
    return msg.sid;
  } catch (err: unknown) {
    // Log and return null — do NOT re-throw. Re-throwing here rolls back the
    // entire withTenantContext Prisma transaction, losing the inbound message record.
    logger.error({ err, to, from }, 'twilio_send_failed');
    return null;
  }
}

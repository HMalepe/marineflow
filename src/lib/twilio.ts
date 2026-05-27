import twilio from 'twilio';
import { env, isTwilioConfigured } from '../config.js';
import { logger } from './logger.js';

let client: ReturnType<typeof twilio> | null = null;

export function getTwilioClient(): ReturnType<typeof twilio> | null {
  if (!isTwilioConfigured()) return null;
  if (!client) {
    client = twilio(env.TWILIO_ACCOUNT_SID!, env.TWILIO_AUTH_TOKEN!);
  }
  return client;
}

export async function sendWhatsAppReply(toWaId: string, body: string): Promise<string | null> {
  const tw = getTwilioClient();
  if (!tw || !env.TWILIO_WHATSAPP_FROM) {
    logger.error({ hasClient: !!tw, hasFrom: !!env.TWILIO_WHATSAPP_FROM }, 'twilio_send_aborted_no_config');
    return null;
  }
  const to = toWaId.startsWith('whatsapp:') ? toWaId : `whatsapp:${toWaId}`;
  // Twilio requires "whatsapp:+XXXX" format for the from number
  const from = env.TWILIO_WHATSAPP_FROM.startsWith('whatsapp:')
    ? env.TWILIO_WHATSAPP_FROM
    : `whatsapp:${env.TWILIO_WHATSAPP_FROM}`;
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

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

export async function sendWhatsAppReply(
  toWaId: string,
  body: string,
  mediaUrl?: string,
): Promise<string | null> {
  const tw = getTwilioClient();
  if (!tw || !env.TWILIO_WHATSAPP_FROM) {
    logger.error({ hasClient: !!tw, hasFrom: !!env.TWILIO_WHATSAPP_FROM }, 'twilio_send_aborted_no_config');
    return null;
  }
  const toDigits = toWaId.replace(/^whatsapp:/i, '').replace(/^\+/, '');
  const to = `whatsapp:+${toDigits}`;
  const from = env.TWILIO_WHATSAPP_FROM.startsWith('whatsapp:')
    ? env.TWILIO_WHATSAPP_FROM
    : `whatsapp:+${env.TWILIO_WHATSAPP_FROM.replace(/^\+/, '')}`;
  try {
    const msg = await tw.messages.create({
      from,
      to,
      body,
      ...(mediaUrl ? { mediaUrl: [mediaUrl] } : {}),
    });
    logger.info({ sid: msg.sid, to, from, hasMedia: !!mediaUrl }, 'twilio_message_sent');
    return msg.sid;
  } catch (err: unknown) {
    logger.error({ err, to, from }, 'twilio_send_failed');
    return null;
  }
}

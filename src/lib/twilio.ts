import twilio from 'twilio';
import { env, isTwilioAccountConfigured } from '../config.js';
import { normalizeTwilioWhatsAppFrom } from './salonDefaults.js';
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
  twilioFrom?: string,
): Promise<string | null> {
  const tw = getTwilioClient();
  const from = twilioFrom
    ?? (env.TWILIO_WHATSAPP_FROM ? normalizeTwilioWhatsAppFrom(env.TWILIO_WHATSAPP_FROM) : null);
  if (!tw || !from) {
    logger.error({ hasClient: !!tw, hasFrom: !!from }, 'twilio_send_aborted_no_config');
    return null;
  }
  const toDigits = toWaId.replace(/^whatsapp:/i, '').replace(/^\+/, '');
  const to = `whatsapp:+${toDigits}`;
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

/** Send PayFast checkout link to customer on WhatsApp (Twilio). */
export async function sendPaymentLinkMessage(
  phone: string,
  link: string,
  opts?: {
    twilioFrom?: string;
    salonName?: string;
    serviceName?: string;
    amountLabel?: string;
  },
): Promise<string | null> {
  const header = opts?.salonName ? `*${opts.salonName}*` : 'Your booking';
  const lines = [
    header,
    '',
    opts?.serviceName
      ? `Please complete payment for *${opts.serviceName}*${opts.amountLabel ? ` (${opts.amountLabel})` : ''}:`
      : 'Please complete your booking payment:',
    link,
    '',
    '_Pay securely via PayFast. Your booking is confirmed once payment is received._',
  ];
  return sendWhatsAppReply(phone, lines.join('\n'), undefined, opts?.twilioFrom);
}

export function formatZaWhatsAppPhone(waId: string): string {
  const digits = waId.replace(/\D/g, '');
  if (!digits) return waId;
  if (digits.startsWith('27')) return `+${digits}`;
  if (digits.startsWith('0')) return `+27${digits.slice(1)}`;
  return `+${digits}`;
}

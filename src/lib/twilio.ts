import twilio from 'twilio';
import { env, isTwilioAccountConfigured } from '../config.js';
import { prisma } from './prisma.js';
import { normalizeTwilioWhatsAppFrom } from './salonDefaults.js';
import { logger } from './logger.js';

let client: ReturnType<typeof twilio> | null = null;

/** Twilio REST client (platform account SID + auth token). */
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

/**
 * Resolve the outbound WhatsApp From address for a tenant.
 * Throws if the tenant has no twilioWhatsAppNumber — never falls back to env.
 */
export async function getTenantWhatsAppFrom(tenantId: string): Promise<string> {
  const salon = await prisma.salon.findFirst({
    where: { id: tenantId, deletedAt: null },
    select: { twilioWhatsAppNumber: true, name: true, slug: true },
  });
  const raw = salon?.twilioWhatsAppNumber?.trim();
  if (!raw) {
    throw new Error(
      `Tenant ${tenantId}${salon ? ` (${salon.slug})` : ''} has no twilioWhatsAppNumber configured`,
    );
  }
  return normalizeTwilioWhatsAppFrom(raw);
}

export async function sendWhatsAppReply(
  toWaId: string,
  body: string,
  mediaUrl?: string,
  twilioFrom?: string,
): Promise<string | null> {
  return sendWhatsAppReplyWithStatusCallback({ toWaId, body, mediaUrl, twilioFrom });
}

export async function sendWhatsAppReplyWithStatusCallback(params: {
  toWaId: string;
  body: string;
  mediaUrl?: string;
  twilioFrom?: string;
  statusCallback?: string;
}): Promise<string | null> {
  const tw = getTwilioClient();
  const from = params.twilioFrom?.trim()
    ? normalizeTwilioWhatsAppFrom(params.twilioFrom)
    : null;
  if (!tw || !from) {
    logger.error(
      { hasClient: !!tw, hasFrom: !!from, hint: 'Pass twilioFrom from getTenantWhatsAppFrom(tenantId)' },
      'twilio_send_aborted_no_config',
    );
    return null;
  }
  const toDigits = params.toWaId.replace(/^whatsapp:/i, '').replace(/^\+/, '');
  const to = `whatsapp:+${toDigits}`;
  try {
    const msg = await tw.messages.create({
      from,
      to,
      body: params.body,
      ...(params.mediaUrl ? { mediaUrl: [params.mediaUrl] } : {}),
      ...(params.statusCallback
        ? { statusCallback: params.statusCallback, statusCallbackMethod: 'POST' as const }
        : {}),
    });
    logger.info(
      { sid: msg.sid, to, from, hasMedia: !!params.mediaUrl, hasCallback: !!params.statusCallback },
      'twilio_message_sent',
    );
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

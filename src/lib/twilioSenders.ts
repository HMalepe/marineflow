import { env } from '../config.js';
import { cached } from './cache.js';
import { logger } from './logger.js';
import { normalizeWaId } from './phone.js';
import { normalizeTwilioWhatsAppFrom } from './salonDefaults.js';
import { getTwilioAccountClient } from './twilio.js';

export interface TwilioWhatsAppSender {
  sid: string;
  phoneE164: string;
  twilioWhatsAppFrom: string;
  status?: string;
}

const CACHE_KEY = 'cache:twilio:whatsapp-senders';
const CACHE_TTL = 300;

function senderFromDigits(digits: string, sid: string, status?: string): TwilioWhatsAppSender {
  return {
    sid,
    phoneE164: `+${digits}`,
    twilioWhatsAppFrom: normalizeTwilioWhatsAppFrom(`+${digits}`),
    status,
  };
}

function envFallbackSenders(): TwilioWhatsAppSender[] {
  if (!env.TWILIO_WHATSAPP_FROM) return [];
  const digits = normalizeWaId(env.TWILIO_WHATSAPP_FROM);
  if (!digits) return [];
  return [senderFromDigits(digits, 'env')];
}

function mergeEnvFallback(senders: TwilioWhatsAppSender[]): TwilioWhatsAppSender[] {
  const envSenders = envFallbackSenders();
  if (envSenders.length === 0) return senders;
  const seen = new Set(senders.map((s) => normalizeWaId(s.phoneE164)));
  for (const s of envSenders) {
    if (!seen.has(normalizeWaId(s.phoneE164))) senders.push(s);
  }
  return senders;
}

async function fetchTwilioWhatsAppSenders(): Promise<TwilioWhatsAppSender[]> {
  const client = getTwilioAccountClient();
  if (!client) {
    return envFallbackSenders();
  }

  try {
    const senders: TwilioWhatsAppSender[] = [];
    const page = await client.messaging.v2.channelsSenders.list({
      channel: 'whatsapp',
      limit: 100,
    });

    for (const row of page) {
      const digits = normalizeWaId(row.senderId ?? '');
      if (!digits) continue;
      senders.push(senderFromDigits(digits, row.sid, row.status));
    }

    return mergeEnvFallback(senders);
  } catch (err) {
    logger.error({ err }, 'twilio_whatsapp_senders_fetch_failed');
    return envFallbackSenders();
  }
}

/** WhatsApp business numbers registered on the platform Twilio account. */
export async function listTwilioWhatsAppSenders(): Promise<TwilioWhatsAppSender[]> {
  return cached(CACHE_KEY, fetchTwilioWhatsAppSenders, CACHE_TTL);
}

export async function findTwilioSenderByPhone(
  phoneE164: string,
): Promise<TwilioWhatsAppSender | null> {
  const target = normalizeWaId(phoneE164);
  const senders = await listTwilioWhatsAppSenders();
  return senders.find((s) => normalizeWaId(s.phoneE164) === target) ?? null;
}

export async function isTwilioRegisteredWhatsAppNumber(phoneE164: string): Promise<boolean> {
  return (await findTwilioSenderByPhone(phoneE164)) !== null;
}

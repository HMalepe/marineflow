import { cached } from './cache.js';
import { logger } from './logger.js';
import { normalizeWaId } from './phone.js';
import { normalizeTwilioWhatsAppFrom } from './salonDefaults.js';
import { getTwilioAccountClient } from './twilio.js';

export interface TwilioWhatsAppSender {
  sid: string;
  phoneE164: string;
  twilioWhatsAppNumber: string;
  status?: string;
}

const CACHE_KEY = 'cache:twilio:whatsapp-senders';
const CACHE_TTL = 300;

function senderFromDigits(digits: string, sid: string, status?: string): TwilioWhatsAppSender {
  return {
    sid,
    phoneE164: `+${digits}`,
    twilioWhatsAppNumber: normalizeTwilioWhatsAppFrom(`+${digits}`),
    status,
  };
}

async function fetchTwilioWhatsAppSenders(): Promise<TwilioWhatsAppSender[]> {
  const client = getTwilioAccountClient();
  if (!client) {
    logger.warn('twilio_whatsapp_senders_no_account_configured');
    return [];
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

    return senders;
  } catch (err) {
    logger.error({ err }, 'twilio_whatsapp_senders_fetch_failed');
    return [];
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

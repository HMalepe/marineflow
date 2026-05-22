import twilio from 'twilio';
import { env, isTwilioConfigured } from '../config.js';

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
    return null;
  }
  const to = toWaId.startsWith('whatsapp:') ? toWaId : `whatsapp:${toWaId}`;
  const msg = await tw.messages.create({
    from: env.TWILIO_WHATSAPP_FROM,
    to,
    body,
  });
  return msg.sid;
}

import type { MessagingProvider, SendOptions, SentMessage, NormalisedInboundMessage } from './types.js';
import { logger } from '../../logger.js';

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID ?? '';
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN ?? '';
const TWILIO_SMS_FROM = process.env.TWILIO_SMS_FROM ?? '';

/**
 * SMS messaging provider via Twilio Programmable SMS.
 */
export const smsMessaging: MessagingProvider = {
  async sendText(options: SendOptions): Promise<SentMessage> {
    if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_SMS_FROM) {
      logger.warn('sms_not_configured');
      return { providerMessageId: null };
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`;
    const body = new URLSearchParams({
      To: options.to,
      From: TWILIO_SMS_FROM,
      Body: options.body,
    });

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!res.ok) {
      const errBody = await res.text();
      logger.error({ status: res.status, errBody }, 'sms_send_failed');
      return { providerMessageId: null };
    }

    const data = await res.json() as { sid: string; date_created: string };
    return {
      providerMessageId: data.sid,
      timestamp: new Date(data.date_created),
    };
  },

  async sendTemplate(options: SendOptions): Promise<SentMessage> {
    return this.sendText(options);
  },

  verifyWebhook(_payload: unknown, _signature: string | undefined): boolean {
    // Twilio webhook validation is handled at the route level
    return true;
  },

  parseInbound(payload: unknown): NormalisedInboundMessage | null {
    const p = payload as Record<string, string>;
    if (!p.From || !p.Body) return null;

    return {
      externalId: p.MessageSid ?? `sms_${Date.now()}`,
      fromPhoneE164: p.From,
      toAddress: p.To ?? TWILIO_SMS_FROM,
      body: p.Body,
      mediaUrl: p.MediaUrl0 ?? null,
      receivedAt: new Date(),
    };
  },

  parseInboundBatch(payload: unknown): NormalisedInboundMessage[] {
    const msg = this.parseInbound(payload);
    return msg ? [msg] : [];
  },
};

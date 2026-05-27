import crypto from 'node:crypto';
import { env } from '../../../config.js';
import type {
  MessagingProvider,
  NormalisedInboundMessage,
  SendOptions,
  SentMessage,
} from './types.js';

/** Verify Meta webhook signature against the raw request body Buffer. */
export function verifyWebhookRawBuffer(buf: Buffer, signature: string | undefined): boolean {
  if (!env.META_APP_SECRET || !signature) return false;
  const expected = Buffer.from(
    crypto.createHmac('sha256', env.META_APP_SECRET).update(buf).digest('hex'),
  );
  const provided = Buffer.from(signature.replace(/^sha256=/, ''));
  if (expected.length !== provided.length) return false;
  return crypto.timingSafeEqual(expected, provided);
}

const API_BASE = 'https://graph.facebook.com';

function apiUrl(phoneNumberId: string): string {
  return `${API_BASE}/${env.META_API_VERSION}/${phoneNumberId}/messages`;
}

export const whatsappCloudMessaging: MessagingProvider = {
  async sendText(options: SendOptions): Promise<SentMessage> {
    const { to, body, phoneNumberId } = options;
    if (!phoneNumberId) throw new Error('phoneNumberId required for Meta Cloud API');
    if (!env.META_ACCESS_TOKEN) throw new Error('META_ACCESS_TOKEN not configured');

    const response = await fetch(apiUrl(phoneNumberId), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.META_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: to.replace(/^\+/, ''),
        type: 'text',
        text: { preview_url: false, body },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Meta Cloud API send failed (${response.status}): ${err}`);
    }

    const data = (await response.json()) as { messages?: { id: string }[] };
    const wamid = data.messages?.[0]?.id ?? '';

    return { providerMessageId: wamid, timestamp: new Date() };
  },

  async sendTemplate(options: SendOptions): Promise<SentMessage> {
    const { to, templateName, templateLang, templateParams, phoneNumberId } = options;
    if (!phoneNumberId) throw new Error('phoneNumberId required for Meta Cloud API');
    if (!env.META_ACCESS_TOKEN) throw new Error('META_ACCESS_TOKEN not configured');
    if (!templateName) throw new Error('templateName required for sendTemplate');

    const components = templateParams?.length
      ? [{ type: 'body', parameters: templateParams.map((p) => ({ type: 'text', text: p.value })) }]
      : [];

    const response = await fetch(apiUrl(phoneNumberId), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.META_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: to.replace(/^\+/, ''),
        type: 'template',
        template: {
          name: templateName,
          language: { code: templateLang ?? 'en' },
          components,
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Meta Cloud API template send failed (${response.status}): ${err}`);
    }

    const data = (await response.json()) as { messages?: { id: string }[] };
    return { providerMessageId: data.messages?.[0]?.id ?? '', timestamp: new Date() };
  },

  verifyWebhook(payload: unknown, signature: string | undefined): boolean {
    if (!env.META_APP_SECRET || !signature) return false;
    const raw = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const expectedBuf = Buffer.from(
      crypto.createHmac('sha256', env.META_APP_SECRET).update(raw).digest('hex'),
    );
    const providedBuf = Buffer.from(signature.replace(/^sha256=/, ''));
    if (expectedBuf.length !== providedBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, providedBuf);
  },

  parseInbound(payload: unknown): NormalisedInboundMessage | null {
    const all = this.parseInboundBatch(payload);
    return all.length > 0 ? all[0]! : null;
  },

  parseInboundBatch(payload: unknown): NormalisedInboundMessage[] {
    const body = payload as {
      entry?: {
        changes?: {
          value?: {
            metadata?: { phone_number_id?: string };
            messages?: {
              id: string;
              from: string;
              timestamp: string;
              text?: { body: string };
            }[];
          };
        }[];
      }[];
    };

    const results: NormalisedInboundMessage[] = [];
    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        const phoneId = value?.metadata?.phone_number_id;
        for (const msg of value?.messages ?? []) {
          const ts = Number(msg.timestamp);
          results.push({
            externalId: msg.id,
            fromPhoneE164: msg.from.startsWith('+') ? msg.from : `+${msg.from}`,
            toAddress: phoneId ?? '',
            body: msg.text?.body ?? '',
            receivedAt: isNaN(ts) ? new Date() : new Date(ts * 1000),
            metaPhoneNumberId: phoneId,
          });
        }
      }
    }
    return results;
  },
};

import { sendWhatsAppReply } from '../../twilio.js';
import { normalizeWaId } from '../../phone.js';
import { validateTwilioRequest } from '../../twilioValidate.js';
import { env } from '../../../config.js';
import type {
  MessagingProvider,
  NormalisedInboundMessage,
  SendOptions,
  SentMessage,
} from './types.js';

export const twilioMessaging: MessagingProvider = {
  async sendText(options: SendOptions): Promise<SentMessage> {
    const sid = await sendWhatsAppReply(options.to, options.body, options.mediaUrl);
    return { providerMessageId: sid, timestamp: new Date() };
  },

  async sendTemplate(_options: SendOptions): Promise<SentMessage> {
    throw new Error('twilio_templates_not_implemented');
  },

  verifyWebhook(payload: unknown, signature: string | undefined): boolean {
    const params = payload as Record<string, string>;
    const url = `${env.TWILIO_WEBHOOK_BASE_URL.replace(/\/$/, '')}/webhooks/twilio/whatsapp`;
    return validateTwilioRequest(signature, url, params);
  },

  parseInbound(payload: unknown): NormalisedInboundMessage | null {
    const all = this.parseInboundBatch(payload);
    return all.length > 0 ? all[0]! : null;
  },

  parseInboundBatch(payload: unknown): NormalisedInboundMessage[] {
    const params = payload as Record<string, string>;
    const from = params['From'] ?? '';
    const to = params['To'] ?? '';
    const body = params['Body'] ?? '';
    const sid = params['MessageSid'] ?? '';
    if (!from || !sid) return [];
    return [{
      externalId: sid,
      fromPhoneE164: normalizeWaId(from),
      toAddress: to,
      body,
      receivedAt: new Date(),
    }];
  },
};

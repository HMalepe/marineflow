import { sendWhatsAppReply } from '../../twilio.js';
import { normalizeWaId } from '../../phone.js';
import { validateTwilioRequest } from '../../twilioValidate.js';
import { env } from '../../../config.js';
import { sendTwilioInteractive } from './twilioContent.js';
import type {
  MessagingProvider,
  NormalisedInboundMessage,
  SendOptions,
  SentMessage,
} from './types.js';

export const twilioMessaging: MessagingProvider = {
  async sendText(options: SendOptions): Promise<SentMessage> {
    if (options.interactive) {
      if (!options.twilioFrom) {
        throw new Error('twilioFrom_required_for_interactive');
      }
      const sid = await sendTwilioInteractive(options.to, options.interactive, options.twilioFrom);
      return { providerMessageId: sid, timestamp: new Date() };
    }
    const sid = await sendWhatsAppReply(options.to, options.body, options.mediaUrl, options.twilioFrom);
    return { providerMessageId: sid, timestamp: new Date() };
  },

  async sendTemplate(_options: SendOptions): Promise<SentMessage> {
    throw new Error('twilio_templates_not_implemented');
  },

  verifyWebhook(payload: unknown, signature: string | undefined, candidateUrls?: string[]): boolean {
    const params = payload as Record<string, string>;
    const configuredUrl = `${env.TWILIO_WEBHOOK_BASE_URL.replace(/\/$/, '')}/webhooks/twilio/whatsapp`;
    const urls = new Set([configuredUrl, ...(candidateUrls ?? [])]);
    return [...urls].some((url) => validateTwilioRequest(signature, url, params));
  },

  parseInbound(payload: unknown): NormalisedInboundMessage | null {
    const all = this.parseInboundBatch(payload);
    return all.length > 0 ? all[0]! : null;
  },

  parseInboundBatch(payload: unknown): NormalisedInboundMessage[] {
    const params = payload as Record<string, string>;
    const from = params['From'] ?? '';
    const to = params['To'] ?? '';
    // Quick Reply taps set Body to the button's title and ButtonPayload to its id —
    // prefer the id only when it's one of our plain-number menu choices ("1"/"2"/"3"),
    // since other flows match on the literal title text in Body.
    const buttonPayload = (params['ButtonPayload'] ?? '').trim();
    const body = /^\d+$/.test(buttonPayload) ? buttonPayload : (params['Body'] ?? '').trim();
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

export type MediaType = 'image' | 'document' | 'audio' | 'video';

/** WhatsApp interactive list message (Meta Cloud API). Twilio Phase 1: plain text fallback. */
export interface InteractiveList {
  type: 'list';
  header?: string;
  body: string;
  footer?: string;
  /** CTA button label — max 20 characters */
  button: string;
  sections: Array<{
    title?: string;
    rows: Array<{
      /** Value returned when the customer taps (e.g. "1", "book") */
      id: string;
      /** Display text — max 24 characters */
      title: string;
      /** Subtitle — max 72 characters */
      description?: string;
    }>;
  }>;
}

export interface SendOptions {
  to: string;
  body: string;
  idempotencyKey?: string;
  /** Meta Cloud API phone_number_id — required for Meta provider */
  phoneNumberId?: string;
  /** Public HTTPS URL — sends as WhatsApp image or video with caption */
  mediaUrl?: string;
  mediaType?: MediaType;
  /** For template sends */
  templateName?: string;
  templateLang?: string;
  templateParams?: TemplateParam[];
  /** Meta Cloud API interactive list — body is used as plain-text fallback */
  interactive?: InteractiveMessage;
  /** Twilio WhatsApp sender address (salon DB field or env fallback) */
  twilioFrom?: string;
}

/** WhatsApp reply buttons (Meta Cloud API) — max 3 buttons per message. */
export interface InteractiveButtons {
  type: 'button';
  header?: string;
  body: string;
  footer?: string;
  buttons: Array<{
    /** Value returned when tapped (e.g. "yes", "1") */
    id: string;
    /** Button label — max 20 characters */
    title: string;
  }>;
}

/** WhatsApp CTA URL button — opens a link in the browser (max 1 URL on Meta Cloud API). */
export interface InteractiveCtaUrl {
  type: 'cta_url';
  header?: string;
  body: string;
  footer?: string;
  /** Button label — max 20 characters (Meta); max 25 on Twilio */
  displayText: string;
  url: string;
  /** Optional second URL (Twilio call-to-action only — ignored on Meta Cloud). */
  secondaryAction?: { displayText: string; url: string };
}

export type InteractiveMessage = InteractiveList | InteractiveButtons | InteractiveCtaUrl;

export interface TemplateParam {
  name: string;
  value: string;
}

export interface SentMessage {
  providerMessageId: string | null;
  timestamp?: Date;
}

export interface NormalisedInboundMessage {
  externalId: string;
  fromPhoneE164: string;
  toAddress: string;
  body: string;
  mediaUrl?: string | null;
  receivedAt: Date;
  metaPhoneNumberId?: string;
}

export interface MessagingProvider {
  sendText(options: SendOptions): Promise<SentMessage>;
  sendTemplate(options: SendOptions): Promise<SentMessage>;
  verifyWebhook(payload: unknown, signature: string | undefined, candidateUrls?: string[]): boolean;
  parseInbound(payload: unknown): NormalisedInboundMessage | null;
  parseInboundBatch(payload: unknown): NormalisedInboundMessage[];
}

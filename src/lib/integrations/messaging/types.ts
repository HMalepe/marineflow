export interface SendOptions {
  to: string;
  body: string;
  idempotencyKey?: string;
  /** Meta Cloud API phone_number_id — required for Meta provider */
  phoneNumberId?: string;
  /** For template sends */
  templateName?: string;
  templateLang?: string;
  templateParams?: TemplateParam[];
}

export interface TemplateParam {
  name: string;
  value: string;
}

export type MediaType = 'image' | 'document' | 'audio' | 'video';

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
  verifyWebhook(payload: unknown, signature: string | undefined): boolean;
  parseInbound(payload: unknown): NormalisedInboundMessage | null;
}

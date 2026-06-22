import { env, isTwilioAccountConfigured } from '../../../config.js';
import { logger } from '../../logger.js';
import { truncateListField } from './interactiveList.js';

const CONTENT_API_BASE = 'https://content.twilio.com/v1/Content';
const MAX_CARD_ACTIONS = 3;

export type WhatsappCardActionType = 'URL' | 'PHONE_NUMBER' | 'QUICK_REPLY' | 'COPY_CODE' | 'VOICE_CALL';

export interface WhatsappCardAction {
  type: WhatsappCardActionType;
  title: string;
  url?: string;
  phone?: string;
  code?: string;
}

/** Maps 1:1 to the fields stored on the WhatsappTemplate model. */
export interface WhatsappCardTemplate {
  body: string;
  footer?: string | null;
  headerText?: string | null;
  mediaUrl?: string | null;
  actions?: WhatsappCardAction[];
}

export type WhatsappTemplateCategory = 'MARKETING' | 'UTILITY';

export interface WhatsappApprovalStatus {
  status: 'unsubmitted' | 'received' | 'pending' | 'approved' | 'rejected' | 'paused' | 'disabled' | string;
  rejectionReason: string | null;
  category: string | null;
}

function basicAuthHeader(): string {
  const creds = `${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`;
  return `Basic ${Buffer.from(creds).toString('base64')}`;
}

/**
 * A whatsapp/card needs a body plus at least one of: header image, header text,
 * or a button — matching Meta's rich-card template requirements.
 */
export function validateWhatsappCardTemplate(card: WhatsappCardTemplate): string[] {
  const errors: string[] = [];
  const body = card.body?.trim() ?? '';
  if (!body) errors.push('Body text is required.');
  if (body.length > 1024) errors.push('Body text must be 1024 characters or fewer.');
  if (card.footer && card.footer.trim().length > 60) errors.push('Footer must be 60 characters or fewer.');
  if (card.headerText && card.headerText.trim().length > 60) {
    errors.push('Header text must be 60 characters or fewer.');
  }

  if (card.mediaUrl) {
    try {
      const parsed = new URL(card.mediaUrl);
      if (parsed.protocol !== 'https:') errors.push('Header image URL must use HTTPS.');
    } catch {
      errors.push('Header image URL is invalid.');
    }
  }

  const hasAdditionalField = Boolean(card.mediaUrl) || Boolean(card.headerText) || Boolean(card.actions?.length);
  if (!hasAdditionalField) {
    errors.push('Add a header image, header text, or at least one button.');
  }

  if (card.actions && card.actions.length > MAX_CARD_ACTIONS) {
    errors.push(`At most ${MAX_CARD_ACTIONS} buttons are allowed.`);
  }
  for (const action of card.actions ?? []) {
    if (!action.title?.trim()) errors.push('Every button needs a label.');
    if (action.type === 'URL' && !action.url?.trim()) errors.push('URL buttons need a link.');
    if (action.type === 'PHONE_NUMBER' && !action.phone?.trim()) errors.push('Phone buttons need a number.');
  }

  return errors;
}

function buildCardActionPayload(action: WhatsappCardAction): Record<string, unknown> {
  return {
    type: action.type,
    title: truncateListField(action.title.trim(), 24),
    ...(action.url ? { url: action.url.trim() } : {}),
    ...(action.phone ? { phone: action.phone.trim() } : {}),
    ...(action.code ? { code: action.code.trim() } : {}),
  };
}

function buildWhatsappCardType(card: WhatsappCardTemplate): Record<string, unknown> {
  return {
    'whatsapp/card': {
      body: truncateListField(card.body.trim(), 1024),
      ...(card.footer?.trim() ? { footer: truncateListField(card.footer.trim(), 60) } : {}),
      ...(card.headerText?.trim() ? { headerText: truncateListField(card.headerText.trim(), 60) } : {}),
      ...(card.mediaUrl?.trim() ? { media: [card.mediaUrl.trim()] } : {}),
      ...(card.actions?.length
        ? { actions: card.actions.slice(0, MAX_CARD_ACTIONS).map(buildCardActionPayload) }
        : {}),
    },
  };
}

/** Creates a Twilio Content resource for a whatsapp/card template. Returns its ContentSid. */
export async function createWhatsappCardContent(params: {
  friendlyName: string;
  language: string;
  card: WhatsappCardTemplate;
}): Promise<string> {
  if (!isTwilioAccountConfigured()) {
    throw new Error('Twilio is not configured.');
  }

  const res = await fetch(CONTENT_API_BASE, {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      friendly_name: params.friendlyName,
      language: params.language,
      variables: {},
      types: buildWhatsappCardType(params.card),
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Twilio Content create failed (${res.status}): ${err}`);
  }

  const data = (await res.json()) as { sid: string };
  return data.sid;
}

/** Deletes a Content resource — only safe for templates that haven't been sent. */
export async function deleteWhatsappCardContent(contentSid: string): Promise<void> {
  if (!isTwilioAccountConfigured()) return;
  const res = await fetch(`${CONTENT_API_BASE}/${contentSid}`, {
    method: 'DELETE',
    headers: { Authorization: basicAuthHeader() },
  });
  if (!res.ok && res.status !== 404) {
    const err = await res.text();
    logger.warn({ contentSid, status: res.status, err }, 'twilio_content_delete_failed');
  }
}

/**
 * Submits a Content resource for WhatsApp template approval.
 * Category MARKETING templates can be sent outside the 24h session window once approved.
 */
export async function submitWhatsappTemplateApproval(params: {
  contentSid: string;
  name: string;
  category: WhatsappTemplateCategory;
}): Promise<void> {
  if (!isTwilioAccountConfigured()) {
    throw new Error('Twilio is not configured.');
  }

  const res = await fetch(`${CONTENT_API_BASE}/${params.contentSid}/ApprovalRequests/whatsapp`, {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: params.name, category: params.category }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Twilio WhatsApp approval submission failed (${res.status}): ${err}`);
  }
}

/** Fetches the current WhatsApp approval status for a Content resource. */
export async function fetchWhatsappTemplateApproval(contentSid: string): Promise<WhatsappApprovalStatus> {
  if (!isTwilioAccountConfigured()) {
    throw new Error('Twilio is not configured.');
  }

  const res = await fetch(`${CONTENT_API_BASE}/${contentSid}/ApprovalRequests`, {
    method: 'GET',
    headers: { Authorization: basicAuthHeader() },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Twilio WhatsApp approval fetch failed (${res.status}): ${err}`);
  }

  const data = (await res.json()) as { whatsapp?: Record<string, unknown> };
  const whatsapp = data.whatsapp ?? {};
  return {
    status: typeof whatsapp.status === 'string' ? whatsapp.status : 'unsubmitted',
    rejectionReason: typeof whatsapp.rejection_reason === 'string' ? whatsapp.rejection_reason : null,
    category: typeof whatsapp.category === 'string' ? whatsapp.category : null,
  };
}

import { env, isTwilioAccountConfigured } from '../../../config.js';
import { normalizeTwilioWhatsAppFrom } from '../../salonDefaults.js';
import { logger } from '../../logger.js';
import { truncateListField } from './interactiveList.js';
import type { InteractiveMessage } from './types.js';

const CONTENT_API_BASE = 'https://content.twilio.com/v1/Content';

function basicAuthHeader(): string {
  const creds = `${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`;
  return `Basic ${Buffer.from(creds).toString('base64')}`;
}

/** Twilio WhatsApp List Picker supports at most 10 items. */
const LIST_PICKER_MAX_ITEMS = 10;
/** Twilio WhatsApp Quick Reply supports at most 3 buttons. */
const QUICK_REPLY_MAX_ACTIONS = 3;

function buildContentTypes(interactive: InteractiveMessage): Record<string, unknown> {
  if (interactive.type === 'button') {
    return {
      'twilio/quick-reply': {
        body: truncateListField(interactive.body.trim(), 1024),
        actions: interactive.buttons.slice(0, QUICK_REPLY_MAX_ACTIONS).map((b) => ({
          id: truncateListField(b.id.trim(), 200),
          title: truncateListField(b.title.trim(), 24),
        })),
      },
    };
  }

  const items = interactive.sections
    .flatMap((section) => section.rows)
    .slice(0, LIST_PICKER_MAX_ITEMS)
    .map((row) => ({
      id: truncateListField(row.id.trim(), 200),
      item: truncateListField(row.title.trim(), 24),
      ...(row.description ? { description: truncateListField(row.description.trim(), 72) } : {}),
    }));

  return {
    'twilio/list-picker': {
      body: truncateListField(interactive.body.trim(), 1024),
      button: truncateListField(interactive.button.trim(), 20),
      items,
    },
  };
}

/**
 * Create a one-off Twilio Content resource for this interactive message and
 * return its ContentSid. Quick Reply / List Picker content sent in response
 * to an inbound message (within the 24h session window) does not require
 * WhatsApp template approval, so we can create-and-send per message.
 */
async function createContent(interactive: InteractiveMessage): Promise<string> {
  const res = await fetch(CONTENT_API_BASE, {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      friendly_name: `mf_${interactive.type}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      language: 'en',
      variables: {},
      types: buildContentTypes(interactive),
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Twilio Content create failed (${res.status}): ${err}`);
  }

  const data = (await res.json()) as { sid: string };
  return data.sid;
}

/**
 * Send a WhatsApp interactive (list or button) message via Twilio's Content API.
 * Returns the Twilio message SID, or null if Twilio isn't configured.
 */
export async function sendTwilioInteractive(
  to: string,
  interactive: InteractiveMessage,
  twilioFrom: string,
): Promise<string | null> {
  const from = normalizeTwilioWhatsAppFrom(twilioFrom);
  if (!isTwilioAccountConfigured()) {
    logger.error('twilio_interactive_send_aborted_no_config');
    return null;
  }

  const toDigits = to.replace(/^whatsapp:/i, '').replace(/^\+/, '');
  const toAddr = `whatsapp:+${toDigits}`;

  try {
    const contentSid = await createContent(interactive);

    const { getTwilioAccountClient } = await import('../../twilio.js');
    const tw = getTwilioAccountClient();
    if (!tw) {
      logger.error('twilio_interactive_send_aborted_no_client');
      return null;
    }

    const msg = await tw.messages.create({
      from,
      to: toAddr,
      contentSid,
      contentVariables: JSON.stringify({}),
    });
    logger.info({ sid: msg.sid, to: toAddr, contentSid }, 'twilio_interactive_sent');
    return msg.sid;
  } catch (err) {
    logger.error({ err, to: toAddr }, 'twilio_interactive_send_failed');
    return null;
  }
}

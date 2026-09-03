/**
 * v1: customer types a product name on WhatsApp → we send the product photo
 * via Cloud API. Catalog is the tenant Service table (case-insensitive name match).
 */

import { prisma } from '../lib/prisma.js';
import { env } from '../config.js';
import { logger } from '../lib/logger.js';
import { isConversationWakeMessage } from '../lib/conversationWake.js';
import { isSwitchBusinessCommand } from '../lib/businessRouter.js';
import { resolveTenantForInbound } from '../lib/tenant.js';
import { formatZarFromCents, isDispensarySalon } from '../lib/retailSettings.js';

const GRAPH_API_BASE = 'https://graph.facebook.com';
const PHOTO_PREFIX = /^(photo|pic|picture|image|show)(?:\s+(?:me|of))?\s+/i;

export type IncomingWhatsAppMessage = {
  from: string;
  text?: { body?: string };
  type?: string;
  salonId?: string;
  metaPhoneNumberId?: string;
};

export type WhatsAppCloudPayload = {
  messaging_product: 'whatsapp';
  recipient_type?: 'individual';
  to?: string;
  type: 'text' | 'image';
  text?: { preview_url?: boolean; body: string };
  image?: { link: string; caption?: string };
};

type ProductRow = {
  id: string;
  name: string;
  priceCents: number;
  imageUrl: string | null;
  imageCaption: string | null;
  description: string | null;
};

function cloudCredentials(phoneNumberIdHint?: string): { token: string; phoneNumberId: string } | null {
  const token = (
    process.env.WHATSAPP_ACCESS_TOKEN ||
    env.META_ACCESS_TOKEN ||
    ''
  ).trim();
  const phoneNumberId = (
    phoneNumberIdHint ||
    process.env.WHATSAPP_PHONE_NUMBER_ID ||
    env.META_PHONE_NUMBER_ID ||
    ''
  ).trim();
  if (!token || !phoneNumberId) return null;
  return { token, phoneNumberId };
}

/** Postgres maps this to ILIKE '%query%'. */
async function findProductsByName(salonId: string, query: string): Promise<ProductRow[]> {
  return prisma.service.findMany({
    where: {
      salonId,
      deletedAt: null,
      active: true,
      name: { contains: query, mode: 'insensitive' },
    },
    select: {
      id: true,
      name: true,
      priceCents: true,
      imageUrl: true,
      imageCaption: true,
      description: true,
    },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    take: 10,
  });
}

function isBotCommand(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (isConversationWakeMessage(t) || isSwitchBusinessCommand(t)) return true;
  return /^(yes|no|ok|okay|thanks|thank you|accept|decline|cash|support|usual|menu|\d{1,2})$/i.test(t);
}

function parseSearchQuery(raw: string): { query: string; photoIntent: boolean } {
  const trimmed = raw.trim();
  const photoIntent = PHOTO_PREFIX.test(trimmed);
  const query = photoIntent ? trimmed.replace(PHOTO_PREFIX, '').trim() : trimmed;
  return { query, photoIntent };
}

function defaultCaption(product: ProductRow): string {
  const custom = product.imageCaption?.trim();
  if (custom) return custom;
  const price = formatZarFromCents(product.priceCents);
  const desc = product.description?.trim();
  return desc ? `*${product.name}* · ${price}\n${desc}` : `*${product.name}* · ${price}`;
}

/** Builds the Cloud API image payload for a product (no `to` yet). */
export async function getProductImageMessage(productId: string): Promise<WhatsAppCloudPayload | null> {
  const product = await prisma.service.findFirst({
    where: { id: productId, deletedAt: null, active: true },
    select: {
      id: true,
      name: true,
      priceCents: true,
      imageUrl: true,
      imageCaption: true,
      description: true,
    },
  });
  const link = product?.imageUrl?.trim();
  if (!product || !link) return null;
  return {
    messaging_product: 'whatsapp',
    type: 'image',
    image: {
      link,
      caption: defaultCaption(product),
    },
  };
}

export async function sendWhatsAppMessage(
  to: string,
  payload: WhatsAppCloudPayload,
  phoneNumberIdHint?: string,
): Promise<unknown> {
  const creds = cloudCredentials(phoneNumberIdHint);
  if (!creds) {
    throw new Error('WhatsApp Cloud API is not configured (WHATSAPP_ACCESS_TOKEN / META_ACCESS_TOKEN)');
  }

  const body: Record<string, unknown> = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: to.replace(/^\+/, ''),
    type: payload.type,
  };
  if (payload.type === 'text' && payload.text) {
    body.text = payload.text;
  }
  if (payload.type === 'image' && payload.image) {
    body.image = payload.image;
  }

  const url = `${GRAPH_API_BASE}/${env.META_API_VERSION}/${creds.phoneNumberId}/messages`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${creds.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const raw = await response.text();
  let parsed: unknown = raw;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    /* keep raw string */
  }

  logger.info(
    { status: response.status, to: body.to, type: payload.type, response: parsed },
    'whatsapp_cloud_product_image_send',
  );

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`WhatsApp Cloud API send failed (${response.status}): ${raw}`);
  }
  return parsed;
}

export async function sendTextMessage(
  to: string,
  textBody: string,
  phoneNumberIdHint?: string,
): Promise<unknown> {
  return sendWhatsAppMessage(
    to,
    {
      messaging_product: 'whatsapp',
      type: 'text',
      text: { preview_url: false, body: textBody },
    },
    phoneNumberIdHint,
  );
}

async function resolveDispensarySalonId(message: IncomingWhatsAppMessage): Promise<string | null> {
  try {
    const id = message.salonId
      ? message.salonId
      : (
          await resolveTenantForInbound({
            metaPhoneNumberId: message.metaPhoneNumberId,
          })
        )?.id;
    if (!id) return null;
    const salon = await prisma.salon.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, industryTemplate: true, isBusinessRouter: true },
    });
    if (!salon || salon.isBusinessRouter) return null;
    if (!isDispensarySalon(salon.industryTemplate)) return null;
    return salon.id;
  } catch (err) {
    logger.warn({ err }, 'product_image_tenant_resolve_failed');
    return null;
  }
}

/**
 * Inbound text → product photo. Returns true when the message was fully handled
 * (do not run the rest of the bot). Returns false to fall through.
 */
export async function handleIncomingMessage(message: IncomingWhatsAppMessage): Promise<boolean> {
  const inboundType = (message.type ?? 'text').toLowerCase();
  if (inboundType && inboundType !== 'text') {
    logger.info({ type: inboundType, from: message.from }, 'product_image_skip_non_text');
    return false;
  }

  const raw = message.text?.body?.trim() ?? '';
  if (!raw) return false;

  const { query, photoIntent } = parseSearchQuery(raw);
  if (!query || query.length < 2) return false;
  if (!photoIntent && isBotCommand(raw)) return false;

  const salonId = await resolveDispensarySalonId(message);
  if (!salonId) return false;

  let matches: ProductRow[];
  try {
    matches = await findProductsByName(salonId, query);
  } catch (err) {
    logger.error({ err, salonId, query }, 'product_image_search_failed');
    return false;
  }

  const to = message.from;
  const phoneHint = message.metaPhoneNumberId;

  try {
    if (matches.length === 1) {
      const product = matches[0]!;
      const image = await getProductImageMessage(product.id);
      if (image) {
        await sendWhatsAppMessage(to, image, phoneHint);
        return true;
      }
      await sendTextMessage(
        to,
        `We found *${product.name}* (${formatZarFromCents(product.priceCents)}) but don’t have a photo uploaded yet. Reply *MENU* to order it.`,
        phoneHint,
      );
      return true;
    }

    if (matches.length > 1) {
      const names = matches.map((p, i) => `${i + 1}. ${p.name}`).join('\n');
      await sendTextMessage(
        to,
        [
          `A few products match *${query}*:`,
          '',
          names,
          '',
          'Reply with a more specific name (or *photo* + the full name) and I’ll send the picture.',
        ].join('\n'),
        phoneHint,
      );
      return true;
    }

    if (photoIntent) {
      await sendTextMessage(
        to,
        `No product matched *${query}*. Check the spelling, or reply *MENU* then *1* for the full list.`,
        phoneHint,
      );
      return true;
    }
  } catch (err) {
    logger.error({ err, from: message.from, query }, 'product_image_send_failed');
    return false;
  }

  return false;
}

/**
 * Shared WhatsApp number → business picker gateway.
 * A router Salon owns the Twilio/Meta number; linked operating salons (Bontle, Dr Marley)
 * keep isolated catalogs, customers, and dashboards.
 */

import type { Salon } from '@prisma/client';
import { prisma } from './prisma.js';
import { logger } from './logger.js';

export const BUSINESS_ROUTER_SESSION_MS = 30 * 60 * 1000; // 30 min idle → re-ask

export type LinkedBusinessOption = {
  salonId: string;
  label: string;
  subtitle?: string;
  industryTemplate?: string | null;
};

export type BusinessRouterMeta = {
  isBusinessRouter?: boolean;
  linkedBusinesses?: LinkedBusinessOption[];
};

export function parseSalonMetadata(metadata: unknown): Record<string, unknown> {
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    return metadata as Record<string, unknown>;
  }
  return {};
}

export function isBusinessRouterSalon(
  salon: Pick<Salon, 'isBusinessRouter' | 'metadata'>,
): boolean {
  if (salon.isBusinessRouter) return true;
  const meta = parseSalonMetadata(salon.metadata);
  return meta.isBusinessRouter === true;
}

export function getLinkedBusinesses(
  salon: Pick<Salon, 'metadata'>,
): LinkedBusinessOption[] {
  const meta = parseSalonMetadata(salon.metadata);
  const raw = meta.linkedBusinesses;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row): LinkedBusinessOption | null => {
      if (!row || typeof row !== 'object') return null;
      const r = row as Record<string, unknown>;
      const salonId = typeof r.salonId === 'string' ? r.salonId.trim() : '';
      const label = typeof r.label === 'string' ? r.label.trim() : '';
      if (!salonId || !label) return null;
      return {
        salonId,
        label,
        subtitle: typeof r.subtitle === 'string' ? r.subtitle.trim() : undefined,
        industryTemplate:
          typeof r.industryTemplate === 'string' ? r.industryTemplate : undefined,
      };
    })
    .filter((x): x is LinkedBusinessOption => x != null);
}

/** Customer-facing picker names (WhatsApp first screen). */
export function pickerDisplayLabel(opt: LinkedBusinessOption): string {
  const hay = `${opt.industryTemplate ?? ''} ${opt.label}`.toLowerCase();
  if (hay.includes('dispensary') || hay.includes('marley') || hay.includes('retail')) {
    return 'Dr Marley';
  }
  if (hay.includes('bontle')) return 'BontleEntle';
  return opt.label;
}

export function buildBusinessPickerText(options: LinkedBusinessOption[]): string {
  const lines = options.map((opt, i) => `${i + 1}  *${pickerDisplayLabel(opt)}*`);
  return [
    '*Welcome — which business can we help you with?*',
    '',
    ...lines,
    '',
    'Reply with a number to continue.',
    'Reply *SWITCH* anytime to change businesses',
  ].join('\n');
}

export function parseBusinessPickerChoice(
  text: string,
  options: LinkedBusinessOption[],
): LinkedBusinessOption | null {
  const trimmed = text.trim();
  const n = Number.parseInt(trimmed, 10);
  if (Number.isFinite(n) && n >= 1 && n <= options.length) {
    return options[n - 1] ?? null;
  }
  const lower = trimmed.toLowerCase().replace(/[\s-]+/g, '');
  return (
    options.find((o) => pickerDisplayLabel(o).toLowerCase().replace(/[\s-]+/g, '') === lower) ??
    options.find((o) => o.label.toLowerCase() === trimmed.toLowerCase()) ??
    options.find((o) => lower.includes(pickerDisplayLabel(o).toLowerCase().replace(/[\s-]+/g, ''))) ??
    options.find((o) => lower.includes((o.label.toLowerCase().split(/\s+/)[0] ?? '').replace(/-/g, ''))) ??
    null
  );
}

export function isSwitchBusinessCommand(text: string): boolean {
  const t = text.trim().toLowerCase();
  return (
    t === 'switch' ||
    t === 'change business' ||
    t === 'switch business' ||
    t === 'other business' ||
    t === 'businesses'
  );
}

export type RouterChoiceContext = {
  chosenSalonId?: string;
  chosenAt?: string;
  chosenLabel?: string;
};

export function readRouterChoice(context: unknown): RouterChoiceContext {
  if (!context || typeof context !== 'object') return {};
  const c = context as Record<string, unknown>;
  return {
    chosenSalonId: typeof c.chosenSalonId === 'string' ? c.chosenSalonId : undefined,
    chosenAt: typeof c.chosenAt === 'string' ? c.chosenAt : undefined,
    chosenLabel: typeof c.chosenLabel === 'string' ? c.chosenLabel : undefined,
  };
}

export function isRouterChoiceFresh(chosenAt: string | undefined, now = Date.now()): boolean {
  if (!chosenAt) return false;
  const ts = Date.parse(chosenAt);
  if (!Number.isFinite(ts)) return false;
  return now - ts < BUSINESS_ROUTER_SESSION_MS;
}

/** Find the router salon that lists this operating salon, if any. */
export async function findRouterForLinkedSalon(salonId: string): Promise<{
  id: string;
  twilioWhatsAppNumber: string | null;
  whatsappPhoneId: string | null;
} | null> {
  const routers = await prisma.salon.findMany({
    where: { deletedAt: null, isBusinessRouter: true },
    select: {
      id: true,
      twilioWhatsAppNumber: true,
      whatsappPhoneId: true,
      metadata: true,
    },
  });
  for (const router of routers) {
    const linked = getLinkedBusinesses(router);
    if (linked.some((b) => b.salonId === salonId)) {
      return router;
    }
  }
  // Legacy: metadata flag without column
  const flagged = await prisma.salon.findMany({
    where: { deletedAt: null, isBusinessRouter: false },
    select: {
      id: true,
      twilioWhatsAppNumber: true,
      whatsappPhoneId: true,
      metadata: true,
      isBusinessRouter: true,
    },
  });
  for (const salon of flagged) {
    if (!isBusinessRouterSalon(salon)) continue;
    const linked = getLinkedBusinesses(salon);
    if (linked.some((b) => b.salonId === salonId)) {
      return salon;
    }
  }
  return null;
}

/**
 * Outbound WhatsApp credentials: prefer the operating salon’s own number,
 * otherwise borrow the shared router’s number.
 */
export async function resolveOutboundWhatsAppChannel(salonId: string): Promise<{
  twilioWhatsAppNumber: string | null;
  whatsappPhoneId: string | null;
  channelSalonId: string;
}> {
  const salon = await prisma.salon.findFirst({
    where: { id: salonId, deletedAt: null },
    select: { id: true, twilioWhatsAppNumber: true, whatsappPhoneId: true },
  });
  if (!salon) {
    return { twilioWhatsAppNumber: null, whatsappPhoneId: null, channelSalonId: salonId };
  }
  if (salon.twilioWhatsAppNumber?.trim() || salon.whatsappPhoneId?.trim()) {
    return {
      twilioWhatsAppNumber: salon.twilioWhatsAppNumber,
      whatsappPhoneId: salon.whatsappPhoneId,
      channelSalonId: salon.id,
    };
  }
  const router = await findRouterForLinkedSalon(salonId);
  if (router) {
    logger.info(
      { salonId, routerId: router.id },
      'whatsapp_outbound_via_business_router',
    );
    return {
      twilioWhatsAppNumber: router.twilioWhatsAppNumber,
      whatsappPhoneId: router.whatsappPhoneId,
      channelSalonId: router.id,
    };
  }

  const { env } = await import('../config.js');
  if (env.TWILIO_WHATSAPP_FROM?.trim() || env.META_PHONE_NUMBER_ID?.trim()) {
    logger.warn({ salonId }, 'whatsapp_outbound_via_platform_env_fallback');
    return {
      twilioWhatsAppNumber: env.TWILIO_WHATSAPP_FROM?.trim() || null,
      whatsappPhoneId: env.META_PHONE_NUMBER_ID?.trim() || null,
      channelSalonId: salonId,
    };
  }

  return {
    twilioWhatsAppNumber: null,
    whatsappPhoneId: null,
    channelSalonId: salonId,
  };
}

import type { Salon } from '@prisma/client';
import { prisma } from './prisma.js';
import { env } from '../config.js';
import { normalizeWaId } from './phone.js';

export type ResolvedTenant = Pick<
  Salon,
  | 'id'
  | 'slug'
  | 'name'
  | 'status'
  | 'timezone'
  | 'botName'
  | 'whatsappPhoneId'
  | 'twilioWhatsAppFrom'
>;

const tenantSelect = {
  id: true,
  slug: true,
  name: true,
  status: true,
  timezone: true,
  botName: true,
  whatsappPhoneId: true,
  twilioWhatsAppFrom: true,
} as const;

/** Platform registry lookup — Salon has no RLS. */
export async function findSalonBySlug(slug: string): Promise<ResolvedTenant | null> {
  return prisma.salon.findFirst({
    where: { slug, deletedAt: null },
    select: tenantSelect,
  });
}

export async function findSalonById(id: string): Promise<ResolvedTenant | null> {
  return prisma.salon.findFirst({
    where: { id, deletedAt: null },
    select: tenantSelect,
  });
}

/** Meta WhatsApp Cloud API: route by metadata.phone_number_id */
export async function resolveTenantFromMetaPhoneId(
  phoneNumberId: string,
): Promise<ResolvedTenant | null> {
  if (!phoneNumberId) return null;
  return prisma.salon.findFirst({
    where: { whatsappPhoneId: phoneNumberId, deletedAt: null },
    select: tenantSelect,
  });
}

/** Twilio: route by To / From business number (whatsapp:+...) */
export async function resolveTenantFromTwilioAddress(
  address: string | undefined,
): Promise<ResolvedTenant | null> {
  if (!address) return null;
  const normalized = address.startsWith('whatsapp:') ? address : `whatsapp:${normalizeWaId(address)}`;
  return prisma.salon.findFirst({
    where: { twilioWhatsAppFrom: normalized, deletedAt: null },
    select: tenantSelect,
  });
}

/**
 * Resolve tenant for an inbound WhatsApp message.
 * Order: explicit Meta phone id → Twilio To → default slug fallback.
 *
 * Important: if an identifier (metaPhoneNumberId or twilioTo) is supplied but
 * matches no salon, we return null rather than falling back to the default
 * salon. Falling back would route a cross-tenant message to the demo/fallback
 * salon and cause duplicate bot replies when both Twilio and Meta webhooks
 * fire for the same phone number.
 */
export async function resolveTenantForInbound(input: {
  metaPhoneNumberId?: string;
  twilioTo?: string;
}): Promise<ResolvedTenant | null> {
  if (input.metaPhoneNumberId) {
    const byMeta = await resolveTenantFromMetaPhoneId(input.metaPhoneNumberId);
    if (byMeta) return byMeta;

    // Env-level fallback: if META_PHONE_NUMBER_ID matches the inbound phone ID,
    // route to the default salon. Allows single-tenant deployments that haven't
    // yet stored whatsappPhoneId in the DB to keep working.
    if (env.META_PHONE_NUMBER_ID && input.metaPhoneNumberId === env.META_PHONE_NUMBER_ID) {
      const fallback = await findSalonBySlug(env.DEFAULT_SALON_SLUG);
      if (fallback) return fallback;
    }

    // metaPhoneNumberId provided but matched no salon — do not fall through
    // to Twilio or the default, to prevent cross-tenant routing.
    // Skip Twilio lookup if twilioTo is the same Meta phone ID (not an E.164 address).
    const isSameAsMetaId = input.twilioTo === input.metaPhoneNumberId;
    if (!input.twilioTo || isSameAsMetaId) return null;
  }
  if (input.twilioTo) {
    const byTwilio = await resolveTenantFromTwilioAddress(input.twilioTo);
    if (byTwilio) return byTwilio;
    // twilioTo provided but matched no salon — return null so we don't
    // accidentally send the demo-salon menu to a real customer.
    return null;
  }
  // No identifier at all (only possible in dev/test) — fall back to default.
  return findSalonBySlug(env.DEFAULT_SALON_SLUG);
}

export function assertTenantActive(tenant: ResolvedTenant): void {
  if (tenant.status === 'CHURNED') {
    throw new Error('tenant_inactive');
  }
}

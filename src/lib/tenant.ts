import type { Salon } from '@prisma/client';
import { prisma } from './prisma.js';
import { env } from '../config.js';
import { normalizeWaId } from './phone.js';
import { logger } from './logger.js';

export type ResolvedTenant = Pick<
  Salon,
  | 'id'
  | 'slug'
  | 'name'
  | 'status'
  | 'timezone'
  | 'botName'
  | 'whatsappPhoneId'
  | 'twilioWhatsAppNumber'
>;

const tenantSelect = {
  id: true,
  slug: true,
  name: true,
  status: true,
  timezone: true,
  botName: true,
  whatsappPhoneId: true,
  twilioWhatsAppNumber: true,
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

/** Twilio: route inbound webhook by To (business number the customer messaged). */
export async function resolveTenantFromTwilioAddress(
  address: string | undefined,
): Promise<ResolvedTenant | null> {
  if (!address) return null;
  const normalized = address.startsWith('whatsapp:')
    ? address
    : `whatsapp:${normalizeWaId(address)}`;
  return prisma.salon.findFirst({
    where: { twilioWhatsAppNumber: normalized, deletedAt: null },
    select: tenantSelect,
  });
}

/**
 * Resolve tenant for an inbound WhatsApp message.
 * Order: explicit Meta phone id → Twilio To.
 * No DEFAULT_SALON_SLUG fallback — unmatched identifiers return null.
 */
export async function resolveTenantForInbound(input: {
  metaPhoneNumberId?: string;
  twilioTo?: string;
}): Promise<ResolvedTenant | null> {
  if (input.metaPhoneNumberId) {
    const byMeta = await resolveTenantFromMetaPhoneId(input.metaPhoneNumberId);
    if (byMeta) return byMeta;

    // Env-level fallback: if META_PHONE_NUMBER_ID matches the inbound phone ID,
    // route to the salon with that whatsappPhoneId (or slug match for legacy single-tenant).
    if (env.META_PHONE_NUMBER_ID && input.metaPhoneNumberId === env.META_PHONE_NUMBER_ID) {
      const byEnvMeta = await resolveTenantFromMetaPhoneId(env.META_PHONE_NUMBER_ID);
      if (byEnvMeta) return byEnvMeta;
      logger.warn(
        { metaPhoneNumberId: input.metaPhoneNumberId },
        'meta_phone_id_env_match_but_no_tenant_in_db',
      );
    }

    const isSameAsMetaId = input.twilioTo === input.metaPhoneNumberId;
    if (!input.twilioTo || isSameAsMetaId) return null;
  }

  if (input.twilioTo) {
    const byTwilio = await resolveTenantFromTwilioAddress(input.twilioTo);
    if (byTwilio) return byTwilio;
    logger.error(
      { twilioTo: input.twilioTo },
      'twilio_inbound_no_tenant_for_to_number',
    );
    return null;
  }

  logger.warn('inbound_whatsapp_no_routing_identifier');
  return null;
}

export function assertTenantActive(tenant: ResolvedTenant): void {
  if (tenant.status === 'CHURNED') {
    throw new Error('tenant_inactive');
  }
}

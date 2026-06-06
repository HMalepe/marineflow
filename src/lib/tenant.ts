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
 */
export async function resolveTenantForInbound(input: {
  metaPhoneNumberId?: string;
  twilioTo?: string;
}): Promise<ResolvedTenant | null> {
  if (input.metaPhoneNumberId) {
    const byMeta = await resolveTenantFromMetaPhoneId(input.metaPhoneNumberId);
    if (byMeta) return byMeta;
  }
  if (input.twilioTo) {
    const byTwilio = await resolveTenantFromTwilioAddress(input.twilioTo);
    if (byTwilio) return byTwilio;
  }
  return findSalonBySlug(env.DEFAULT_SALON_SLUG);
}

export function assertTenantActive(tenant: ResolvedTenant): void {
  if (tenant.status === 'CHURNED') {
    throw new Error('tenant_inactive');
  }
}

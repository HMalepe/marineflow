import { prisma } from './prisma.js';
import { logger } from './logger.js';

const ACTIVE_STATUSES = ['TRIAL', 'ACTIVE', 'PAST_DUE'] as const;

/** Warn at startup when live tenants lack a WhatsApp routing number. */
export async function warnTenantsMissingWhatsAppNumber(): Promise<void> {
  const missing = await prisma.salon.findMany({
    where: {
      deletedAt: null,
      status: { in: [...ACTIVE_STATUSES] },
      twilioWhatsAppNumber: null,
      whatsappPhoneId: null,
    },
    select: { id: true, name: true, slug: true, status: true },
  });

  if (missing.length === 0) {
    logger.info('tenant_whatsapp_routing_ok — all active tenants have a WhatsApp number or Cloud phone id');
    return;
  }

  for (const s of missing) {
    logger.warn(
      { salonId: s.id, slug: s.slug, name: s.name, status: s.status },
      'ghost_tenant_no_whatsapp_number — assign twilioWhatsAppNumber in admin or run backfill',
    );
  }
}

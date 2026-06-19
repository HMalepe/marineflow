/**
 * One-off backfill: assign TWILIO_WHATSAPP_FROM to tenants missing twilioWhatsAppNumber.
 * Invoked automatically after `prisma migrate deploy` (see scripts/migrate-deploy.sh).
 * Safe to re-run — only updates rows where twilioWhatsAppNumber IS NULL.
 */
import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';
import { normalizeTwilioWhatsAppFrom } from '../src/lib/salonDefaults.js';

async function main(): Promise<void> {
  const raw = process.env.TWILIO_WHATSAPP_FROM?.trim();
  if (!raw) {
    console.log('[backfill-whatsapp] TWILIO_WHATSAPP_FROM not set — skipping backfill');
    return;
  }

  const number = normalizeTwilioWhatsAppFrom(raw);
  const tenants = await prisma.salon.findMany({
    where: { deletedAt: null, twilioWhatsAppNumber: null },
    select: { id: true, name: true, slug: true },
    orderBy: { createdAt: 'asc' },
  });

  if (tenants.length === 0) {
    console.log('[backfill-whatsapp] All active tenants already have twilioWhatsAppNumber — nothing to do');
    return;
  }

  console.log(
    `[backfill-whatsapp] Assigning ${number} to ${tenants.length} tenant(s) missing a WhatsApp number`,
  );

  for (const tenant of tenants) {
    await prisma.salon.update({
      where: { id: tenant.id },
      data: { twilioWhatsAppNumber: number },
    });
    console.log(
      `[backfill-whatsapp] ✓ ${tenant.name} (slug=${tenant.slug}, id=${tenant.id}) → ${number}`,
    );
  }

  console.log('[backfill-whatsapp] Backfill complete');
}

main()
  .catch((err) => {
    console.error('[backfill-whatsapp] FAILED:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

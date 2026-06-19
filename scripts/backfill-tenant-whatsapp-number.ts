/**
 * One-off backfill: assign the live Solupair WhatsApp sender to the oldest tenant
 * that has no twilioWhatsAppNumber yet.
 *
 * Invoked automatically after `prisma migrate deploy` (see scripts/migrate-deploy.sh).
 * Safe to re-run — only updates one row where twilioWhatsAppNumber IS NULL.
 *
 * Production default: whatsapp:+27624760899 (Solupair / current TWILIO_WHATSAPP_FROM).
 * Override with TWILIO_WHATSAPP_FROM for local/dev only.
 */
import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';
import { normalizeTwilioWhatsAppFrom } from '../src/lib/salonDefaults.js';

/** Live tenant sender — matches Railway TWILIO_WHATSAPP_FROM today. */
const LIVE_SENDER_DEFAULT = 'whatsapp:+27624760899';

async function main(): Promise<void> {
  const raw = process.env.TWILIO_WHATSAPP_FROM?.trim() || LIVE_SENDER_DEFAULT;
  const number = normalizeTwilioWhatsAppFrom(raw);

  const tenant = await prisma.salon.findFirst({
    where: { deletedAt: null, twilioWhatsAppNumber: null },
    select: { id: true, name: true, slug: true },
    orderBy: { createdAt: 'asc' },
  });

  if (!tenant) {
    console.log('[backfill-whatsapp] All active tenants already have twilioWhatsAppNumber — nothing to do');
    return;
  }

  const alreadyAssigned = await prisma.salon.findFirst({
    where: { twilioWhatsAppNumber: number, deletedAt: null },
    select: { id: true, slug: true },
  });
  if (alreadyAssigned && alreadyAssigned.id !== tenant.id) {
    console.error(
      `[backfill-whatsapp] ABORT: ${number} is already assigned to slug=${alreadyAssigned.slug}. ` +
        `Assign ${tenant.slug} manually in Super Admin (e.g. whatsapp:+27789512426 for Selantra).`,
    );
    process.exitCode = 1;
    return;
  }

  await prisma.salon.update({
    where: { id: tenant.id },
    data: { twilioWhatsAppNumber: number },
  });

  console.log('[backfill-whatsapp] Backfill complete');
  console.log(`[backfill-whatsapp] ✓ ${tenant.name} (slug=${tenant.slug}, id=${tenant.id}) → ${number}`);
  console.log(
    '[backfill-whatsapp] Assign other tenants via Super Admin → e.g. Selantra → whatsapp:+27789512426',
  );
}

main()
  .catch((err) => {
    console.error('[backfill-whatsapp] FAILED:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

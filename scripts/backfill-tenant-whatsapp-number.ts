/**
 * One-off migration helper: copy TWILIO_WHATSAPP_FROM into the oldest tenant
 * that has no twilioWhatsAppNumber yet.
 *
 * Invoked after `prisma migrate deploy` (see scripts/migrate-deploy.sh).
 * Skips when TWILIO_WHATSAPP_FROM is unset — in production each tenant's number
 * is assigned in Super Admin (one unique number per business).
 */
import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';
import { normalizeTwilioWhatsAppFrom, parseTwilioWhatsAppNumber } from '../src/lib/salonDefaults.js';
import { normalizeWaId } from '../src/lib/phone.js';

async function findTenantWithDigits(digits: string, excludeId?: string) {
  const salons = await prisma.salon.findMany({
    where: {
      deletedAt: null,
      twilioWhatsAppNumber: { not: null },
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true, name: true, slug: true, twilioWhatsAppNumber: true },
  });
  return salons.find(
    (s) => s.twilioWhatsAppNumber && normalizeWaId(s.twilioWhatsAppNumber) === digits,
  );
}

async function main(): Promise<void> {
  const raw = process.env.TWILIO_WHATSAPP_FROM?.trim();
  if (!raw) {
    console.log(
      '[backfill-whatsapp] TWILIO_WHATSAPP_FROM not set — skipping. Assign each tenant in Super Admin.',
    );
    return;
  }

  const number = parseTwilioWhatsAppNumber(raw) ?? normalizeTwilioWhatsAppFrom(raw);
  const digits = normalizeWaId(number);

  const tenant = await prisma.salon.findFirst({
    where: { deletedAt: null, twilioWhatsAppNumber: null },
    select: { id: true, name: true, slug: true },
    orderBy: { createdAt: 'asc' },
  });

  if (!tenant) {
    console.log('[backfill-whatsapp] All active tenants already have twilioWhatsAppNumber — nothing to do');
    return;
  }

  const alreadyAssigned = await findTenantWithDigits(digits);
  if (alreadyAssigned && alreadyAssigned.id !== tenant.id) {
    console.error(
      `[backfill-whatsapp] ABORT: ${number} is already assigned to ${alreadyAssigned.name} (slug=${alreadyAssigned.slug}). ` +
        `Assign ${tenant.slug} a different number in Super Admin.`,
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
  console.log('[backfill-whatsapp] Assign every other tenant its own number in Super Admin — one number per business.');
}

main()
  .catch((err) => {
    console.error('[backfill-whatsapp] FAILED:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

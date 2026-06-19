import { prisma } from './prisma.js';
import { normalizeLoginPhone, normalizeWaId } from './phone.js';
import { findTwilioSenderByPhone, isTwilioRegisteredWhatsAppNumber } from './twilioSenders.js';

/** Find salon linked to a Twilio-registered WhatsApp business number. */
export async function findSalonByWhatsAppPhone(phoneE164: string) {
  if (!(await isTwilioRegisteredWhatsAppNumber(phoneE164))) {
    return null;
  }

  const targetDigits = normalizeWaId(phoneE164);
  const salons = await prisma.salon.findMany({
    where: { deletedAt: null, twilioWhatsAppNumber: { not: null } },
    select: {
      id: true,
      name: true,
      slug: true,
      twilioWhatsAppNumber: true,
    },
  });

  return (
    salons.find(
      (s) => s.twilioWhatsAppNumber && normalizeWaId(s.twilioWhatsAppNumber) === targetDigits,
    ) ?? null
  );
}

export function isValidSaLoginPhone(phoneE164: string): boolean {
  return /^\+27\d{9}$/.test(normalizeLoginPhone(phoneE164));
}

export function validateStrongPassword(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (!/[a-z]/i.test(password)) return 'Password must include a letter';
  if (!/\d/.test(password)) return 'Password must include a number';
  return null;
}

/** Synthetic email for phone-only owners (email column is required). */
export function ownerEmailForSalon(slug: string): string {
  return `owner+${slug}@marineflow.local`;
}

export { findTwilioSenderByPhone, isTwilioRegisteredWhatsAppNumber };

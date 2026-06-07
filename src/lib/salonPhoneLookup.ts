import { prisma } from './prisma.js';
import { normalizeLoginPhone, normalizeWaId } from './phone.js';

export function phonesMatch(a: string | null | undefined, b: string): boolean {
  if (!a?.trim()) return false;
  return normalizeWaId(a) === normalizeWaId(b);
}

/** Find salon whose registered WhatsApp business number matches E.164 phone. */
export async function findSalonByWhatsAppPhone(phoneE164: string) {
  const targetDigits = normalizeWaId(phoneE164);
  const salons = await prisma.salon.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      name: true,
      slug: true,
      twilioWhatsAppFrom: true,
      phoneDisplay: true,
    },
  });

  return (
    salons.find(
      (s) =>
        (s.twilioWhatsAppFrom && normalizeWaId(s.twilioWhatsAppFrom) === targetDigits) ||
        phonesMatch(s.phoneDisplay, phoneE164),
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

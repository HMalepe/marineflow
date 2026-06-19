/** Mon–Sat 9:00–17:00; Sunday omitted (closed). dayOfWeek: 0=Sun … 6=Sat */
export const DEFAULT_BUSINESS_HOURS = [
  { dayOfWeek: 1, openMin: 9 * 60, closeMin: 17 * 60 },
  { dayOfWeek: 2, openMin: 9 * 60, closeMin: 17 * 60 },
  { dayOfWeek: 3, openMin: 9 * 60, closeMin: 17 * 60 },
  { dayOfWeek: 4, openMin: 9 * 60, closeMin: 17 * 60 },
  { dayOfWeek: 5, openMin: 9 * 60, closeMin: 17 * 60 },
  { dayOfWeek: 6, openMin: 9 * 60, closeMin: 17 * 60 },
] as const;

export function isValidSalonSlug(slug: string): boolean {
  return /^[a-z0-9-]+$/.test(slug);
}

export function slugifySalonName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function normalizeTwilioWhatsAppFrom(input: string): string {
  const trimmed = input.trim();
  if (trimmed.toLowerCase().startsWith('whatsapp:')) return trimmed;
  const digits = trimmed.replace(/\D/g, '');
  return `whatsapp:+${digits}`;
}

/** Canonical Twilio WhatsApp address format for tenant routing. */
export const TWILIO_WHATSAPP_NUMBER_REGEX = /^whatsapp:\+\d{10,15}$/;

/** Normalize and validate a tenant WhatsApp number; returns null if invalid. */
export function parseTwilioWhatsAppNumber(input: string): string | null {
  const normalized = normalizeTwilioWhatsAppFrom(input);
  return TWILIO_WHATSAPP_NUMBER_REGEX.test(normalized) ? normalized : null;
}

/** Platform assistant branding — editable only via super admin. */
export const DEFAULT_BOT_NAME = 'Marine';

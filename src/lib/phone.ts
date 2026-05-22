/** Normalize Twilio WhatsApp From/To to E.164 without whatsapp: prefix. */
export function normalizeWaId(from: string): string {
  const s = from.replace(/^whatsapp:/i, '').trim();
  return s;
}

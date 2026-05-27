/** Normalize WhatsApp sender to plain E.164 digits (no + or whatsapp: prefix).
 * Handles all common variants:
 *   whatsapp:+27821234567  →  27821234567
 *   +27 82 123 4567        →  27821234567
 *   27821234567            →  27821234567
 *   0821234567             →  27821234567  (SA local format auto-prefixed)
 */
export function normalizeWaId(from: string): string {
  // Strip whatsapp: prefix, then collapse every non-digit character
  let s = from.replace(/^whatsapp:/i, '').replace(/\D/g, '');
  // South-African local format: 0XXXXXXXXX (10 digits) → 27XXXXXXXXX
  if (s.startsWith('0') && s.length === 10) {
    s = '27' + s.slice(1);
  }
  return s;
}

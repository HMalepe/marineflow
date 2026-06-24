/** Default upset / complaint phrases — persisted per salon in Salon.metadata on first use. */
export const DEFAULT_SUPPORT_TICKET_KEYWORDS: readonly string[] = [
  'angry',
  'furious',
  'livid',
  'outraged',
  'unhappy',
  'upset',
  'disappointed',
  'frustrated',
  'disgusted',
  'unacceptable',
  'terrible',
  'awful',
  'horrible',
  'worst',
  'disgrace',
  'disgraceful',
  'incompetent',
  'useless',
  'pathetic',
  'rude',
  'disrespect',
  'insulted',
  'complain',
  'complaint',
  'complaining',
  'not happy',
  'never again',
  'waste of money',
  'rip off',
  'ripoff',
  'scam',
  'refund',
  'lawyer',
  'legal action',
  'sue',
  'report you',
  'appalling',
  'disaster',
  'unprofessional',
  'disappointed',
  'fed up',
  'sick of',
  'had enough',
] as const;

const METADATA_KEY = 'supportTicketKeywords';

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

export function parseSupportTicketKeywordsFromMetadata(metadata: unknown): string[] {
  if (!isRecord(metadata)) return [];
  const raw = metadata[METADATA_KEY];
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const phrase = item.trim().toLowerCase();
    if (phrase.length >= 2 && phrase.length <= 64) out.push(phrase);
  }
  return [...new Set(out)];
}

export function mergeSupportTicketKeywordsIntoMetadata(
  metadata: unknown,
  keywords: string[],
): Record<string, unknown> {
  const base = isRecord(metadata) ? { ...metadata } : {};
  base[METADATA_KEY] = keywords;
  return base;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Case-insensitive phrase match (word boundary for single words, substring for phrases). */
export function matchesSupportTicketKeywords(text: string, keywords: string[]): boolean {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return false;

  for (const keyword of keywords) {
    const phrase = keyword.trim().toLowerCase();
    if (!phrase) continue;
    if (phrase.includes(' ')) {
      if (normalized.includes(phrase)) return true;
      continue;
    }
    const re = new RegExp(`\\b${escapeRegex(phrase)}\\b`, 'i');
    if (re.test(normalized)) return true;
  }
  return false;
}

import indexJson from './dashboard-search-index.json';

export type DashboardSearchEntry = {
  id: string;
  label: string;
  href: string;
  group: string;
  description: string;
  keywords: string[];
  aliases: string[];
  ownerOnly?: boolean;
  adminOnly?: boolean;
};

export const DASHBOARD_SEARCH_INDEX = indexJson as DashboardSearchEntry[];

export function visibleSearchEntries(input: {
  isAdmin: boolean;
  isOwner: boolean;
}): DashboardSearchEntry[] {
  return DASHBOARD_SEARCH_INDEX.filter((entry) => {
    if (entry.adminOnly && !input.isAdmin) return false;
    if (entry.ownerOnly && !input.isOwner && !input.isAdmin) return false;
    return true;
  });
}

export type DashboardSearchResult = {
  id: string;
  label: string;
  href: string;
  group: string;
  description: string;
  score: number;
  reason?: string;
  source: 'local' | 'ai';
};

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const next = Math.min(row[j]! + 1, prev + 1, row[j - 1]! + cost);
      row[j - 1] = prev;
      prev = next;
    }
    row[b.length] = prev;
  }
  return row[b.length]!;
}

function fuzzyTokenMatch(token: string, candidate: string): number {
  if (!token || !candidate) return 0;
  if (candidate.includes(token)) return 10;
  if (token.length >= 3 && candidate.startsWith(token)) return 8;
  if (token.length >= 4 && candidate.length >= 4) {
    const dist = levenshtein(token, candidate);
    const limit = Math.max(1, Math.floor(Math.min(token.length, candidate.length) * 0.34));
    if (dist <= limit) return 7 - dist;
  }
  return 0;
}

function scoreEntry(query: string, entry: DashboardSearchEntry): number {
  const q = normalize(query);
  if (!q) return 0;

  const tokens = q.split(' ').filter(Boolean);
  const fields = [
    entry.label,
    entry.description,
    entry.id,
    entry.group,
    ...entry.keywords,
    ...entry.aliases,
  ].map(normalize);

  let score = 0;
  for (const token of tokens) {
    let best = 0;
    for (const field of fields) {
      if (field === token) best = Math.max(best, 14);
      if (field.startsWith(token)) best = Math.max(best, 12);
      if (field.includes(token)) best = Math.max(best, 10);
      for (const word of field.split(' ')) {
        best = Math.max(best, fuzzyTokenMatch(token, word));
      }
    }
    score += best;
  }

  if (normalize(entry.label) === q) score += 20;
  if (normalize(entry.label).startsWith(q)) score += 8;
  return score;
}

export function localDashboardSearch(
  query: string,
  entries: DashboardSearchEntry[],
  limit = 8,
): DashboardSearchResult[] {
  const q = query.trim();
  if (!q) {
    return entries.slice(0, limit).map((entry) => ({
      id: entry.id,
      label: entry.label,
      href: entry.href,
      group: entry.group,
      description: entry.description,
      score: 1,
      source: 'local' as const,
    }));
  }

  return entries
    .map((entry) => ({
      id: entry.id,
      label: entry.label,
      href: entry.href,
      group: entry.group,
      description: entry.description,
      score: scoreEntry(q, entry),
      source: 'local' as const,
    }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
    .slice(0, limit);
}

export type DashboardSearchResponse = {
  query: string;
  interpretedAs?: string;
  results: DashboardSearchResult[];
  suggestions: string[];
  aiUsed: boolean;
};

export function buildLocalSuggestions(query: string, results: DashboardSearchResult[]): string[] {
  if (!query.trim()) {
    return ['Try “roster”, “FAQ”, or “newsletter”'];
  }
  if (results.length === 0) {
    return ['Check spelling or try “settings”, “staff”, or “customers”'];
  }
  const top = results[0];
  return top ? [`Open ${top.label}`, 'Try a shorter keyword like “staff” or “hours”'] : [];
}

export function localDashboardSearchResponse(
  query: string,
  input: { isAdmin: boolean; isOwner: boolean },
): DashboardSearchResponse {
  const entries = visibleSearchEntries(input);
  const results = localDashboardSearch(query, entries, 8);
  return {
    query: query.trim(),
    results,
    suggestions: buildLocalSuggestions(query, results),
    aiUsed: false,
  };
}

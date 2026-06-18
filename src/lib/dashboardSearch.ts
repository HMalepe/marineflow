import { claudeJson, isAnthropicConfigured } from './integrations/ai/claude.js';
import {
  visibleSearchEntries,
  type DashboardSearchEntry,
} from './dashboardSearchIndex.js';

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

export type DashboardSearchResponse = {
  query: string;
  interpretedAs?: string;
  results: DashboardSearchResult[];
  suggestions: string[];
  aiUsed: boolean;
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

type AiSearchPayload = {
  matchIds?: string[];
  interpretedAs?: string;
  suggestions?: string[];
};

export async function searchDashboard(input: {
  query: string;
  isAdmin: boolean;
  isOwner: boolean;
}): Promise<DashboardSearchResponse> {
  const query = input.query.trim();
  const entries = visibleSearchEntries(input);
  const localResults = localDashboardSearch(query, entries, 8);

  if (!query || query.length < 2 || !isAnthropicConfigured()) {
    return {
      query,
      results: localResults,
      suggestions: buildLocalSuggestions(query, localResults),
      aiUsed: false,
    };
  }

  const catalog = entries.map((e) => ({
    id: e.id,
    label: e.label,
    group: e.group,
    description: e.description,
    keywords: e.keywords.slice(0, 8),
  }));

  const ai = await claudeJson<AiSearchPayload>({
    system: `You help MarineFlow dashboard users find pages and settings. The user query may contain typos or informal wording. Pick the best matching destination IDs from the catalog only. Return strict JSON.`,
    user: `Catalog:\n${JSON.stringify(catalog)}\n\nUser query: "${query}"\n\nReturn JSON:\n{\n  "matchIds": ["id1", "id2"],\n  "interpretedAs": "short phrase for what they meant",\n  "suggestions": ["optional follow-up action 1", "optional 2"]\n}\n\nRules:\n- matchIds: up to 6 IDs from catalog, best first\n- suggestions: up to 3 short helpful next steps\n- only use IDs that exist in the catalog`,
    maxTokens: 512,
  });

  if (!ai?.matchIds?.length) {
    return {
      query,
      interpretedAs: ai?.interpretedAs,
      results: localResults,
      suggestions: ai?.suggestions?.slice(0, 3) ?? buildLocalSuggestions(query, localResults),
      aiUsed: false,
    };
  }

  const byId = new Map(entries.map((e) => [e.id, e]));
  const localById = new Map(localResults.map((r) => [r.id, r]));
  const merged: DashboardSearchResult[] = [];
  const seen = new Set<string>();

  for (const [idx, id] of ai.matchIds.entries()) {
    const entry = byId.get(id);
    if (!entry || seen.has(id)) continue;
    seen.add(id);
    const local = localById.get(id);
    merged.push({
      id: entry.id,
      label: entry.label,
      href: entry.href,
      group: entry.group,
      description: entry.description,
      score: 100 - idx * 5 + (local?.score ?? 0),
      reason: ai.interpretedAs,
      source: 'ai',
    });
  }

  for (const local of localResults) {
    if (seen.has(local.id)) continue;
    merged.push(local);
    if (merged.length >= 8) break;
  }

  return {
    query,
    interpretedAs: ai.interpretedAs,
    results: merged.slice(0, 8),
    suggestions: ai.suggestions?.slice(0, 3) ?? buildLocalSuggestions(query, merged),
    aiUsed: true,
  };
}

function buildLocalSuggestions(query: string, results: DashboardSearchResult[]): string[] {
  if (!query.trim()) {
    return ['Try “roster”, “FAQ”, or “newsletter”'];
  }
  if (results.length === 0) {
    return ['Check spelling or try “settings”, “staff”, or “customers”'];
  }
  const top = results[0];
  return top ? [`Open ${top.label}`, 'Try a shorter keyword like “staff” or “hours”'] : [];
}

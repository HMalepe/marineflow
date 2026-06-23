const STORAGE_KEY = 'marineflow:pinned-conversations';

export function loadPinnedConversationIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === 'string'));
  } catch {
    return new Set();
  }
}

export function savePinnedConversationIds(ids: Set<string>): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
}

export function togglePinnedConversationId(id: string): Set<string> {
  const next = loadPinnedConversationIds();
  if (next.has(id)) next.delete(id);
  else next.add(id);
  savePinnedConversationIds(next);
  return next;
}

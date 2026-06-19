'use client';

import { useEffect, useState } from 'react';

const POLL_MS = 30_000;

/**
 * Polls the "Needs you" conversation count for sidebar / nav badges.
 * Maps to HANDOFF conversations with resolvedAt IS NULL (NEEDS_HUMAN).
 */
export function useHandoffCount(initialCount = 0): number {
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    setCount(initialCount);
  }, [initialCount]);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch('/api/conversations/handoff-count', { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as { count?: number };
        if (!cancelled) setCount(data.count ?? 0);
      } catch {
        // badge is non-critical
      }
    }

    void poll();
    const id = setInterval(() => void poll(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return count;
}

'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { CollapsedAttention } from '@/components/collapsed-attention';

type AttentionEntry = Pick<CollapsedAttention, 'count' | 'label' | 'severity'>;

type AttentionContextValue = {
  register: (id: string, entry: AttentionEntry) => void;
  unregister: (id: string) => void;
};

const CollapsibleAttentionContext = createContext<AttentionContextValue | null>(null);

export function CollapsibleSectionAttentionProvider({
  children,
  onAggregateChange,
}: {
  children: ReactNode;
  onAggregateChange: (total: number, worstSeverity: CollapsedAttention['severity']) => void;
}) {
  const [entries, setEntries] = useState<Map<string, AttentionEntry>>(new Map());

  const register = useCallback((id: string, entry: AttentionEntry) => {
    setEntries((prev) => {
      const next = new Map(prev);
      next.set(id, entry);
      return next;
    });
  }, []);

  const unregister = useCallback((id: string) => {
    setEntries((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const value = useMemo(() => ({ register, unregister }), [register, unregister]);

  useEffect(() => {
    let total = 0;
    let worstSeverity: CollapsedAttention['severity'] = 'warning';
    entries.forEach((entry) => {
      total += entry.count;
      if (entry.severity === 'critical') worstSeverity = 'critical';
    });
    onAggregateChange(total, worstSeverity);
  }, [entries, onAggregateChange]);

  return (
    <CollapsibleAttentionContext.Provider value={value}>
      {children}
    </CollapsibleAttentionContext.Provider>
  );
}

/** Register actionable items inside a collapsible section body. */
export function CollapsibleAttention({
  count = 1,
  label,
  severity,
}: AttentionEntry) {
  const id = useId();
  const ctx = useContext(CollapsibleAttentionContext);

  useEffect(() => {
    if (!ctx || count <= 0) return;
    ctx.register(id, { count, label, severity });
    return () => ctx.unregister(id);
  }, [count, ctx, id, label, severity]);

  return null;
}

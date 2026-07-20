'use client';

import { useCallback, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  CollapsedAttentionBadge,
  resolveCollapsedAttention,
  type CollapsedAttention,
} from '@/components/collapsed-attention';
import { CollapsibleSectionAttentionProvider } from '@/components/collapsible-section-attention';
import { cn } from '@/lib/utils';

export type { CollapsedAttention };

interface CollapsibleSectionProps {
  title: string;
  subtitle?: string;
  count?: number | string;
  /** Action items needing owner attention — drives the collapsed notification badge. */
  actionCount?: number;
  actionLabel?: string;
  actionBadgeText?: string;
  actionSeverity?: CollapsedAttention['severity'];
  /** Shown on the header bar while the section is collapsed — overrides actionCount when set. */
  collapsedAttention?: CollapsedAttention;
  children: ReactNode;
  id?: string;
  className?: string;
  defaultOpen?: boolean;
  action?: ReactNode;
}

function storageKey(id: string): string {
  return `dashboard-collapsible:${id}`;
}

function readPersistedOpen(id: string | undefined, fallback: boolean): boolean {
  if (!id || typeof window === 'undefined') return fallback;
  try {
    const stored = window.localStorage.getItem(storageKey(id));
    return stored === null ? fallback : stored === '1';
  } catch {
    return fallback;
  }
}

export function CollapsibleSection({
  title,
  subtitle,
  count,
  actionCount,
  actionLabel,
  actionBadgeText,
  actionSeverity,
  collapsedAttention,
  children,
  id,
  className,
  defaultOpen = true,
  action,
}: CollapsibleSectionProps) {
  const [open, setOpenState] = useState(() => readPersistedOpen(id, defaultOpen));
  const setOpen = useCallback(
    (updater: boolean | ((prev: boolean) => boolean)) => {
      setOpenState((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        if (id && typeof window !== 'undefined') {
          try {
            window.localStorage.setItem(storageKey(id), next ? '1' : '0');
          } catch {
            // Private browsing / quota exceeded — toggle still works in-memory this session
          }
        }
        return next;
      });
    },
    [id],
  );
  const [contextCount, setContextCount] = useState(0);
  const [contextSeverity, setContextSeverity] =
    useState<CollapsedAttention['severity']>('warning');

  const handleAggregateChange = useCallback(
    (total: number, severity: CollapsedAttention['severity']) => {
      setContextCount(total);
      setContextSeverity(severity);
    },
    [],
  );

  const resolvedAttention = resolveCollapsedAttention(
    collapsedAttention,
    actionCount,
    contextCount,
    {
      label: actionLabel,
      badgeText: actionBadgeText,
      severity: collapsedAttention?.severity ?? actionSeverity ?? contextSeverity,
    },
  );

  return (
    <section
      id={id}
      data-section-label={title}
      className={cn('dashboard-section dashboard-section-collapsible dashboard-section-anchor', className)}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="dashboard-section-header dashboard-section-header-toggle group w-full text-left touch-manipulation"
        aria-expanded={open}
        aria-controls={id ? `${id}-panel` : undefined}
      >
        <span className="dashboard-section-accent" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="dashboard-section-title">{title}</h2>
            {count !== undefined && open && (
              <span className="dashboard-section-count">{count}</span>
            )}
            {!open && resolvedAttention && resolvedAttention.count > 0 && (
              <CollapsedAttentionBadge attention={resolvedAttention} />
            )}
          </div>
          {subtitle && (
            <p className={cn('dashboard-section-subtitle', !open && 'hidden')}>
              {subtitle}
            </p>
          )}
        </div>
        {action && (
          <div
            className="shrink-0"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {action}
          </div>
        )}
        <span
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-full border transition-colors',
            open
              ? 'border-primary/30 bg-primary/10 text-primary'
              : 'border-border bg-muted/70 text-muted-foreground group-hover:bg-muted group-hover:text-foreground',
          )}
          aria-hidden
        >
          <ChevronDown
            className={cn('size-5 transition-transform duration-200', open && 'rotate-180')}
          />
        </span>
      </button>
      <CollapsibleSectionAttentionProvider onAggregateChange={handleAggregateChange}>
        <div
          id={id ? `${id}-panel` : undefined}
          className={cn('dashboard-section-body', !open && 'hidden')}
        >
          {children}
        </div>
      </CollapsibleSectionAttentionProvider>
    </section>
  );
}

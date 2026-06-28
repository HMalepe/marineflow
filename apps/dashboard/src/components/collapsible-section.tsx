'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
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
  /** @deprecated All sections are collapsible on every screen size. Kept for callers that passed it. */
  collapseOnMobile?: boolean;
  defaultOpen?: boolean;
  action?: ReactNode;
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
  collapseOnMobile = false,
  defaultOpen = true,
  action,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [contextCount, setContextCount] = useState(0);
  const [contextSeverity, setContextSeverity] =
    useState<CollapsedAttention['severity']>('warning');

  useEffect(() => {
    if (collapseOnMobile && window.matchMedia('(max-width: 767px)').matches) {
      setOpen(false);
    }
  }, [collapseOnMobile]);

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
        className="dashboard-section-header dashboard-section-header-toggle w-full text-left touch-manipulation"
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
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition-transform duration-200',
            open && 'rotate-180',
          )}
          aria-hidden
        />
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

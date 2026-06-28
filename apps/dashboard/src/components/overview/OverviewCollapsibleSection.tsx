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
import { OverviewSectionLabel } from './OverviewSectionLabel';
import { overviewSection } from './overviewNeon';

interface OverviewCollapsibleSectionProps {
  id: string;
  label: string;
  title?: string;
  subtitle?: string;
  actionCount?: number;
  actionLabel?: string;
  actionBadgeText?: string;
  actionSeverity?: CollapsedAttention['severity'];
  collapsedAttention?: CollapsedAttention;
  children: ReactNode;
  className?: string;
  defaultOpen?: boolean;
  trailing?: ReactNode;
}

/** Overview page section with neon styling and collapsible toggle. */
export function OverviewCollapsibleSection({
  id,
  label,
  title,
  subtitle,
  actionCount,
  actionLabel,
  actionBadgeText,
  actionSeverity,
  collapsedAttention,
  children,
  className,
  defaultOpen = true,
  trailing,
}: OverviewCollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
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
      data-section-label={label}
      className={overviewSection(cn('dashboard-section-collapsible', className))}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="overview-section-heading flex w-full items-end justify-between gap-3 text-left touch-manipulation"
        aria-expanded={open}
        aria-controls={`${id}-panel`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <OverviewSectionLabel>{label}</OverviewSectionLabel>
            {!open && resolvedAttention && resolvedAttention.count > 0 && (
              <CollapsedAttentionBadge attention={resolvedAttention} />
            )}
          </div>
          {title && (
            <h2 className="text-lg font-bold tracking-tight mt-1">{title}</h2>
          )}
          {subtitle && (
            <p className={cn('text-xs font-medium text-muted-foreground mt-0.5', !open && 'hidden')}>
              {subtitle}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {trailing}
          <ChevronDown
            className={cn(
              'size-4 text-muted-foreground transition-transform duration-200',
              open && 'rotate-180',
            )}
            aria-hidden
          />
        </div>
      </button>
      <CollapsibleSectionAttentionProvider onAggregateChange={handleAggregateChange}>
        <div id={`${id}-panel`} className={cn('space-y-3', !open && 'hidden')}>
          {children}
        </div>
      </CollapsibleSectionAttentionProvider>
    </section>
  );
}

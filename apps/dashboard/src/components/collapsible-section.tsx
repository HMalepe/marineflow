'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export type CollapsedAttention = {
  count: number;
  label?: string;
  severity?: 'warning' | 'critical';
};

interface CollapsibleSectionProps {
  title: string;
  subtitle?: string;
  count?: number | string;
  /** Shown on the header bar while the section is collapsed — e.g. pending setup items. */
  collapsedAttention?: CollapsedAttention;
  children: ReactNode;
  id?: string;
  className?: string;
  /** @deprecated All sections are collapsible on every screen size. Kept for callers that passed it. */
  collapseOnMobile?: boolean;
  defaultOpen?: boolean;
  action?: ReactNode;
}

function CollapsedAttentionBadge({ attention }: { attention: CollapsedAttention }) {
  const severity = attention.severity ?? 'warning';
  const label =
    attention.label ??
    (attention.count === 1 ? '1 item needs action' : `${attention.count} items need action`);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide tabular-nums',
        severity === 'critical'
          ? 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300'
          : 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200',
      )}
      title={label}
    >
      <span className="relative flex size-2 shrink-0" aria-hidden>
        <span
          className={cn(
            'absolute inline-flex h-full w-full animate-ping rounded-full opacity-70',
            severity === 'critical' ? 'bg-red-400' : 'bg-amber-400',
          )}
        />
        <span
          className={cn(
            'relative inline-flex size-2 rounded-full',
            severity === 'critical' ? 'bg-red-500' : 'bg-amber-500',
          )}
        />
      </span>
      <span className="normal-case tracking-normal">{attention.count} to fix</span>
    </span>
  );
}

export function CollapsibleSection({
  title,
  subtitle,
  count,
  collapsedAttention,
  children,
  id,
  className,
  collapseOnMobile = false,
  defaultOpen = true,
  action,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    if (collapseOnMobile && window.matchMedia('(max-width: 767px)').matches) {
      setOpen(false);
    }
  }, [collapseOnMobile]);

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
            {count !== undefined && (
              <span className="dashboard-section-count">{count}</span>
            )}
            {!open &&
              collapsedAttention &&
              collapsedAttention.count > 0 && (
                <CollapsedAttentionBadge attention={collapsedAttention} />
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
      <div
        id={id ? `${id}-panel` : undefined}
        className={cn('dashboard-section-body', !open && 'hidden')}
      >
        {children}
      </div>
    </section>
  );
}

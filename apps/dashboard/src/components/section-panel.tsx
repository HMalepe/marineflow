'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SectionPanelProps {
  id?: string;
  title: string;
  subtitle?: string;
  count?: number | string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Tighter padding for dense lists (inbox, tables) */
  compact?: boolean;
  defaultOpen?: boolean;
}

/** Contained dashboard section — border, header rule, accent bar, collapsible toggle. */
export function SectionPanel({
  id,
  title,
  subtitle,
  count,
  action,
  children,
  className,
  bodyClassName,
  compact = false,
  defaultOpen = true,
}: SectionPanelProps) {
  const [open, setOpen] = useState(defaultOpen);

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
        className={cn(
          'dashboard-section-body',
          compact && 'dashboard-section-body-compact',
          bodyClassName,
          !open && 'hidden',
        )}
      >
        {children}
      </div>
    </section>
  );
}

interface DataListProps {
  children: ReactNode;
  className?: string;
}

/** Vertically stacked rows with explicit dividers between items. */
export function DataList({ children, className }: DataListProps) {
  return <div className={cn('dashboard-data-list', className)}>{children}</div>;
}

interface DataRowProps {
  children: ReactNode;
  className?: string;
}

export function DataRow({ children, className }: DataRowProps) {
  return <div className={cn('dashboard-data-row', className)}>{children}</div>;
}

interface PaneHeaderProps {
  title: string;
  trailing?: ReactNode;
  className?: string;
}

/** Inbox / split-pane column header */
export function PaneHeader({ title, trailing, className }: PaneHeaderProps) {
  return (
    <div className={cn('dashboard-pane-header', className)}>
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className="dashboard-pane-header-accent" aria-hidden />
        <span className="dashboard-pane-header-title">{title}</span>
      </div>
      {trailing}
    </div>
  );
}

import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

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
}

/** Contained dashboard section — border, header rule, accent bar. */
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
}: SectionPanelProps) {
  return (
    <section id={id} className={cn('dashboard-section', className)}>
      <div className="dashboard-section-header">
        <div className="dashboard-section-accent" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="dashboard-section-title">{title}</h2>
            {count !== undefined && (
              <span className="dashboard-section-count">{count}</span>
            )}
          </div>
          {subtitle && <p className="dashboard-section-subtitle">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className={cn('dashboard-section-body', compact && 'dashboard-section-body-compact', bodyClassName)}>
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

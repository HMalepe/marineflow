'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CollapsibleSectionProps {
  title: string;
  subtitle?: string;
  count?: number | string;
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

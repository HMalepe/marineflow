'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { OverviewSectionLabel } from './OverviewSectionLabel';
import { overviewSection } from './overviewNeon';

interface OverviewCollapsibleSectionProps {
  id: string;
  label: string;
  title?: string;
  subtitle?: string;
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
  children,
  className,
  defaultOpen = true,
  trailing,
}: OverviewCollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

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
          <OverviewSectionLabel>{label}</OverviewSectionLabel>
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
      <div id={`${id}-panel`} className={cn('space-y-3', !open && 'hidden')}>
        {children}
      </div>
    </section>
  );
}

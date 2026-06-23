'use client';

import { useState, type ReactNode } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobileFilterBarProps {
  /** Always visible — e.g. search field */
  primary: ReactNode;
  /** Hidden on mobile until user taps Filters */
  secondary: ReactNode;
  activeCount?: number;
  className?: string;
}

export function MobileFilterBar({ primary, secondary, activeCount = 0, className }: MobileFilterBarProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">{primary}</div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn(
            'md:hidden shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-2 min-h-[2.75rem] text-xs font-medium touch-manipulation transition-colors',
            open || activeCount > 0
              ? 'border-primary/40 bg-primary/5 text-primary'
              : 'border-border/60 text-muted-foreground hover:text-foreground',
          )}
          aria-expanded={open}
        >
          <SlidersHorizontal className="size-3.5" />
          Filters
          {activeCount > 0 && (
            <span className="rounded-full bg-primary text-primary-foreground px-1.5 py-0 text-[10px] font-semibold">
              {activeCount}
            </span>
          )}
        </button>
      </div>
      <div className={cn('hidden md:flex flex-wrap items-center gap-2', open && '!flex flex-col items-stretch')}>
        {secondary}
      </div>
    </div>
  );
}

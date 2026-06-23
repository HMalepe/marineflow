'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PremiumDisclosureProps {
  label: string;
  children: ReactNode;
  /** Show body expanded on md+ without a toggle */
  desktopOpen?: boolean;
  className?: string;
}

/** Secondary copy — collapsed by default on mobile to reduce noise. */
export function PremiumDisclosure({
  label,
  children,
  desktopOpen = false,
  className,
}: PremiumDisclosureProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className={cn('text-sm', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors touch-manipulation min-h-[2.25rem] md:hidden',
        )}
        aria-expanded={open}
      >
        <span className="text-primary/90 font-medium">{label}</span>
        <ChevronDown className={cn('size-3.5 transition-transform duration-200', open && 'rotate-180')} />
      </button>
      <div
        className={cn(
          'mt-2 text-muted-foreground leading-relaxed',
          !open && 'hidden md:block',
          desktopOpen && 'md:mt-1',
        )}
      >
        {children}
      </div>
    </div>
  );
}

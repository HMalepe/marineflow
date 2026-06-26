'use client';

import { useCallback, useEffect, useId, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'mf-nav-sections-expanded';

function readExpandedState(): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

function writeExpandedState(state: Record<string, boolean>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota / private mode
  }
}

interface CollapsibleNavSectionProps {
  label: string;
  /** When true, section starts expanded (also used when user has no saved preference). */
  defaultExpanded?: boolean;
  children: ReactNode;
  className?: string;
  /** Compact label style for mobile More sheet */
  variant?: 'sidebar' | 'sheet';
}

export function CollapsibleNavSection({
  label,
  defaultExpanded = false,
  children,
  className,
  variant = 'sidebar',
}: CollapsibleNavSectionProps) {
  const sectionId = useId();
  const [open, setOpen] = useState(defaultExpanded);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = readExpandedState();
    if (label in saved) {
      setOpen(saved[label]!);
    } else {
      setOpen(defaultExpanded);
    }
    setHydrated(true);
  }, [label, defaultExpanded]);

  const toggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      const saved = readExpandedState();
      saved[label] = next;
      writeExpandedState(saved);
      return next;
    });
  }, [label]);

  const labelClass =
    variant === 'sidebar'
      ? 'nav-section-label nav-section-label-toggle'
      : 'px-1 pb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 nav-section-label-toggle';

  return (
    <div className={cn('space-y-1', className)}>
      <button
        type="button"
        onClick={toggle}
        className={cn(
          labelClass,
          'w-full flex items-center justify-between gap-2 text-left touch-manipulation transition-colors hover:text-foreground',
        )}
        aria-expanded={open}
        aria-controls={sectionId}
      >
        <span>{label}</span>
        <ChevronDown
          className={cn(
            'size-3.5 shrink-0 text-muted-foreground transition-transform duration-200',
            open && 'rotate-180',
            !hydrated && 'opacity-0',
          )}
          aria-hidden
        />
      </button>
      <div
        id={sectionId}
        className={cn(
          'space-y-1 overflow-hidden transition-[max-height,opacity] duration-200',
          open ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0 pointer-events-none',
        )}
      >
        {children}
      </div>
    </div>
  );
}

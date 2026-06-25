'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CollapsibleSectionProps {
  title: ReactNode;
  subtitle?: ReactNode;
  count?: number | string;
  /** Extra content rendered in the header, left of the toggle (e.g. a score badge). */
  headerExtra?: ReactNode;
  children: ReactNode;
  id?: string;
  className?: string;
  collapseOnMobile?: boolean;
  defaultOpen?: boolean;
  /**
   * When true, the toggle is shown and works on every screen size (not just
   * mobile), and the collapsed state is remembered per section in
   * localStorage. Use this for the "ON THIS PAGE" sections that should be
   * collapsible on desktop too.
   */
  manualToggle?: boolean;
}

function collapseKey(id: string): string {
  return `dashboard-section-collapsed:${id}`;
}

function readPersistedOpen(id: string | undefined, fallback: boolean): boolean {
  if (!id || typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(collapseKey(id));
    if (raw === null) return fallback;
    return raw !== '1';
  } catch {
    return fallback;
  }
}

export function CollapsibleSection({
  title,
  subtitle,
  count,
  headerExtra,
  children,
  id,
  className,
  collapseOnMobile = false,
  defaultOpen = true,
  manualToggle = false,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    if (manualToggle) {
      setOpen(readPersistedOpen(id, defaultOpen));
      return;
    }
    if (collapseOnMobile && window.matchMedia('(max-width: 767px)').matches) {
      setOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collapseOnMobile, manualToggle]);

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      if (manualToggle && id) {
        try {
          if (next) localStorage.removeItem(collapseKey(id));
          else localStorage.setItem(collapseKey(id), '1');
        } catch {
          // ignore quota / private mode
        }
      }
      return next;
    });
  };

  const hiddenClass = manualToggle ? 'hidden' : 'hidden md:block';

  const showCollapsedBadge = manualToggle && !open;

  return (
    <section
      id={id}
      className={cn(
        'dashboard-section dashboard-section-collapsible',
        showCollapsedBadge && 'dashboard-section-collapsed',
        className,
      )}
    >
      <button
        type="button"
        onClick={toggle}
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
            {showCollapsedBadge && (
              <span className="dashboard-section-hidden-badge">
                Hidden{count !== undefined ? ` — ${count} item${count === 1 ? '' : 's'}` : ' — your data is still here'}
              </span>
            )}
          </div>
          {subtitle && (
            <p className={cn('dashboard-section-subtitle', !open && hiddenClass)}>
              {subtitle}
            </p>
          )}
        </div>
        {headerExtra}
        <span className={cn('dashboard-section-toggle-label', manualToggle ? '' : 'md:hidden')}>
          {open ? 'Hide' : 'Show'}
        </span>
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition-transform duration-200',
            manualToggle ? '' : 'md:hidden',
            open && 'rotate-180',
          )}
        />
      </button>
      <div
        id={id ? `${id}-panel` : undefined}
        className={cn(
          'dashboard-section-body',
          !open && hiddenClass,
        )}
      >
        {children}
      </div>
    </section>
  );
}

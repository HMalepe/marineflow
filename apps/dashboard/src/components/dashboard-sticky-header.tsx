'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import {
  SETTINGS_SECTION_LINKS,
  isNavItemActive,
  stickyHeaderNavGroups,
} from '@/lib/dashboard-nav';
import { useHandoffCount } from '@/components/Sidebar';
import { cn } from '@/lib/utils';

interface Props {
  isAdmin: boolean;
  isOwner: boolean;
  handoffCount?: number;
}

function HorizontalNav({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex gap-1 overflow-x-auto overscroll-x-contain scrollbar-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
    >
      {children}
    </div>
  );
}

function NavPill({
  href,
  label,
  active,
  badge,
}: {
  href: string;
  label: string;
  active: boolean;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap',
        active
          ? 'bg-gradient-to-b from-primary to-primary/85 text-primary-foreground shadow-[0_2px_8px_-2px_color-mix(in_oklch,var(--primary)_55%,transparent)]'
          : 'bg-muted/80 text-muted-foreground hover:bg-accent hover:text-accent-foreground',
      )}
    >
      {label}
      {badge != null && badge > 0 && (
        <span className="min-w-[16px] h-4 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center px-1">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </Link>
  );
}

function SectionAnchor({ id, label }: { id: string; label: string }) {
  return (
    <a
      href={`#${id}`}
      className="inline-flex shrink-0 items-center rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap bg-background/80 text-muted-foreground border border-border/60 hover:bg-accent hover:text-accent-foreground transition-colors"
    >
      {label}
    </a>
  );
}

export function DashboardStickyHeader({ isAdmin, isOwner, handoffCount = 0 }: Props) {
  const pathname = usePathname();
  const headerRef = useRef<HTMLElement>(null);
  const liveHandoffCount = useHandoffCount(handoffCount);
  const onSettings = pathname.startsWith('/settings');
  const groups = stickyHeaderNavGroups({ isAdmin, isOwner });

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;

    const syncOffset = () => {
      document.documentElement.style.setProperty('--dashboard-sticky-offset', `${el.offsetHeight}px`);
    };

    syncOffset();
    const observer = new ResizeObserver(syncOffset);
    observer.observe(el);
    window.addEventListener('resize', syncOffset);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', syncOffset);
      document.documentElement.style.removeProperty('--dashboard-sticky-offset');
    };
  }, [pathname, onSettings]);

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85 shadow-[0_1px_0_rgb(0_0_0/0.04),0_8px_20px_-16px_rgb(0_0_0/0.12)]"
    >
      {/* Main dashboard destinations — desktop */}
      <div className="hidden md:block px-4 sm:px-6 lg:px-8 py-2.5 border-b border-border/50">
        <HorizontalNav className="gap-2">
          {groups.map((group, groupIdx) => (
            <div key={group.title} className="flex items-center gap-1.5 shrink-0">
              {groupIdx > 0 && (
                <span className="text-border select-none px-0.5" aria-hidden>
                  |
                </span>
              )}
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 px-1 shrink-0">
                {group.title}
              </span>
              {group.items.map((item) => (
                <NavPill
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  active={isNavItemActive(pathname, item.href)}
                  badge={item.href === '/conversations' ? liveHandoffCount : undefined}
                />
              ))}
            </div>
          ))}
        </HorizontalNav>
      </div>

      {/* Settings in-page sections — all breakpoints */}
      {onSettings && (
        <div className="px-4 sm:px-6 lg:px-8 py-2 bg-muted/40">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 mb-1.5 md:mb-2">
            On this page
          </p>
          <HorizontalNav className="gap-1.5 pb-0.5">
            {SETTINGS_SECTION_LINKS.map((section) => (
              <SectionAnchor key={section.id} id={section.id} label={section.label} />
            ))}
          </HorizontalNav>
        </div>
      )}
    </header>
  );
}

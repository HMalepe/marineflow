'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ADMIN_NAV_ITEMS,
  isNavItemActive,
  SALON_OVERVIEW_ITEM,
  visibleSalonNavGroups,
} from '@/lib/dashboard-nav';
import { cn } from '@/lib/utils';
import type React from 'react';

interface NavLinksProps {
  isAdmin: boolean;
  isOwner: boolean;
  handoffCount?: number;
}

function NavSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 select-none">
        {label}
      </p>
      {children}
    </div>
  );
}

function NavItemLink({
  href,
  children,
  badge,
}: {
  href: string;
  children: React.ReactNode;
  badge?: number;
}) {
  const pathname = usePathname();
  const isActive = isNavItemActive(pathname, href);

  return (
    <Link
      href={href}
      className={cn(
        'flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors',
        isActive
          ? 'bg-primary/10 text-primary font-semibold'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
      )}
    >
      <span>{children}</span>
      {badge != null && badge > 0 && (
        <span className="ml-auto shrink-0 min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1 leading-none">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </Link>
  );
}

export function NavLinks({ isAdmin, isOwner, handoffCount = 0 }: NavLinksProps) {
  if (isAdmin) {
    return (
      <div className="space-y-4">
        <NavSection label="Platform">
          {ADMIN_NAV_ITEMS.filter((i) => ['/', '/agency', '/admin'].includes(i.href)).map((item) => (
            <NavItemLink key={item.href} href={item.href}>
              {item.label}
            </NavItemLink>
          ))}
        </NavSection>
        <NavSection label="Reports">
          {ADMIN_NAV_ITEMS.filter((i) => ['/analytics', '/billing'].includes(i.href)).map((item) => (
            <NavItemLink key={item.href} href={item.href}>
              {item.label}
            </NavItemLink>
          ))}
        </NavSection>
      </div>
    );
  }

  const groups = visibleSalonNavGroups(isOwner);

  return (
    <div className="space-y-4">
      <NavItemLink href={SALON_OVERVIEW_ITEM.href}>{SALON_OVERVIEW_ITEM.label}</NavItemLink>

      {groups.map((group) => (
        <NavSection key={group.title} label={group.title}>
          {group.items.map((item) => (
            <NavItemLink
              key={item.href}
              href={item.href}
              badge={item.href === '/conversations' ? handoffCount : undefined}
            >
              {item.label}
            </NavItemLink>
          ))}
        </NavSection>
      ))}
    </div>
  );
}

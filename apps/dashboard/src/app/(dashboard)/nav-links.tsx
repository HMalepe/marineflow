'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ADMIN_NAV_ITEMS,
  isNavItemActive,
  SALON_OVERVIEW_ITEM,
  visibleSalonNavGroups,
} from '@/lib/dashboard-nav';
import { useHandoffCount } from '@/components/Sidebar';
import { CollapsibleNavSection } from '@/components/collapsible-nav-section';
import { cn } from '@/lib/utils';
import type React from 'react';

interface NavLinksProps {
  isAdmin: boolean;
  isOwner: boolean;
  handoffCount?: number;
}

function NavSection({
  label,
  defaultExpanded,
  children,
}: {
  label: string;
  defaultExpanded?: boolean;
  children: React.ReactNode;
}) {
  return (
    <CollapsibleNavSection label={label} defaultExpanded={defaultExpanded}>
      {children}
    </CollapsibleNavSection>
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
        'flex items-center justify-between px-3 py-2.5 min-h-[2.75rem] rounded-xl text-sm font-medium transition-all duration-200 touch-manipulation',
        isActive ? 'nav-link-active' : 'nav-link-idle text-muted-foreground hover:text-foreground',
      )}
    >
      <span>{children}</span>
      {badge != null && badge > 0 && (
        <span className="ml-auto shrink-0 min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1 leading-none border-2 border-destructive/30">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </Link>
  );
}

export function NavLinks({ isAdmin, isOwner, handoffCount = 0 }: NavLinksProps) {
  const pathname = usePathname();
  const liveHandoffCount = useHandoffCount(handoffCount);

  function groupHasActiveItem(items: { href: string }[]) {
    return items.some((item) => isNavItemActive(pathname, item.href));
  }

  if (isAdmin) {
    return (
      <div className="space-y-4">
        <NavSection label="Platform" defaultExpanded={groupHasActiveItem(ADMIN_NAV_ITEMS)}>
          {ADMIN_NAV_ITEMS.map((item) => (
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
        <NavSection
          key={group.title}
          label={group.title}
          defaultExpanded={groupHasActiveItem(group.items)}
        >
          {group.items.map((item) => (
            <NavItemLink
              key={item.href}
              href={item.href}
              badge={item.href === '/conversations' ? liveHandoffCount : undefined}
            >
              {item.label}
            </NavItemLink>
          ))}
        </NavSection>
      ))}
    </div>
  );
}

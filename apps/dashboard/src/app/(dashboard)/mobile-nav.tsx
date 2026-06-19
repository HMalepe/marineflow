'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo, useState } from 'react';
import {
  ADMIN_MOBILE_TAB_ITEMS,
  adminMobileMoreItems,
  isNavItemActive,
  MOBILE_BOTTOM_TAB_ITEMS,
  mobileMoreNavGroups,
} from '@/lib/dashboard-nav';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { LogoutButton, LogoutIconButton } from './logout-button';
import { DashboardSearch } from '@/components/dashboard-search';
import { ThemeToggle } from '@/components/theme-toggle';
import { useHandoffCount } from '@/components/Sidebar';

// Icons as inline SVG to avoid adding a new dependency
function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
      <path d="M9 21V12h6v9" />
    </svg>
  );
}
function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
function ChatIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  );
}
function PeopleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="7" r="4" />
      <path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2" />
      <path d="M16 3.13a4 4 0 010 7.75" />
      <path d="M21 21v-2a4 4 0 00-3-3.87" />
    </svg>
  );
}
function GridIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}
function MoreIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="5" r="1" fill="currentColor" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
      <circle cx="12" cy="19" r="1" fill="currentColor" />
    </svg>
  );
}
function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}

interface NavProps {
  isAdmin: boolean;
  isOwner: boolean;
  businessName: string;
  logoUrl: string | null;
  handoffCount?: number;
}

interface TabItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TAB_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  '/': HomeIcon,
  '/appointments': CalendarIcon,
  '/conversations': ChatIcon,
  '/roster': PeopleIcon,
  '/services': GridIcon,
  '/agency': PeopleIcon,
  '/analytics': GridIcon,
  '/billing': CalendarIcon,
};

function tabsFromNavItems(items: { href: string; label: string }[]): TabItem[] {
  return items.map((item) => ({
    ...item,
    icon: TAB_ICONS[item.href] ?? GridIcon,
  }));
}

const ownerTabs = tabsFromNavItems(MOBILE_BOTTOM_TAB_ITEMS);
const adminTabs = tabsFromNavItems(ADMIN_MOBILE_TAB_ITEMS);

export function MobileNav({ isAdmin, isOwner, businessName, logoUrl, handoffCount = 0 }: NavProps) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const liveHandoffCount = useHandoffCount(handoffCount);

  const tabs = isAdmin ? adminTabs : ownerTabs;
  const moreGroups = useMemo(
    () => (isAdmin ? [{ title: 'Admin', items: adminMobileMoreItems() }] : mobileMoreNavGroups(isOwner)),
    [isAdmin, isOwner],
  );
  const moreActive = moreGroups.some((group) =>
    group.items.some((item) => isNavItemActive(pathname, item.href)),
  );

  function isActive(href: string) {
    return isNavItemActive(pathname, href);
  }

  return (
    <>
      {/* Mobile top header */}
      <header className="md:hidden sticky top-0 z-40 flex items-center gap-3 px-4 py-3 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85 border-b shadow-[0_1px_0_rgb(0_0_0/0.04),0_6px_16px_-12px_rgb(0_0_0/0.12)]">
        <div className={`shrink-0 size-8 rounded-lg overflow-hidden flex items-center justify-center border ${logoUrl ? 'bg-white' : 'bg-muted'}`}>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={businessName} loading="eager" decoding="async" className="size-full object-contain p-0.5" />
          ) : (
            <span className="text-xs font-bold text-muted-foreground select-none">
              {businessName.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('')}
            </span>
          )}
        </div>
        <span className="font-semibold text-sm truncate flex-1 min-w-0">{businessName}</span>
        <DashboardSearch isAdmin={isAdmin} isOwner={isOwner} variant="compact" />
        <ThemeToggle />
        <LogoutIconButton className="-mr-1" />
        {/* MarineFlow badge */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#25d366] opacity-60" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#25d366]" />
          </span>
          <span
            className="text-[11px] font-bold"
            style={{
              background: 'linear-gradient(90deg,#25d366 0%,#128c7e 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            MarineFlow
          </span>
        </div>
      </header>

      {/* Bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85 border-t shadow-[0_-1px_0_rgb(0_0_0/0.04),0_-8px_20px_-12px_rgb(0_0_0/0.14)] flex items-stretch safe-area-pb">
        {tabs.map((tab) => {
          const active = isActive(tab.href);
          const showBadge = tab.href === '/conversations' && liveHandoffCount > 0;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'relative flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors',
                active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <div className="relative">
                <tab.icon className={cn('size-5 transition-transform', active && 'scale-110')} />
                {showBadge && (
                  <span className="absolute -top-1 -right-1.5 min-w-[14px] h-[14px] rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center px-0.5 leading-none">
                    {liveHandoffCount > 9 ? '9+' : liveHandoffCount}
                  </span>
                )}
              </div>
              <span className={cn('transition-all', active && 'font-semibold')}>{tab.label}</span>
              {active && <span className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 bg-primary rounded-full" />}
            </Link>
          );
        })}

        {/* More button */}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className={cn(
            'relative flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors',
            moreActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <MoreIcon className={cn('size-5', moreActive && 'stroke-primary')} />
          More
          {moreActive && <span className="absolute bottom-0 h-0.5 w-8 bg-primary rounded-full" />}
        </button>
      </nav>

      {/* "More" slide-up sheet */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[70vh] overflow-y-auto pb-safe">
          <SheetHeader className="pb-2">
            <SheetTitle className="text-base">More</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 py-2">
            {moreGroups.map((group) => (
              <div key={group.title}>
                <p className="px-1 pb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  {group.title}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {group.items.map((item) => (
                    <MoreNavItem
                      key={item.href}
                      href={item.href}
                      label={item.label}
                      pathname={pathname}
                      onClick={() => setMoreOpen(false)}
                      icon={
                        item.href === '/settings' ? (
                          <SettingsIcon className="size-4" />
                        ) : undefined
                      }
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="pt-4 border-t mt-2">
            <LogoutButton />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function MoreNavItem({
  href,
  label,
  pathname,
  onClick,
  icon,
}: {
  href: string;
  label: string;
  pathname: string;
  onClick: () => void;
  icon?: React.ReactNode;
}) {
  const active = isNavItemActive(pathname, href);
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        'flex items-center gap-2.5 px-4 py-3 rounded-xl transition-colors text-sm font-medium',
        active
          ? 'bg-primary/10 text-primary border border-primary/20 font-semibold'
          : 'bg-muted/60 hover:bg-accent text-foreground',
      )}
    >
      {icon}
      {label}
    </Link>
  );
}

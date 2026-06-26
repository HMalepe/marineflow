'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, Calendar, LayoutGrid, Settings, Users } from 'lucide-react';
import { branchPath } from '@/lib/branch-path';
import { cn } from '@/lib/utils';
import { CollapsibleSection } from '@/components/collapsible-section';
import { DashboardPageHeader } from '@/components/dashboard-page-header';
import type { BranchRow } from '@/app/(dashboard)/branches/branches-client';

const NAV = [
  { segment: '', label: 'Overview', icon: LayoutGrid },
  { segment: '/roster', label: 'Staff Roster', icon: Users },
  { segment: '/appointments', label: 'Appointments', icon: Calendar },
  { segment: '/settings', label: 'Branch settings', icon: Settings },
] as const;

export function BranchShell({
  branch,
  children,
}: {
  branch: BranchRow;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const base = branchPath(branch.id);

  return (
    <div className="dashboard-page-flow space-y-6">
      <DashboardPageHeader
        variant="violet"
        className="overflow-hidden pb-0"
        title={
          <>
            <Link
              href="/branches"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
            >
              <ArrowLeft className="size-3.5" />
              All branches
            </Link>
            {branch.name}
          </>
        }
        subtitle="This location has its own roster and staff. Services, prices, and the WhatsApp bot are shared across all branches."
        actions={
          branch._count ? (
            <div className="flex gap-4 text-sm text-muted-foreground shrink-0">
              <span>{branch._count.staff} staff</span>
              <span>{branch._count.appointments} appointments</span>
            </div>
          ) : undefined
        }
      >
        <CollapsibleSection
          id="branch-navigation"
          title="Branch pages"
          defaultOpen
          className="mt-4 border-0 shadow-none rounded-none [&_.dashboard-section-header]:px-0 [&_.dashboard-section-body]:px-0 [&_.dashboard-section-body]:pt-2"
        >
        <nav
          className={cn(
            'branch-tab-nav sticky z-30 flex gap-1.5 overflow-x-auto overscroll-x-contain -mx-4 sm:-mx-5 px-4 sm:px-5 py-2.5',
            'bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85',
            'top-[var(--dashboard-sticky-offset,0px)]',
            '[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          )}
        >
          {NAV.map(({ segment, label, icon: Icon }) => {
            const href = segment ? branchPath(branch.id, segment) : base;
            const active = segment ? pathname.startsWith(href) : pathname === base;
            return (
              <Link
                key={segment || 'overview'}
                href={href}
                className={cn(
                  'inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap',
                  active ? 'branch-tab-link-active text-primary' : 'branch-tab-link-idle text-muted-foreground hover:text-accent-foreground',
                )}
              >
                <Icon className="size-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>
        </CollapsibleSection>
      </DashboardPageHeader>

      {children}
    </div>
  );
}

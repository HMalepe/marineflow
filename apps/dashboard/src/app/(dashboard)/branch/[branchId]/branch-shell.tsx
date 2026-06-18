'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, Calendar, LayoutGrid, Settings, Users } from 'lucide-react';
import { branchPath } from '@/lib/branch-path';
import { cn } from '@/lib/utils';
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
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <Link
              href="/branches"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="size-3.5" />
              All branches
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight truncate">{branch.name}</h1>
            <p className="text-sm text-muted-foreground max-w-2xl">
              This location has its own roster and staff. Services, prices, and the WhatsApp bot are shared across all branches.
            </p>
          </div>
          {branch._count && (
            <div className="flex gap-4 text-sm text-muted-foreground shrink-0">
              <span>{branch._count.staff} staff</span>
              <span>{branch._count.appointments} appointments</span>
            </div>
          )}
        </div>

        <nav className="flex flex-wrap gap-1.5">
          {NAV.map(({ segment, label, icon: Icon }) => {
            const href = segment ? branchPath(branch.id, segment) : base;
            const active = segment
              ? pathname.startsWith(href)
              : pathname === base;
            return (
              <Link
                key={segment || 'overview'}
                href={href}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                <Icon className="size-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>

      {children}
    </div>
  );
}

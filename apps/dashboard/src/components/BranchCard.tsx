'use client';

import Link from 'next/link';
import { Check, MapPin, Pencil, Scissors, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { branchPath } from '@/lib/branch-path';
import { APPOINTMENTS_LABEL } from '@/lib/dashboard-nav';
import type { BranchRow } from '@/app/(dashboard)/branches/branches-client';

export interface BranchStats {
  bookingsThisMonth: number;
  revenueCentsThisMonth: number;
  topService: string | null;
  setup: {
    hasStaff: boolean;
    hasLinkedServices: boolean;
    hasAddress: boolean;
  };
}

interface BranchCardProps {
  branch: BranchRow;
  stats: BranchStats | null;
  statsLoading?: boolean;
  bookingSharePct: number;
  canEdit: boolean;
  onEdit: () => void;
}

function formatRands(cents: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function isGhostBranch(branch: BranchRow): boolean {
  const staff = branch._count?.staff ?? 0;
  const appointments = branch._count?.appointments ?? 0;
  return staff === 0 && appointments === 0;
}

function isSetupComplete(setup: BranchStats['setup'] | undefined): boolean {
  if (!setup) return false;
  return setup.hasStaff && setup.hasLinkedServices && setup.hasAddress;
}

function ChecklistItem({
  done,
  label,
  href,
}: {
  done: boolean;
  label: string;
  href: string;
}) {
  return (
    <li className="flex items-start gap-2 text-sm">
      <span
        className={cn(
          'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border text-[10px]',
          done
            ? 'border-green-600/40 bg-green-600/10 text-green-700 dark:text-green-400'
            : 'border-muted-foreground/30',
        )}
        aria-hidden
      >
        {done ? <Check className="size-2.5" /> : ''}
      </span>
      {done ? (
        <span className="text-muted-foreground line-through">{label}</span>
      ) : (
        <Link
          href={href}
          className="text-primary hover:underline underline-offset-4"
          onClick={(e) => e.stopPropagation()}
        >
          {label}
        </Link>
      )}
    </li>
  );
}

export function BranchCard({
  branch,
  stats,
  statsLoading,
  bookingSharePct,
  canEdit,
  onEdit,
}: BranchCardProps) {
  const ghost = isGhostBranch(branch);
  const setup = stats?.setup;
  const active = isSetupComplete(setup);
  const showChecklist = ghost && !active;

  return (
    <Card
      className={cn(
        'group relative overflow-hidden',
        active && 'border-green-600/30 bg-green-600/[0.03] ring-1 ring-green-600/15',
      )}
    >
      <Link href={branchPath(branch.id)} className="block">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2 pr-8">
            <CardTitle className="text-base group-hover:text-primary transition-colors">
              {branch.name}
            </CardTitle>
            <div className="flex items-center gap-1.5 shrink-0">
              {active && (
                <Badge className="bg-green-600/15 text-green-700 dark:text-green-400 border-green-600/30">
                  Active
                </Badge>
              )}
              {branch.isDefault && <Badge variant="secondary">Primary</Badge>}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {showChecklist && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 space-y-2">
              <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                This branch isn&apos;t active yet
              </p>
              <ul className="space-y-1.5">
                <ChecklistItem
                  done={setup?.hasStaff ?? false}
                  label="Add staff to this branch"
                  href={branchPath(branch.id, '/roster')}
                />
                <ChecklistItem
                  done={setup?.hasLinkedServices ?? false}
                  label="Link services"
                  href="/services"
                />
                <ChecklistItem
                  done={setup?.hasAddress ?? false}
                  label="Set address"
                  href="/settings"
                />
              </ul>
            </div>
          )}

          {!showChecklist && branch.address && (
            <p className="text-sm text-muted-foreground flex items-start gap-1.5">
              <MapPin className="size-3.5 shrink-0 mt-0.5 opacity-60" />
              {branch.address}
            </p>
          )}
          {!showChecklist && branch.phone && (
            <p className="text-sm text-muted-foreground">{branch.phone}</p>
          )}

          {branch._count && (
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Users className="size-3" />
                {branch._count.staff} staff
              </span>
              <span>
                {branch._count.appointments} {APPOINTMENTS_LABEL.toLowerCase()}
              </span>
            </div>
          )}

          {statsLoading ? (
            <div className="h-12 rounded-md bg-muted/50 animate-pulse" />
          ) : stats ? (
            <div className="rounded-lg bg-muted/40 px-3 py-2.5 space-y-1.5 text-xs">
              <div className="flex justify-between gap-2 tabular-nums">
                <span className="text-muted-foreground">Bookings this month</span>
                <span className="font-semibold">{stats.bookingsThisMonth}</span>
              </div>
              <div className="flex justify-between gap-2 tabular-nums">
                <span className="text-muted-foreground">Revenue this month</span>
                <span className="font-semibold">{formatRands(stats.revenueCentsThisMonth)}</span>
              </div>
              {stats.topService && (
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground inline-flex items-center gap-1">
                    <Scissors className="size-3" />
                    Top service
                  </span>
                  <span className="font-medium text-right truncate max-w-[55%]">{stats.topService}</span>
                </div>
              )}
            </div>
          ) : null}

          <p className="text-xs text-primary font-medium pt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            Open branch dashboard →
          </p>
        </CardContent>
      </Link>

      {!statsLoading && stats && (
        <div className="px-4 pb-3 pt-0">
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary/70 transition-all duration-500"
              style={{ width: `${Math.max(bookingSharePct, stats.bookingsThisMonth > 0 ? 4 : 0)}%` }}
              title={`${bookingSharePct}% of salon bookings this month`}
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1 tabular-nums">
            {bookingSharePct}% of bookings this month
          </p>
        </div>
      )}

      {canEdit && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onEdit();
          }}
          className="absolute top-3 right-3 flex size-8 items-center justify-center rounded-lg border bg-background/90 text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
          aria-label={`Edit ${branch.name}`}
        >
          <Pencil className="size-3.5" />
        </button>
      )}
    </Card>
  );
}

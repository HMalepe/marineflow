'use client';

import Link from 'next/link';
import { AlertTriangle, ChevronRight, GitMerge, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type LtvBadge = 'champion' | 'regular' | 'new' | 'at_risk';

export interface CustomerListItem {
  id: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  email: string | null;
  waId: string | null;
  marketingConsentStatus: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  bookingCount: number;
  tags: string[];
  createdAt: string;
}

export interface CustomerStatsView {
  totalSpentCents: number;
  visitCount: number;
  lastVisitAt: string | null;
  ltvBadge: LtvBadge | null;
}

const LTV_BADGE_META: Record<LtvBadge, { label: string; className: string }> = {
  champion: {
    label: 'Champion',
    className: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/40',
  },
  regular: {
    label: 'Regular',
    className: 'bg-blue-600/15 text-blue-700 dark:text-blue-300 border-blue-600/30',
  },
  new: {
    label: 'New',
    className: 'bg-green-600/15 text-green-700 dark:text-green-400 border-green-600/30',
  },
  at_risk: {
    label: 'At Risk',
    className: 'bg-orange-500/15 text-orange-800 dark:text-orange-300 border-orange-500/40',
  },
};

function formatRands(cents: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatLastVisit(iso: string | null): string {
  if (!iso) return 'No visits yet';
  return new Date(iso).toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  });
}

function consentDot(status: CustomerListItem['marketingConsentStatus']) {
  if (status === 'ACCEPTED') {
    return <span className="size-2 rounded-full bg-green-500 shrink-0" title="Marketing accepted" />;
  }
  if (status === 'DECLINED') {
    return <span className="size-2 rounded-full bg-slate-400 shrink-0" title="Marketing declined" />;
  }
  return <span className="size-2 rounded-full bg-amber-400 shrink-0" title="Awaiting POPIA consent" />;
}

interface CustomerCardProps {
  customer: CustomerListItem;
  stats: CustomerStatsView | null;
  statsLoading?: boolean;
  displayName: string;
  avatarColor: string;
  avatarInitials: string;
  formatPhone: (raw: string) => string;
  hasDuplicates?: boolean;
  duplicateCount?: number;
  duplicateRow?: React.ReactNode;
}

export function CustomerCard({
  customer,
  stats,
  statsLoading,
  displayName: name,
  avatarColor,
  avatarInitials,
  formatPhone,
  hasDuplicates,
  duplicateCount = 0,
  duplicateRow,
}: CustomerCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border bg-card transition-shadow',
        hasDuplicates && 'ring-2 ring-amber-400/40 border-amber-400/30',
      )}
    >
      <Link
        href={`/customers/${customer.id}`}
        className="flex items-center gap-4 p-4 hover:bg-muted/40 transition-colors rounded-xl group"
      >
        <div
          className={cn(
            'flex size-11 shrink-0 items-center justify-center rounded-full text-white text-sm font-bold ring-2 ring-white/20',
            avatarColor,
            hasDuplicates && 'ring-amber-400',
          )}
        >
          {avatarInitials}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm truncate">{name}</span>
            {hasDuplicates && (
              <Badge
                variant="outline"
                className="text-[10px] border-amber-500/40 text-amber-800 dark:text-amber-300 gap-1 shrink-0"
              >
                <AlertTriangle className="size-2.5" />
                Same number · {duplicateCount} profiles
              </Badge>
            )}
            {stats?.ltvBadge && (
              <Badge
                variant="outline"
                className={cn('text-[10px] shrink-0', LTV_BADGE_META[stats.ltvBadge].className)}
              >
                {LTV_BADGE_META[stats.ltvBadge].label}
              </Badge>
            )}
            {customer.tags?.slice(0, 2).map((t) => (
              <Badge key={t} variant="outline" className="text-[10px] font-normal shrink-0">
                {t}
              </Badge>
            ))}
          </div>

          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            {consentDot(customer.marketingConsentStatus)}
            {customer.waId && (
              <span className="font-mono text-xs text-muted-foreground">{formatPhone(customer.waId)}</span>
            )}
            {customer.email && (
              <span className="text-xs text-muted-foreground truncate">{customer.email}</span>
            )}
          </div>

          {statsLoading ? (
            <div className="h-4 w-48 rounded bg-muted/60 animate-pulse mt-2" />
          ) : stats ? (
            <div className="flex items-center gap-3 mt-1.5 flex-wrap text-xs text-muted-foreground">
              <span>
                Spent{' '}
                <strong className="text-foreground tabular-nums">{formatRands(stats.totalSpentCents)}</strong>
              </span>
              <span>·</span>
              <span>
                Last visit <strong className="text-foreground">{formatLastVisit(stats.lastVisitAt)}</strong>
              </span>
              {stats.visitCount > 0 && (
                <>
                  <span>·</span>
                  <span>
                    {stats.visitCount} visit{stats.visitCount === 1 ? '' : 's'}
                  </span>
                </>
              )}
            </div>
          ) : null}
        </div>

        <ChevronRight className="size-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
      </Link>

      {duplicateRow}
    </div>
  );
}

interface CustomerDuplicateRowProps {
  dupName: string;
  waId: string | null;
  bookingCount: number;
  createdAt: string;
  primaryName: string;
  formatPhone: (raw: string) => string;
  merging: boolean;
  onMerge: () => void;
}

export function CustomerDuplicateRow({
  dupName,
  waId,
  bookingCount,
  createdAt,
  primaryName,
  formatPhone,
  merging,
  onMerge,
}: CustomerDuplicateRowProps) {
  return (
    <div className="mx-3 mb-3 mt-1 rounded-lg border border-dashed border-amber-500/35 bg-amber-500/[0.04] px-3 py-2.5">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-500/10">
          <GitMerge className="size-3.5 text-amber-700 dark:text-amber-300" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-foreground">Extra profile for the same number</p>
          <p className="mt-0.5 text-sm font-semibold truncate">{dupName}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
            {waId && <span className="font-mono">{formatPhone(waId)}</span>}
            <span>
              {bookingCount} booking{bookingCount === 1 ? '' : 's'}
            </span>
            <span>
              Added{' '}
              {new Date(createdAt).toLocaleDateString('en-ZA', {
                day: 'numeric',
                month: 'short',
                year: '2-digit',
              })}
            </span>
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
            Combine into <span className="font-medium text-foreground">{primaryName}</span> — chat
            history, bookings, and loyalty move across.
          </p>
        </div>
        <Button
          size="sm"
          className="shrink-0 h-8 gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
          onClick={onMerge}
          disabled={merging}
        >
          {merging ? <Loader2 className="size-3.5 animate-spin" /> : <GitMerge className="size-3.5" />}
          {merging ? 'Combining…' : 'Combine'}
        </Button>
      </div>
    </div>
  );
}

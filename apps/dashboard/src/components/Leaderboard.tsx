'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowUp, Minus, Trophy } from 'lucide-react';
import type { BusinessType } from '@/lib/labels';
import { BusinessTypeBadge } from '@/components/BusinessTypeBreakdown';
import { cn } from '@/lib/utils';

export type LeaderboardEntry = {
  rank: number;
  salonId: string;
  name: string;
  slug: string;
  businessType: BusinessType;
  value: number;
  previousValue: number;
  delta: number;
};

export type AdminLeaderboardData = {
  byAppointments: LeaderboardEntry[];
  byRevenue: LeaderboardEntry[];
  byRetention: LeaderboardEntry[];
  periodDays: number;
};

type Tab = 'appointments' | 'revenue' | 'retention';

const TABS: { id: Tab; label: string }[] = [
  { id: 'appointments', label: 'By Appointments' },
  { id: 'revenue', label: 'By Revenue' },
  { id: 'retention', label: 'By Retention' },
];

function formatZar(cents: number): string {
  return `R ${(cents / 100).toLocaleString('en-ZA', { maximumFractionDigits: 0 })}`;
}

function formatValue(tab: Tab, value: number): string {
  if (tab === 'revenue') return formatZar(value);
  if (tab === 'retention') return `${value.toFixed(1)}%`;
  return value.toLocaleString('en-ZA');
}

function formatDelta(tab: Tab, delta: number): string {
  if (tab === 'revenue') {
    const sign = delta > 0 ? '+' : delta < 0 ? '-' : '';
    return `${sign}${formatZar(Math.abs(delta))}`;
  }
  if (tab === 'retention') {
    const sign = delta > 0 ? '+' : '';
    return `${sign}${delta.toFixed(1)}pp`;
  }
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta.toLocaleString('en-ZA')}`;
}

function DeltaBadge({ tab, delta }: { tab: Tab; delta: number }) {
  if (delta === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground tabular-nums">
        <Minus className="size-3" />
        flat
      </span>
    );
  }

  const up = delta > 0;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-xs font-medium tabular-nums',
        up ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
      )}
    >
      {up ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
      {formatDelta(tab, delta)}
    </span>
  );
}

function rankStyle(rank: number): string {
  if (rank === 1) return 'bg-amber-400/20 text-amber-800 dark:text-amber-200 border-amber-500/40';
  if (rank === 2) return 'bg-slate-300/30 text-slate-800 dark:text-slate-200 border-slate-400/40';
  if (rank === 3) return 'bg-orange-400/15 text-orange-900 dark:text-orange-200 border-orange-500/30';
  return 'bg-muted text-muted-foreground border-border';
}

type Props = {
  data: AdminLeaderboardData;
};

export function Leaderboard({ data }: Props) {
  const [tab, setTab] = useState<Tab>('appointments');

  const rows =
    tab === 'appointments'
      ? data.byAppointments
      : tab === 'revenue'
        ? data.byRevenue
        : data.byRetention;

  const emptyCopy =
    tab === 'retention'
      ? 'No retention data yet — tenants need repeat customers across two 30-day windows.'
      : 'No activity in the last 30 days.';

  return (
    <section className="rounded-xl border bg-card shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <Trophy className="size-4 text-primary" />
          <div>
            <h2 className="text-sm font-semibold">Top performing tenants</h2>
            <p className="text-xs text-muted-foreground">
              Last {data.periodDays} days vs prior {data.periodDays} days
            </p>
          </div>
        </div>
        <div className="inline-flex rounded-lg border bg-muted/50 p-0.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                tab === t.id
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="divide-y">
        {rows.length === 0 && (
          <p className="px-4 py-8 text-sm text-center text-muted-foreground">{emptyCopy}</p>
        )}
        {rows.map((row) => (
          <div
            key={`${tab}-${row.salonId}`}
            className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
          >
            <span
              className={cn(
                'flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold tabular-nums',
                rankStyle(row.rank),
              )}
            >
              {row.rank}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/admin/businesses/${row.salonId}`}
                  className="text-sm font-medium truncate hover:text-primary hover:underline underline-offset-2"
                >
                  {row.name}
                </Link>
                <BusinessTypeBadge type={row.businessType} short />
              </div>
              <p className="text-xs text-muted-foreground truncate">{row.slug}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-semibold tabular-nums">{formatValue(tab, row.value)}</p>
              <DeltaBadge tab={tab} delta={row.delta} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

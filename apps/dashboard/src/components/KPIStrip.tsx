import type React from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { APPOINTMENTS_LABEL } from '@/lib/dashboard-nav';

export type OverviewKpiData = {
  bookingsToday: number;
  bookingsYesterday: number;
  bookingsDelta: number;
  revenueTodayCents: number;
  revenueMtdCents: number;
  botConversationsToday: number;
  pendingPayments: number;
  openTickets: number;
  revenueLast7Days: { date: string; revenueCents: number }[];
};

function formatZar(cents: number, compact = false): string {
  const rands = cents / 100;
  if (compact && rands >= 1000) {
    return `R ${Math.round(rands).toLocaleString('en-ZA')}`;
  }
  return `R ${rands.toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function DeltaBadge({ delta }: { delta: number }) {
  if (delta === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
        <Minus className="size-3" />
        vs yesterday
      </span>
    );
  }
  const up = delta > 0;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-[10px] font-medium',
        up ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400',
      )}
    >
      {up ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
      {up ? '+' : ''}
      {delta} vs yesterday
    </span>
  );
}

type TileProps = {
  href: string;
  label: string;
  value: string;
  sub?: React.ReactNode;
  badge?: { count: number; variant: 'red' | 'amber' };
};

function KpiTile({ href, label, value, sub, badge }: TileProps) {
  return (
    <Link
      href={href}
      className="group relative rounded-xl border bg-card p-3 sm:p-4 shadow-sm hover:border-primary/40 hover:shadow-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {badge && badge.count > 0 && (
        <span
          className={cn(
            'absolute top-2 right-2 min-w-[18px] h-[18px] rounded-full text-[10px] font-bold flex items-center justify-center px-1',
            badge.variant === 'red'
              ? 'bg-destructive text-destructive-foreground'
              : 'bg-amber-500 text-white',
          )}
        >
          {badge.count > 99 ? '99+' : badge.count}
        </span>
      )}
      <p className="text-[10px] sm:text-xs font-medium uppercase tracking-wide text-muted-foreground pr-6">
        {label}
      </p>
      <p className="text-xl sm:text-2xl font-bold tabular-nums mt-1 group-hover:text-primary transition-colors">
        {value}
      </p>
      {sub && <div className="mt-1">{sub}</div>}
    </Link>
  );
}

export function KPIStrip({ data }: { data: OverviewKpiData }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2 sm:gap-3">
      <KpiTile
        href="/appointments"
        label={`${APPOINTMENTS_LABEL} today`}
        value={String(data.bookingsToday)}
        sub={<DeltaBadge delta={data.bookingsDelta} />}
      />
      <KpiTile
        href="/analytics"
        label="Revenue today"
        value={formatZar(data.revenueTodayCents)}
      />
      <KpiTile
        href="/analytics"
        label="Revenue MTD"
        value={formatZar(data.revenueMtdCents, true)}
      />
      <KpiTile
        href="/conversations"
        label="Bot conversations today"
        value={String(data.botConversationsToday)}
      />
      <KpiTile
        href="/appointments?status=PENDING_PAYMENT"
        label="Pending payments"
        value={String(data.pendingPayments)}
        badge={data.pendingPayments > 0 ? { count: data.pendingPayments, variant: 'red' } : undefined}
      />
      <KpiTile
        href="/tickets"
        label="Open support tickets"
        value={String(data.openTickets)}
        badge={data.openTickets > 0 ? { count: data.openTickets, variant: 'amber' } : undefined}
      />
    </div>
  );
}

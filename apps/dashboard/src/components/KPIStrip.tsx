'use client';

import Link from 'next/link';
import { Calendar, MessageSquare, TrendingUp, Wallet } from 'lucide-react';
import { APPOINTMENTS_LABEL } from '@/lib/dashboard-nav';
import { cn } from '@/lib/utils';
import { OverviewSectionLabel } from '@/components/overview/OverviewSectionLabel';
import { overviewNeonBox, overviewSection, type OverviewNeonVariant } from '@/components/overview/overviewNeon';

export type OverviewKpiData = {
  bookingsToday: number;
  bookingsDelta: number;
  revenueTodayCents: number;
  revenueMtdCents: number;
  botChatsToday: number;
  pendingPayments: number;
  openTickets: number;
  revenueLast7Days: { date: string; revenueCents: number }[];
};

function formatZar(cents: number): string {
  return `R ${(cents / 100).toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function KpiTile({
  label,
  value,
  sub,
  icon: Icon,
  href,
  neonVariant,
  iconClassName,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: typeof Calendar;
  href?: string;
  neonVariant: OverviewNeonVariant;
  iconClassName?: string;
}) {
  const inner = (
    <div className={cn(overviewNeonBox(neonVariant), 'p-4 h-full')}>
      <div className="flex items-start justify-between gap-2 pb-2 border-b-2 border-current/15">
        <p className="text-[11px] font-semibold text-muted-foreground leading-tight">{label}</p>
        <div
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-lg border-2 border-current/20 bg-background/50',
            iconClassName,
          )}
        >
          <Icon className="size-4" />
        </div>
      </div>
      <p className="text-2xl sm:text-3xl font-bold tabular-nums mt-3 tracking-tight">{value}</p>
      {sub && (
        <p className="text-xs font-medium text-muted-foreground mt-2 pt-2 border-t-2 border-current/12">{sub}</p>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block h-full">
        {inner}
      </Link>
    );
  }
  return inner;
}

export function KPIStrip({ data }: { data: OverviewKpiData }) {
  const bookingsSub =
    data.bookingsDelta !== 0
      ? `${data.bookingsDelta > 0 ? '+' : ''}${data.bookingsDelta} vs yesterday`
      : 'Same as yesterday';

  return (
    <section id="overview-kpis" data-section-label="Snapshot" className={overviewSection('space-y-3')}>
      <div className="overview-section-heading">
        <OverviewSectionLabel>Snapshot</OverviewSectionLabel>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiTile
          label={`${APPOINTMENTS_LABEL} today`}
          value={String(data.bookingsToday)}
          sub={bookingsSub}
          icon={Calendar}
          href="/appointments"
          neonVariant="violet"
          iconClassName="text-violet-700 dark:text-violet-300"
        />
        <KpiTile
          label="Revenue today"
          value={formatZar(data.revenueTodayCents)}
          sub="Collected today"
          icon={Wallet}
          neonVariant="emerald"
          iconClassName="text-emerald-700 dark:text-emerald-300"
        />
        <KpiTile
          label="Revenue this month"
          value={formatZar(data.revenueMtdCents)}
          sub="Month to date"
          icon={TrendingUp}
          neonVariant="fuchsia"
          iconClassName="text-fuchsia-700 dark:text-fuchsia-300"
        />
        <KpiTile
          label="Bot chats today"
          value={String(data.botChatsToday)}
          sub="WhatsApp conversations"
          icon={MessageSquare}
          href="/conversations"
          neonVariant="cyan"
          iconClassName="text-cyan-700 dark:text-cyan-300"
        />
      </div>
    </section>
  );
}

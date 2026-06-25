import Link from 'next/link';
import { LifeBuoy, Wallet } from 'lucide-react';
import type { OverviewKpiData } from '@/components/KPIStrip';
import { OverviewSectionLabel } from './OverviewSectionLabel';
import { overviewNeonBox, overviewSection } from './overviewNeon';

export function NeedsYouPanel({ data }: { data: OverviewKpiData }) {
  const showPayments = data.pendingPayments > 0;
  const showTickets = data.openTickets > 0;
  if (!showPayments && !showTickets) return null;

  return (
    <section id="overview-needs-you" data-section-label="Needs you" className={overviewSection('space-y-3')}>
      <div className="overview-section-heading">
        <OverviewSectionLabel>Needs you</OverviewSectionLabel>
      </div>
      <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
        {showPayments && (
          <Link href="/appointments?status=PENDING_PAYMENT" className="block group">
            <div
              className={overviewNeonBox(
                'orange',
                'p-4 sm:p-5 flex items-center justify-between gap-4',
              )}
            >
              <div className="min-w-0 flex-1 border-r-2 border-orange-500/35 pr-4">
                <p className="text-[10px] font-bold uppercase tracking-wide text-orange-800 dark:text-orange-200">
                  Awaiting payment
                </p>
                <p className="text-3xl sm:text-4xl font-bold tabular-nums mt-1">{data.pendingPayments}</p>
                <p className="text-xs font-semibold text-muted-foreground mt-2 pt-2 border-t-2 border-orange-500/25 group-hover:text-foreground transition-colors">
                  Follow up soon →
                </p>
              </div>
              <div className="flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-orange-500/45 bg-orange-500/20 text-orange-800 dark:text-orange-200 shadow-[0_0_20px_-4px_oklch(0.72_0.19_55/0.55)]">
                <Wallet className="size-5" />
              </div>
            </div>
          </Link>
        )}
        {showTickets && (
          <Link href="/tickets" className="block group">
            <div
              className={overviewNeonBox(
                'rose',
                'p-4 sm:p-5 flex items-center justify-between gap-4',
              )}
            >
              <div className="min-w-0 flex-1 border-r-2 border-rose-500/35 pr-4">
                <p className="text-[10px] font-bold uppercase tracking-wide text-rose-800 dark:text-rose-200">
                  Help requests
                </p>
                <p className="text-3xl sm:text-4xl font-bold tabular-nums mt-1">{data.openTickets}</p>
                <p className="text-xs font-semibold text-muted-foreground mt-2 pt-2 border-t-2 border-rose-500/25 group-hover:text-foreground transition-colors">
                  Needs attention →
                </p>
              </div>
              <div className="flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-rose-500/45 bg-rose-500/20 text-rose-800 dark:text-rose-200 shadow-[0_0_20px_-4px_oklch(0.62_0.22_15/0.55)]">
                <LifeBuoy className="size-5" />
              </div>
            </div>
          </Link>
        )}
      </div>
    </section>
  );
}

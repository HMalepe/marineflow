'use client';

import Link from 'next/link';
import { ArrowUpRight, Brain, Sparkles, Wallet, LifeBuoy } from 'lucide-react';
import type { OverviewKpiData } from '@/components/KPIStrip';
import { cn } from '@/lib/utils';
import { OverviewCollapsibleSection } from './OverviewCollapsibleSection';
import { overviewDivider, overviewNeonBox } from './overviewNeon';

export function OverviewCoachNudges({ data }: { data: OverviewKpiData }) {
  const nudges = [
    data.pendingPayments > 0
      ? {
          id: 'pending-payments',
          icon: Wallet,
          headline: `${data.pendingPayments} booking${data.pendingPayments === 1 ? '' : 's'} awaiting payment`,
          body: 'Payment links are still open — follow up before slots expire or customers drop off.',
          href: '/appointments?status=PENDING_PAYMENT',
          actionLabel: 'View bookings',
          neon: 'orange' as const,
        }
      : null,
    data.openTickets > 0
      ? {
          id: 'open-tickets',
          icon: LifeBuoy,
          headline: `${data.openTickets} help request${data.openTickets === 1 ? '' : 's'} need attention`,
          body: 'Unresolved tickets can hurt retention — clear the queue while you have a quiet moment.',
          href: '/tickets',
          actionLabel: 'View tickets',
          neon: 'rose' as const,
        }
      : null,
  ].filter(Boolean) as Array<{
    id: string;
    icon: typeof Wallet;
    headline: string;
    body: string;
    href: string;
    actionLabel: string;
    neon: 'orange' | 'rose';
  }>;

  return (
    <OverviewCollapsibleSection id="overview-coach" label="AI coach">
      <div className={overviewNeonBox('fuchsia', 'p-4 sm:p-5')}>
        <div className="flex gap-3 pb-4 border-b-2 border-fuchsia-500/30">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border-2 border-fuchsia-500/40 bg-fuchsia-500/15 text-fuchsia-800 dark:text-fuchsia-200 shadow-[0_0_18px_-4px_oklch(0.62_0.26_330/0.5)]">
            <Brain className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-bold text-base">Proactive nudges</h2>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-fuchsia-800 dark:text-fuchsia-200 bg-fuchsia-500/15 border border-fuchsia-500/35 px-2 py-0.5 rounded-full">
                <Sparkles className="size-3" />
                Rule-based
              </span>
            </div>
            <p className="text-sm font-medium text-muted-foreground mt-1 leading-relaxed">
              Action items from your live bookings and help queue — not another report.
            </p>
          </div>
        </div>

        {nudges.length === 0 ? (
          <p
            className={cn(
              overviewNeonBox('violet', 'text-sm font-medium text-muted-foreground px-4 py-6 text-center mt-4'),
            )}
          >
            Nothing urgent right now. Check back after more booking activity.
          </p>
        ) : (
          <div className="space-y-3 mt-4">
            {nudges.map((nudge, index) => (
              <div key={nudge.id}>
                {index > 0 && <hr className={overviewDivider()} />}
                <div
                  className={overviewNeonBox(
                    nudge.neon,
                    'p-4 flex flex-col sm:flex-row sm:items-center gap-3',
                  )}
                >
                  <div className="flex gap-3 flex-1 min-w-0 sm:border-r-2 sm:border-current/20 sm:pr-4">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border-2 border-current/25 bg-background/60">
                      <nudge.icon className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm leading-snug">{nudge.headline}</p>
                      <p className="text-sm font-medium text-muted-foreground mt-1 pt-1 border-t border-current/15 leading-relaxed">
                        {nudge.body}
                      </p>
                    </div>
                  </div>
                  <Link
                    href={nudge.href}
                    className={cn(
                      'inline-flex items-center justify-center gap-1.5 shrink-0 rounded-md px-3 h-9 text-sm font-bold',
                      'border-2 border-fuchsia-500/40',
                      'bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white',
                      'shadow-[0_0_20px_-4px_oklch(0.62_0.26_330/0.55)]',
                    )}
                  >
                    {nudge.actionLabel}
                    <ArrowUpRight className="size-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </OverviewCollapsibleSection>
  );
}

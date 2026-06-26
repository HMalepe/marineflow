import Link from 'next/link';
import { Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { APPOINTMENTS_LABEL } from '@/lib/dashboard-nav';
import { cn } from '@/lib/utils';
import { OverviewCollapsibleSection } from './OverviewCollapsibleSection';
import { overviewNeonBox } from './overviewNeon';

export interface TodayAppointment {
  id: string;
  start: string;
  end: string;
  status: string;
  service: { name: string };
  staff: { name: string; displayName?: string | null };
  customer: { displayName: string | null; waId: string; firstName?: string | null; lastName?: string | null };
  payments?: { status: string }[];
}

function customerLabel(c: TodayAppointment['customer']): string {
  if (c.displayName) return c.displayName;
  const parts = [c.firstName, c.lastName].filter(Boolean);
  if (parts.length) return parts.join(' ');
  return c.waId;
}

function paymentStatusLabel(appt: TodayAppointment): { label: string; className: string } {
  const paid =
    appt.status === 'CONFIRMED_PAID' ||
    (appt.payments ?? []).some((p) => p.status === 'SUCCEEDED');
  if (paid) {
    return {
      label: 'Confirmed paid',
      className:
        'bg-emerald-500/15 text-emerald-900 border-2 border-emerald-500/45 dark:text-emerald-200 font-semibold',
    };
  }
  if (appt.status === 'PENDING_PAYMENT' || appt.status === 'HELD') {
    return {
      label: 'Pending payment',
      className:
        'bg-orange-500/15 text-orange-900 border-2 border-orange-500/45 dark:text-orange-200 font-semibold',
    };
  }
  return {
    label: appt.status.replace(/_/g, ' ').toLowerCase(),
    className: 'bg-muted text-muted-foreground border-2 border-border font-semibold',
  };
}

function formatTimeRange(start: string, end: string): string {
  const opts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
  const s = new Date(start).toLocaleTimeString('en-ZA', opts);
  const e = new Date(end).toLocaleTimeString('en-ZA', opts);
  return `${s} — ${e}`;
}

export function TodayBookingsPanel({
  appointments,
  error,
}: {
  appointments: TodayAppointment[];
  error: string | null;
}) {
  const todayHeading = new Date().toLocaleDateString('en-ZA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <OverviewCollapsibleSection
      id="overview-today"
      label="Schedule"
      title="Today's bookings"
      subtitle={`${appointments.length} on the calendar · ${todayHeading}`}
      trailing={
        <Link href="/appointments" className="text-sm font-bold text-primary hover:underline shrink-0">
          Open bookings →
        </Link>
      }
    >
      {error && <p className="text-sm text-destructive font-medium">{error}</p>}

      {!error && appointments.length === 0 && (
        <div className={overviewNeonBox('violet', 'px-6 py-10 text-center')}>
          <Calendar className="size-8 text-violet-500/50 mx-auto mb-2" />
          <p className="text-sm font-bold">No {APPOINTMENTS_LABEL.toLowerCase()} today</p>
          <p className="text-xs text-muted-foreground mt-2 pt-2 border-t-2 border-violet-500/20 font-medium">
            Share your booking link or check back when customers book.
          </p>
        </div>
      )}

      {appointments.length > 0 && (
        <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {appointments.map((appt) => {
            const status = paymentStatusLabel(appt);
            return (
              <div key={appt.id} className={overviewNeonBox('violet', 'p-4')}>
                <p className="text-[11px] font-bold text-violet-800/80 dark:text-violet-200/90 tabular-nums pb-2 border-b-2 border-violet-500/30">
                  {formatTimeRange(appt.start, appt.end)}
                </p>
                <p className="font-bold text-sm mt-3 leading-snug">{appt.service?.name ?? 'Service'}</p>
                <p className="text-xs font-medium text-muted-foreground mt-2 pt-2 border-t-2 border-violet-500/15 truncate">
                  {customerLabel(appt.customer)}
                  {appt.staff?.displayName || appt.staff?.name
                    ? ` · ${appt.staff.displayName ?? appt.staff.name}`
                    : ''}
                </p>
                <Badge variant="outline" className={cn('mt-3 text-[10px]', status.className)}>
                  {status.label}
                </Badge>
              </div>
            );
          })}
        </div>
      )}
    </OverviewCollapsibleSection>
  );
}

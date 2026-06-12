'use client';

import { useCallback, useEffect, useState } from 'react';
import { WaivePenaltyButton } from './waive-penalty-button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiFetch } from '@/lib/api';

interface WaitlistEntry {
  id: string;
  serviceName: string | null;
  staffName: string | null;
  customerName: string;
  createdAt: string;
  expiresAt: string | null;
}

type NoShowRisk = 'LOW' | 'MEDIUM' | 'HIGH';
type DepositFilter = 'all' | 'pending' | 'paid';

export interface AppointmentData {
  id: string;
  start: string;
  end: string;
  status: string;
  cancellationPenaltyApplied: boolean;
  depositForfeited: boolean;
  penaltyWaivedAt: string | null;
  reminder24hSentAt: string | null;
  reminder2hSentAt: string | null;
  reminder24hFailed: boolean;
  reminder2hFailed: boolean;
  service: { name: string; depositCents: number | null; fullPay: boolean };
  staff: { name: string; displayName: string | null; deletedAt: string | null };
  customer: {
    displayName: string | null;
    waId: string;
    noShowRisk?: NoShowRisk;
    noShowCount?: number;
    bookingCount?: number;
  };
  payments: { id: string; amountCents: number; status: string }[];
}

const ACTIONABLE_STATUSES = new Set([
  'CONFIRMED',
  'CONFIRMED_PAID',
  'HELD',
  'PENDING_PAYMENT',
]);

function shouldShowRiskBadge(appt: AppointmentData): boolean {
  const risk = appt.customer.noShowRisk ?? 'LOW';
  return (
    (risk === 'MEDIUM' || risk === 'HIGH') &&
    ACTIONABLE_STATUSES.has(appt.status)
  );
}

function riskSummary(noShowCount: number, bookingCount: number): string {
  return `Based on ${noShowCount} no-show${noShowCount === 1 ? '' : 's'} from ${bookingCount} booking${bookingCount === 1 ? '' : 's'}`;
}

function getDepositStatus(appt: AppointmentData): 'none' | 'paid' | 'unpaid' {
  const requiresDeposit = (appt.service.depositCents ?? 0) > 0 || appt.service.fullPay;
  if (!requiresDeposit) return 'none';
  return appt.status === 'CONFIRMED_PAID' || appt.payments.length > 0 ? 'paid' : 'unpaid';
}

export function AppointmentsClient({
  upcoming,
  past,
  token,
}: {
  upcoming: AppointmentData[];
  past: AppointmentData[];
  token: string;
}) {
  const [depositFilter, setDepositFilter] = useState<DepositFilter>('all');
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);

  const loadWaitlist = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiFetch<{ entries: WaitlistEntry[] }>('/waitlist', {}, token);
      setWaitlist(data.entries ?? []);
    } catch {
      // non-critical — silently ignore
    }
  }, [token]);

  useEffect(() => { void loadWaitlist(); }, [loadWaitlist]);

  function applyFilter(list: AppointmentData[]): AppointmentData[] {
    if (depositFilter === 'all') return list;
    return list.filter((a) => {
      const ds = getDepositStatus(a);
      if (depositFilter === 'paid') return ds === 'paid';
      if (depositFilter === 'pending') return ds === 'unpaid';
      return true;
    });
  }

  const filteredUpcoming = applyFilter(upcoming);
  const filteredPast = applyFilter(past);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Appointments</h1>
          <p className="text-muted-foreground text-sm mt-1">View and manage all bookings.</p>
        </div>
        {/* Deposit filter */}
        <div className="flex items-center gap-1 rounded-lg border p-1 bg-muted/40">
          {(['all', 'pending', 'paid'] as DepositFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setDepositFilter(f)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                depositFilter === f
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {f === 'all' ? 'All' : f === 'pending' ? 'Deposit pending' : 'Deposit paid'}
            </button>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upcoming ({filteredUpcoming.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredUpcoming.length === 0 && (
            <p className="text-sm text-muted-foreground">No upcoming appointments.</p>
          )}
          <div className="space-y-3">
            {filteredUpcoming.map((appt) => (
              <AppointmentRow key={appt.id} appt={appt} showRisk token={token} />
            ))}
          </div>
        </CardContent>
      </Card>

      {filteredPast.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Past ({filteredPast.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {filteredPast.slice(0, 20).map((appt) => (
                <AppointmentRow key={appt.id} appt={appt} />
              ))}
              {filteredPast.length > 20 && (
                <p className="text-xs text-muted-foreground text-center pt-2">
                  Showing 20 of {filteredPast.length} past appointments
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {waitlist.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Waitlist ({waitlist.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">
              Customers waiting for an opening — they will be notified automatically when a slot becomes available.
            </p>
            <div className="space-y-2">
              {waitlist.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between p-3 rounded-lg border gap-3 text-sm">
                  <div className="space-y-0.5 min-w-0">
                    <p className="font-medium truncate">{entry.customerName}</p>
                    <p className="text-xs text-muted-foreground">
                      {entry.serviceName ?? 'Any service'}
                      {entry.staffName ? ` · ${entry.staffName}` : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0 space-y-0.5">
                    <p className="text-xs text-muted-foreground">
                      Since {new Date(entry.createdAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}
                    </p>
                    {entry.expiresAt && (
                      <p className="text-[10px] text-muted-foreground">
                        Expires {new Date(entry.expiresAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function NoShowRiskBadge({
  risk,
  noShowCount,
  bookingCount,
}: {
  risk: NoShowRisk;
  noShowCount: number;
  bookingCount: number;
}) {
  const label = risk === 'HIGH' ? 'High risk' : 'Confirm?';
  const className =
    risk === 'HIGH'
      ? 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-200 dark:border-red-900'
      : 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-200 dark:border-yellow-900';

  return (
    <div className="flex flex-col items-end gap-0.5">
      <span
        className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${className}`}
      >
        {label}
      </span>
      <p className="text-[10px] text-muted-foreground leading-tight text-right max-w-[160px]">
        {riskSummary(noShowCount, bookingCount)}
      </p>
    </div>
  );
}

function ReminderPill({ sent, failed, label }: { sent: boolean; failed: boolean; label: string }) {
  if (sent) return (
    <span className="inline-flex items-center gap-1 text-[10px] text-green-700 dark:text-green-400">
      <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
      {label} sent
    </span>
  );
  if (failed) return (
    <span className="inline-flex items-center gap-1 text-[10px] text-destructive">
      <span className="w-1.5 h-1.5 rounded-full bg-destructive inline-block" />
      {label} failed
    </span>
  );
  return null;
}

function AppointmentRow({
  appt,
  showRisk = false,
  token = '',
}: {
  appt: AppointmentData;
  showRisk?: boolean;
  token?: string;
}) {
  const statusColors: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    CONFIRMED: 'default',
    CONFIRMED_PAID: 'default',
    HELD: 'secondary',
    PENDING_PAYMENT: 'secondary',
    CANCELLED: 'destructive',
    NO_SHOW: 'destructive',
    COMPLETED: 'secondary',
    RESCHEDULED: 'outline',
  };

  const risk = appt.customer.noShowRisk ?? 'LOW';
  const noShowCount = appt.customer.noShowCount ?? 0;
  const bookingCount = appt.customer.bookingCount ?? 0;
  const showBadge = showRisk && shouldShowRiskBadge(appt);

  const isFormerStaff = !!appt.staff.deletedAt;
  const staffLabel = appt.staff.displayName ?? appt.staff.name;

  const requiresDeposit = (appt.service.depositCents ?? 0) > 0 || appt.service.fullPay;
  const depositStatus = !requiresDeposit
    ? 'none'
    : appt.status === 'CONFIRMED_PAID' || appt.payments.length > 0
      ? 'paid'
      : 'unpaid';

  return (
    <div className="flex items-start justify-between p-3 rounded-lg border gap-3">
      <div className="space-y-1 min-w-0 flex-1">
        <p className="text-sm font-medium truncate">
          {appt.customer.displayName ?? appt.customer.waId}
        </p>
        <p className="text-xs text-muted-foreground">
          {appt.service.name} with{' '}
          <span className={isFormerStaff ? 'line-through opacity-60' : ''}>
            {staffLabel}
          </span>
          {isFormerStaff && (
            <span className="ml-1 text-[10px] text-muted-foreground italic">(former)</span>
          )}
        </p>
        {/* Reminder status pills */}
        {ACTIONABLE_STATUSES.has(appt.status) && (
          <div className="flex gap-2 mt-0.5">
            <ReminderPill sent={!!appt.reminder24hSentAt} failed={appt.reminder24hFailed} label="24h" />
            <ReminderPill sent={!!appt.reminder2hSentAt} failed={appt.reminder2hFailed} label="2h" />
          </div>
        )}
        {/* Penalty applied warning */}
        {appt.cancellationPenaltyApplied && !appt.penaltyWaivedAt && (
          <span className="text-[10px] text-destructive font-medium">⚠ Cancellation penalty applied</span>
        )}
        {appt.penaltyWaivedAt && (
          <span className="text-[10px] text-green-700 dark:text-green-400 font-medium">✓ Penalty waived</span>
        )}
        {/* Deposit forfeited */}
        {appt.depositForfeited && (
          <span className="text-[10px] text-destructive font-medium">⚠ Deposit forfeited (no-show)</span>
        )}
      </div>
      <div className="text-right space-y-1 shrink-0">
        <p className="text-sm whitespace-nowrap">
          {new Date(appt.start).toLocaleDateString('en-ZA', {
            day: 'numeric',
            month: 'short',
          })}{' '}
          {new Date(appt.start).toLocaleTimeString('en-ZA', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
        <div className="flex flex-col items-end gap-1">
          {showRisk && token && ACTIONABLE_STATUSES.has(appt.status) && (
            <WaivePenaltyButton appointmentId={appt.id} token={token} />
          )}
          {showBadge && (
            <NoShowRiskBadge risk={risk} noShowCount={noShowCount} bookingCount={bookingCount} />
          )}
          {/* Deposit badge */}
          {requiresDeposit && ACTIONABLE_STATUSES.has(appt.status) && (
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
              depositStatus === 'paid'
                ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
                : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
            }`}>
              {depositStatus === 'paid' ? 'Deposit paid' : 'Deposit pending'}
            </span>
          )}
          <Badge variant={statusColors[appt.status] ?? 'secondary'}>
            {appt.status.toLowerCase().replace(/_/g, ' ')}
          </Badge>
        </div>
      </div>
    </div>
  );
}

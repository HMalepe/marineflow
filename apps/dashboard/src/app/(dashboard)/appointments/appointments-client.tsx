'use client';

import { useCallback, useEffect, useState } from 'react';
import { WaivePenaltyButton } from './waive-penalty-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiFetch, ApiError } from '@/lib/api';
import { AlertTriangle, CheckSquare, Loader2, X } from 'lucide-react';

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
  notes: string | null;
  cancellationReason: string | null;
  branch: { id: string; name: string } | null;
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
  const [removingWaitlistId, setRemovingWaitlistId] = useState<string | null>(null);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkCompleting, setBulkCompleting] = useState(false);
  const [bulkToast, setBulkToast] = useState<string | null>(null);
  const [confirmBulkOpen, setConfirmBulkOpen] = useState(false);

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

  async function handleRemoveWaitlist(id: string) {
    setRemovingWaitlistId(id);
    try {
      await apiFetch(`/waitlist/${id}`, { method: 'DELETE' }, token);
      setWaitlist((prev) => prev.filter((e) => e.id !== id));
    } catch {
      // silently ignore — entry will still show, user can retry
    } finally {
      setRemovingWaitlistId(null);
    }
  }

  const completableIds = upcoming
    .filter((a) => (a.status === 'CONFIRMED' || a.status === 'CONFIRMED_PAID') && new Date(a.start) <= new Date())
    .map((a) => a.id);

  async function handleBulkComplete() {
    if (bulkSelected.size === 0) return;
    setConfirmBulkOpen(false);
    setBulkCompleting(true);
    try {
      const ids = [...bulkSelected];
      const res = await apiFetch<{ completed: number; skipped: number }>(
        '/appointments/bulk-complete',
        { method: 'POST', body: JSON.stringify({ ids }) },
        token,
      );
      setBulkSelected(new Set());
      setBulkToast(`${res.completed} appointment${res.completed === 1 ? '' : 's'} marked complete${res.skipped > 0 ? ` (${res.skipped} skipped)` : ''}`);
      setTimeout(() => setBulkToast(null), 4000);
    } catch (e) {
      setBulkToast(e instanceof ApiError ? e.message : 'Bulk complete failed');
      setTimeout(() => setBulkToast(null), 4000);
    } finally {
      setBulkCompleting(false);
    }
  }

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
      {bulkToast && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg bg-foreground text-background px-4 py-2 text-sm shadow-lg">
          {bulkToast}
        </div>
      )}

      {/* Bulk complete confirmation dialog */}
      {confirmBulkOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmBulkOpen(false)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl bg-card border shadow-2xl p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="shrink-0 size-10 rounded-full bg-amber-100 dark:bg-amber-950 flex items-center justify-center">
                <AlertTriangle className="size-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold text-base">Mark {bulkSelected.size} appointment{bulkSelected.size === 1 ? '' : 's'} complete?</h3>
                <p className="text-sm text-muted-foreground">This will mark them as completed. This action cannot be undone.</p>
              </div>
              <button className="shrink-0 ml-auto text-muted-foreground hover:text-foreground" onClick={() => setConfirmBulkOpen(false)}>
                <X className="size-4" />
              </button>
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setConfirmBulkOpen(false)}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={() => void handleBulkComplete()}>
                <CheckSquare className="size-4 mr-1.5" />
                Confirm
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Appointments</h1>
          <p className="text-muted-foreground text-sm mt-1">View and manage all bookings.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {completableIds.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-dashed p-1.5 bg-muted/40">
              <span className="text-xs text-muted-foreground px-1">
                {bulkSelected.size > 0 ? `${bulkSelected.size} selected` : `${completableIds.length} completable`}
              </span>
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={() => setBulkSelected(bulkSelected.size === completableIds.length ? new Set() : new Set(completableIds))}
              >
                {bulkSelected.size === completableIds.length ? 'Deselect all' : 'Select all'}
              </button>
              {bulkSelected.size > 0 && (
                <Button size="sm" className="h-7 gap-1.5 text-xs" onClick={() => setConfirmBulkOpen(true)} disabled={bulkCompleting}>
                  {bulkCompleting ? <Loader2 className="size-3 animate-spin" /> : <CheckSquare className="size-3" />}
                  Mark complete
                </Button>
              )}
            </div>
          )}
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
      </div>

      <TodaySchedule appointments={[...upcoming, ...past]} />

      <Card>
        <CardHeader>
          <CardTitle>Upcoming ({filteredUpcoming.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredUpcoming.length === 0 && (
            <p className="text-sm text-muted-foreground">No upcoming appointments.</p>
          )}
          <div className="space-y-3">
            {filteredUpcoming.map((appt) => {
              const isCompletable = completableIds.includes(appt.id);
              return (
                <div key={appt.id} className="flex items-start gap-2">
                  {isCompletable && (
                    <input
                      type="checkbox"
                      className="mt-4 size-4 cursor-pointer accent-primary shrink-0"
                      checked={bulkSelected.has(appt.id)}
                      onChange={(e) => {
                        const next = new Set(bulkSelected);
                        if (e.target.checked) next.add(appt.id); else next.delete(appt.id);
                        setBulkSelected(next);
                      }}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <AppointmentRow appt={appt} showRisk token={token} />
                  </div>
                </div>
              );
            })}
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
                <div key={entry.id} className="flex items-center gap-3 p-3 rounded-lg border text-sm">
                  <div className="flex-1 space-y-0.5 min-w-0">
                    <p className="font-medium truncate">{entry.customerName}</p>
                    <p className="text-xs text-muted-foreground">
                      {entry.serviceName ?? 'Any service'}
                      {entry.staffName ? ` · ${entry.staffName}` : ''}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Since {new Date(entry.createdAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}
                      {entry.expiresAt && ` · Expires ${new Date(entry.expiresAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}`}
                    </p>
                  </div>
                  <button
                    onClick={() => void handleRemoveWaitlist(entry.id)}
                    disabled={removingWaitlistId === entry.id}
                    title="Remove from waitlist"
                    className="h-8 w-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors disabled:opacity-40 shrink-0"
                  >
                    {removingWaitlistId === entry.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <X className="w-3.5 h-3.5" />
                    )}
                  </button>
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
          {appt.branch && (
            <span className="ml-2 text-[10px] bg-muted rounded px-1.5 py-0.5 font-medium">{appt.branch.name}</span>
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
        {/* Cancellation reason */}
        {appt.cancellationReason && (
          <span className="text-[10px] text-muted-foreground italic">
            Reason: {appt.cancellationReason.replace(/_/g, ' ').toLowerCase()}
          </span>
        )}
        {/* Notes */}
        {appt.notes && (
          <p className="text-xs text-muted-foreground border-l-2 border-muted pl-2 italic mt-1 line-clamp-2">{appt.notes}</p>
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

function TodaySchedule({ appointments }: { appointments: AppointmentData[] }) {
  const today = new Date();
  const todayStr = today.toDateString();
  const todayAppts = appointments
    .filter((a) => new Date(a.start).toDateString() === todayStr)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  if (todayAppts.length === 0) return null;

  return (
    <Card className="border-primary/20 bg-gradient-to-r from-primary/[0.04] to-transparent overflow-hidden">
      <CardHeader className="pb-2 sm:pb-3">
        <CardTitle className="text-sm sm:text-base font-semibold flex items-center gap-2">
          <span className="relative flex size-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-50" />
            <span className="relative inline-flex rounded-full size-2.5 bg-primary" />
          </span>
          <span>Today — {today.toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          <span className="ml-auto text-xs font-normal text-muted-foreground">
            {todayAppts.length} appointment{todayAppts.length === 1 ? '' : 's'}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
          {todayAppts.map((a) => {
            const startTime = new Date(a.start).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
            const endTime = new Date(a.end).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
            const isPast = new Date(a.end) < new Date();
            const isNow = new Date(a.start) <= new Date() && new Date(a.end) > new Date();
            return (
              <div
                key={a.id}
                className={`shrink-0 rounded-xl border p-3.5 min-w-[170px] max-w-[220px] space-y-2 transition-all ${
                  isNow
                    ? 'border-primary/40 bg-primary/[0.06] shadow-sm ring-1 ring-primary/20'
                    : isPast
                    ? 'opacity-50 bg-muted/30'
                    : 'bg-card hover:border-primary/30 hover:shadow-sm'
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold tabular-nums">{startTime} – {endTime}</p>
                  {isNow && <span className="text-[9px] font-semibold text-primary uppercase tracking-wide">Now</span>}
                </div>
                <p className="text-sm font-semibold truncate leading-tight">{a.service.name}</p>
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground truncate">{a.customer.displayName ?? a.customer.waId}</p>
                  <p className="text-[11px] text-muted-foreground/70 truncate">{a.staff.displayName ?? a.staff.name}</p>
                </div>
                <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  a.status === 'COMPLETED' ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300' :
                  a.status === 'CANCELLED' ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' :
                  a.status === 'NO_SHOW' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' :
                  'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                }`}>
                  {a.status.replace(/_/g, ' ').toLowerCase()}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

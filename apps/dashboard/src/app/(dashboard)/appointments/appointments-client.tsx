'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppointmentCard, type AppointmentData } from '@/components/AppointmentCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiFetch, ApiError } from '@/lib/api';
import { APPOINTMENTS_LABEL } from '@/lib/dashboard-nav';
import { useSalonLiveUpdates } from '@/hooks/use-salon-live-updates';
import { AlertTriangle, Calendar, CheckSquare, Clock, Loader2, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface WaitlistEntry {
  id: string;
  serviceName: string | null;
  staffName: string | null;
  customerName: string;
  createdAt: string;
  expiresAt: string | null;
}

type PaymentFilter = 'all' | 'pending' | 'paid';

export type { AppointmentData };

function getPaymentStatus(appt: AppointmentData): 'none' | 'paid' | 'unpaid' {
  if (appt.status === 'CONFIRMED_PAID' || (appt.payments ?? []).some((p) => p.status === 'SUCCEEDED')) {
    return 'paid';
  }
  if (appt.status === 'PENDING_PAYMENT' || appt.status === 'HELD') {
    return 'unpaid';
  }
  return 'none';
}

export function AppointmentsClient({
  upcoming: initialUpcoming,
  past: initialPast,
  token,
  branchId,
  hidePageHeader = false,
}: {
  upcoming: AppointmentData[];
  past: AppointmentData[];
  token: string;
  branchId?: string;
  hidePageHeader?: boolean;
}) {
  const [upcoming, setUpcoming] = useState(initialUpcoming);
  const [past, setPast] = useState(initialPast);
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all');
  const [search, setSearch] = useState('');
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

  const patchAppointment = useCallback((patch: Partial<AppointmentData> & { id: string }) => {
    const apply = (rows: AppointmentData[]) =>
      rows.map((row) => (row.id === patch.id ? { ...row, ...patch } : row));
    setUpcoming((prev) => apply(prev));
    setPast((prev) => apply(prev));
  }, []);

  const refreshAppointments = useCallback(async () => {
    if (!token) return;
    try {
      const branchQuery = branchId ? `?branchId=${encodeURIComponent(branchId)}` : '';
      const data = await apiFetch<{ appointments: AppointmentData[] }>(`/appointments${branchQuery}`, {}, token);
      const now = Date.now();
      const all = data.appointments ?? [];
      setUpcoming(
        all.filter(
          (a) =>
            new Date(a.start).getTime() >= now &&
            a.status !== 'CANCELLED' &&
            a.status !== 'RESCHEDULED',
        ),
      );
      setPast(all.filter((a) => new Date(a.start).getTime() < now));
    } catch {
      // keep last good snapshot
    }
  }, [token, branchId]);

  const onLiveUpdate = useCallback(
    (type: string) => {
      if (type === 'appointment.created' || type === 'appointment.updated') {
        void refreshAppointments();
        void loadWaitlist();
      }
    },
    [refreshAppointments, loadWaitlist],
  );
  const { connected: liveConnected } = useSalonLiveUpdates(token, onLiveUpdate);

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
      void refreshAppointments();
    } catch (e) {
      setBulkToast(e instanceof ApiError ? e.message : 'Bulk complete failed');
      setTimeout(() => setBulkToast(null), 4000);
    } finally {
      setBulkCompleting(false);
    }
  }

  function applyFilter(list: AppointmentData[]): AppointmentData[] {
    return list.filter((a) => {
      if (paymentFilter !== 'all') {
        const ps = getPaymentStatus(a);
        if (paymentFilter === 'paid' && ps !== 'paid') return false;
        if (paymentFilter === 'pending' && ps !== 'unpaid') return false;
      }
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const name = (a.customer.displayName ?? a.customer.waId).toLowerCase();
        const service = a.service.name.toLowerCase();
        const staff = a.staff.name.toLowerCase();
        if (!name.includes(q) && !service.includes(q) && !staff.includes(q)) return false;
      }
      return true;
    });
  }

  const filteredUpcoming = applyFilter(upcoming);
  const filteredPast = applyFilter(past);

  const hasTodayAppointments = useMemo(() => {
    const todayStr = new Date().toDateString();
    return [...upcoming, ...past].some((a) => new Date(a.start).toDateString() === todayStr);
  }, [upcoming, past]);

  return (
    <div className="space-y-6">
      {bulkToast && (
        <div className="fixed right-4 z-50 rounded-lg bg-foreground text-background px-4 py-2.5 text-sm shadow-lg dashboard-toast-bottom max-w-[calc(100vw-2rem)]">
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

      {!hidePageHeader && (
        <div id="appointments-intro" data-section-label="Summary" className="dashboard-section-anchor">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{APPOINTMENTS_LABEL}</h1>
          <p className="text-muted-foreground text-sm mt-1 flex items-center gap-2 flex-wrap">
            View and manage all bookings.
            {liveConnected && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden />
                Live sync
              </span>
            )}
          </p>
        </div>
      )}
      {hidePageHeader && liveConnected && (
        <p className="text-sm text-muted-foreground flex items-center gap-2 dashboard-section-anchor" id="appointments-intro" data-section-label="Summary">
          Bookings at this location.
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden />
            Live sync
          </span>
        </p>
      )}

      <div
        className="flex items-center gap-2 flex-wrap w-full dashboard-section-anchor"
        id="appointments-filters"
        data-section-label="Search & filters"
      >
        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto sm:ml-auto">
          {/* Search */}
          <div className="relative flex-1 sm:flex-none sm:w-56 min-w-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Customer, service, staff…"
              className="pl-8 h-9 md:h-8 text-base md:text-xs"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[2.75rem] min-w-[2.75rem] flex items-center justify-center text-muted-foreground hover:text-foreground touch-manipulation"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
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
          {/* Payment filter */}
          <div className="flex items-center gap-1 rounded-lg border p-1 bg-muted/40 w-full sm:w-auto overflow-x-auto overscroll-x-contain">
          {(['all', 'pending', 'paid'] as PaymentFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setPaymentFilter(f)}
              className={`shrink-0 px-3 py-2 min-h-[2.25rem] rounded-md text-xs font-medium transition-colors touch-manipulation ${
                paymentFilter === f
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {f === 'all' ? 'All' : f === 'pending' ? 'Payment pending' : 'Paid'}
            </button>
          ))}
          </div>
        </div>
      </div>

      {hasTodayAppointments && (
        <div id="appointments-today" data-section-label="Today" className="dashboard-section-anchor">
          <TodaySchedule appointments={[...upcoming, ...past]} />
        </div>
      )}

      <Card id="appointments-upcoming" data-section-label="Upcoming" className="dashboard-section-anchor">
        <CardHeader>
          <CardTitle>Upcoming ({filteredUpcoming.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredUpcoming.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="size-12 rounded-full bg-muted/60 flex items-center justify-center mb-3">
                <Calendar className="size-6 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium text-foreground">
                {paymentFilter !== 'all' ? 'No appointments match this filter' : 'No upcoming appointments'}
              </p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                {paymentFilter !== 'all'
                  ? 'Try switching the filter above to see all bookings.'
                  : 'New bookings from WhatsApp will appear here automatically.'}
              </p>
            </div>
          )}
          <div className="space-y-3">
            {filteredUpcoming.map((appt) => {
              const isCompletable = completableIds.includes(appt.id);
              return (
                <div key={appt.id} className="flex items-start gap-2">
                  {isCompletable && (
                    <input
                      type="checkbox"
                      className="mt-4 size-5 cursor-pointer accent-primary shrink-0 touch-manipulation"
                      checked={bulkSelected.has(appt.id)}
                      onChange={(e) => {
                        const next = new Set(bulkSelected);
                        if (e.target.checked) next.add(appt.id); else next.delete(appt.id);
                        setBulkSelected(next);
                      }}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <AppointmentCard
                      appt={appt}
                      showRisk
                      token={token}
                      onUpdated={patchAppointment}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {filteredPast.length > 0 && (
        <Card id="appointments-past" data-section-label="Past" className="dashboard-section-anchor">
          <CardHeader>
            <CardTitle>Past ({filteredPast.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {filteredPast.slice(0, 20).map((appt) => (
                <AppointmentCard key={appt.id} appt={appt} token={token} onUpdated={patchAppointment} />
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
        <Card id="appointments-waitlist" data-section-label="Waitlist" className="dashboard-section-anchor">
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
                    className="min-h-[2.75rem] min-w-[2.75rem] rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors disabled:opacity-40 shrink-0 touch-manipulation"
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
        <div className="dashboard-h-scroll gap-3 pb-2 -mx-1 px-1 snap-x snap-mandatory">
          {todayAppts.map((a) => {
            const startTime = new Date(a.start).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
            const endTime = new Date(a.end).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
            const isPast = new Date(a.end) < new Date();
            const isNow = new Date(a.start) <= new Date() && new Date(a.end) > new Date();
            return (
              <div
                key={a.id}
                className={`shrink-0 snap-start rounded-xl border p-3.5 min-w-[170px] max-w-[220px] space-y-2 transition-all ${
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

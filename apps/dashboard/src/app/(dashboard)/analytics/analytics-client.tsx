'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { APPOINTMENTS_LABEL } from '@/lib/dashboard-nav';
import { apiFetch, ApiError } from '@/lib/api';
import { resolveApiUrl } from '@/lib/api-config';
import { OpenClientDashboardButton } from '@/components/open-client-dashboard-button';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MonthlyReport {
  month: string;
  totalBookings: number;
  completedBookings: number;
  revenueCents: number;
  topService: string | null;
  noShowPct: number;
  newCustomerPct: number;
  returningCustomerPct: number;
  bestDay: string | null;
}

interface DailyBooking {
  booking_date: string;
  total_bookings: number;
  completed: number;
  cancelled: number;
  no_shows: number;
}

interface RevenueSummary {
  month: string;
  total_revenue_cents: number;
  unique_customers: number;
  invoice_count: number;
}

interface RetentionSummary {
  month: string;
  unique_customers: number;
  returning_customers: number;
}

interface StaffMetric {
  staffId: string;
  staffName: string;
  total_appointments: number;
  completed: number;
  no_shows: number;
  revenue_cents: number;
}

interface StaffRating {
  staffId: string;
  staffName: string;
  avg_rating: number;
  rating_count: number;
}

interface RecentRating {
  appointmentId: string;
  csatScore: number;
  start: string;
  firstName: string | null;
  lastName: string | null;
  waId: string;
  staffName: string | null;
  serviceName: string | null;
}

interface AnalyticsData {
  dailyBookings: DailyBooking[];
  revenue: RevenueSummary[];
  retention: RetentionSummary[];
  staffPerformance: StaffMetric[];
  staffRatings: StaffRating[];
  recentRatings: RecentRating[];
}

interface LoyaltyKpi {
  stampsEarned: number;
  stampsRedeemed: number;
  activeCustomers: number;
  redemptionRate: number;
}

interface NoShowRow {
  staffName?: string;
  serviceName?: string;
  total: number;
  no_shows: number;
  rate: number;
}

interface FunnelStep {
  label: string;
  count: number;
}

interface OptOutData {
  byMonth: { month: string; cnt: number }[];
  totalOptedOut: number;
}

interface StaffRevRow {
  staffId: string;
  staffName: string;
  bookings: number;
  completed: number;
  revenueCents: number;
  noShows: number;
}

interface CampaignRow {
  id: string;
  name: string;
  status: string;
  scheduledAt: string | null;
  sentAt: string | null;
  totalRecipients: number;
  delivered: number;
  failed: number;
}

interface Props {
  token: string;
  isAdmin?: boolean;
  initialBusinessId?: string;
}

interface BusinessOption {
  id: string;
  name: string;
  slug: string;
  status: string;
}

async function adminFetch<T>(path: string, token: string): Promise<T> {
  const res = await fetch(resolveApiUrl('admin', path, { forBrowser: true }), {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error ?? 'Request failed');
  }
  return res.json() as Promise<T>;
}

function analyticsQuery(isAdmin: boolean, selectedBusinessId: string, selectedMonth: string) {
  const params = new URLSearchParams();
  if (isAdmin && selectedBusinessId) params.set('salonId', selectedBusinessId);
  if (selectedMonth) params.set('month', selectedMonth);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

function currentMonthStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function offsetMonth(base: string, delta: number): string {
  const [y, m] = base.split('-').map(Number) as [number, number];
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return new Date(y, m - 1, 1).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' });
}

export function AnalyticsClient({ token, isAdmin = false, initialBusinessId = '' }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData]       = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [report, setReport]   = useState<MonthlyReport | null>(null);
  const [sendingReport, setSendingReport] = useState(false);
  const [sendStatus, setSendStatus] = useState<string | null>(null);
  const [loyalty, setLoyalty]   = useState<LoyaltyKpi | null>(null);
  const [staffRevenue, setStaffRevenue] = useState<StaffRevRow[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [noShowByStaff, setNoShowByStaff] = useState<NoShowRow[]>([]);
  const [noShowByService, setNoShowByService] = useState<NoShowRow[]>([]);
  const [funnel, setFunnel]     = useState<FunnelStep[]>([]);
  const [optOuts, setOptOuts]   = useState<OptOutData | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr());
  const [businesses, setBusinesses] = useState<BusinessOption[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState(initialBusinessId);
  const isCurrentMonth = selectedMonth === currentMonthStr();
  const isPlatformView = isAdmin && !selectedBusinessId;

  const selectedBusinessName = useMemo(
    () => businesses.find((b) => b.id === selectedBusinessId)?.name ?? null,
    [businesses, selectedBusinessId],
  );

  useEffect(() => {
    if (!isAdmin || !token) return;
    void adminFetch<{ businesses: BusinessOption[] }>('/analytics/businesses', token)
      .then((res) => setBusinesses(res.businesses))
      .catch(() => setBusinesses([]));
  }, [isAdmin, token]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    const q = analyticsQuery(isAdmin, selectedBusinessId, selectedMonth);
    try {
      if (isAdmin) {
        const [overview, monthlyReport, noShowData, funnelData, staffRevData] = await Promise.all([
          adminFetch<AnalyticsData>(`/analytics/overview${q}`, token),
          adminFetch<MonthlyReport>(`/analytics/monthly-report${q}`, token).catch(() => null),
          adminFetch<{ byStaff: NoShowRow[]; byService: NoShowRow[] }>(`/analytics/no-show-patterns${analyticsQuery(isAdmin, selectedBusinessId, '')}`, token).catch(() => null),
          adminFetch<{ steps: FunnelStep[] }>(`/analytics/funnel${analyticsQuery(isAdmin, selectedBusinessId, '')}`, token).catch(() => null),
          adminFetch<{ staff: StaffRevRow[] }>(`/analytics/staff-revenue${analyticsQuery(isAdmin, selectedBusinessId, '')}`, token).catch(() => null),
        ]);
        setData(overview);
        setReport(monthlyReport);
        setLoyalty(null);
        setNoShowByStaff(noShowData?.byStaff ?? []);
        setNoShowByService(noShowData?.byService ?? []);
        setFunnel(funnelData?.steps ?? []);
        setOptOuts(null);
        setStaffRevenue(staffRevData?.staff ?? []);
        setCampaigns([]);
      } else {
        const monthQ = `?month=${selectedMonth}`;
        const [overview, monthlyReport, loyaltyData, noShowData, funnelData, optOutData, staffRevData, campaignData] = await Promise.all([
          apiFetch<AnalyticsData>(`/analytics/overview${monthQ}`, {}, token),
          apiFetch<MonthlyReport>(`/analytics/monthly-report${monthQ}`, {}, token).catch(() => null),
          apiFetch<LoyaltyKpi>('/analytics/loyalty', {}, token).catch(() => null),
          apiFetch<{ byStaff: NoShowRow[]; byService: NoShowRow[] }>('/analytics/no-show-patterns', {}, token).catch(() => null),
          apiFetch<{ steps: FunnelStep[] }>('/analytics/funnel', {}, token).catch(() => null),
          apiFetch<OptOutData>('/analytics/opt-outs', {}, token).catch(() => null),
          apiFetch<{ staff: StaffRevRow[] }>('/analytics/staff-revenue', {}, token).catch(() => null),
          apiFetch<{ campaigns: CampaignRow[] }>('/campaigns', {}, token).catch(() => null),
        ]);
        setData(overview);
        setReport(monthlyReport);
        setLoyalty(loyaltyData);
        setNoShowByStaff(noShowData?.byStaff ?? []);
        setNoShowByService(noShowData?.byService ?? []);
        setFunnel(funnelData?.steps ?? []);
        setOptOuts(optOutData);
        setStaffRevenue(staffRevData?.staff ?? []);
        setCampaigns((campaignData?.campaigns ?? []).slice(0, 10));
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [token, isAdmin, selectedBusinessId, selectedMonth]);

  useEffect(() => { void load(); }, [load]);

  function handleBusinessChange(nextId: string) {
    setSelectedBusinessId(nextId);
    const params = new URLSearchParams(searchParams.toString());
    if (nextId) params.set('business', nextId);
    else params.delete('business');
    const qs = params.toString();
    router.replace(qs ? `/analytics?${qs}` : '/analytics', { scroll: false });
  }

  const sendReportToWhatsApp = async () => {
    setSendingReport(true);
    setSendStatus(null);
    try {
      await apiFetch('/analytics/monthly-report/send', { method: 'POST' }, token);
      setSendStatus('Report sent to your WhatsApp!');
    } catch (e) {
      setSendStatus(e instanceof ApiError ? e.message : 'Failed to send report');
    } finally {
      setSendingReport(false);
    }
  };

  const hasAnyData = data && (
    data.dailyBookings.length > 0 ||
    data.revenue.length > 0 ||
    data.retention.length > 0 ||
    data.staffPerformance.length > 0
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isAdmin
              ? isPlatformView
                ? 'Platform-wide performance across all MarineFlow businesses.'
                : `Performance for ${selectedBusinessName ?? 'selected business'}.`
              : 'Business performance at a glance.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && selectedBusinessId && selectedBusinessName && (
            <OpenClientDashboardButton
              businessId={selectedBusinessId}
              businessName={selectedBusinessName}
              variant="default"
              size="sm"
            />
          )}
          {isAdmin && (
            <select
              value={selectedBusinessId}
              onChange={(e) => handleBusinessChange(e.target.value)}
              className="h-9 min-w-[200px] max-w-[280px] rounded-lg border bg-card px-3 text-sm shadow-sm"
              aria-label="Filter by business"
            >
              <option value="">All businesses (platform)</option>
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          )}
          {/* Month navigator */}
          <div className="flex items-center gap-1 rounded-xl border bg-card px-1 py-1 shadow-sm">
            <button
              type="button"
              onClick={() => setSelectedMonth(offsetMonth(selectedMonth, -1))}
              className="size-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-sm font-bold"
              aria-label="Previous month"
            >
              ‹
            </button>
            <span className="px-2 text-sm font-semibold tabular-nums min-w-[140px] text-center">
              {formatMonthLabel(selectedMonth)}
            </span>
            <button
              type="button"
              onClick={() => setSelectedMonth(offsetMonth(selectedMonth, 1))}
              disabled={isCurrentMonth}
              className="size-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-sm font-bold disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Next month"
            >
              ›
            </button>
          </div>
          {!loading && (
            <Button variant="outline" size="sm" onClick={load}>
              Refresh
            </Button>
          )}
        </div>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-6 animate-pulse">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="border rounded-lg p-4 space-y-2">
                <div className="h-3 bg-muted rounded w-24" />
                <div className="h-7 bg-muted rounded w-16" />
              </div>
            ))}
          </div>
          <div className="border rounded-lg p-4 h-40 bg-muted/20" />
          <div className="border rounded-lg h-40 bg-muted/20" />
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={load}>Retry</Button>
        </div>
      )}

      {/* Zero state */}
      {!loading && !error && data && !hasAnyData && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard label="This month revenue" value="R0.00" />
            <KpiCard label={`${APPOINTMENTS_LABEL} (30 days)`} value="0" />
            <KpiCard label="Retention rate"     value="—" />
            <KpiCard label="Active customers"   value="0" />
          </div>
          <div className="rounded-lg border border-dashed p-10 text-center space-y-2">
            <p className="text-sm font-medium">No activity yet</p>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">
              {isAdmin
                ? 'Metrics appear here once businesses start taking bookings through WhatsApp.'
                : 'Analytics populate automatically once your first bookings come through WhatsApp.'}
            </p>
          </div>
        </div>
      )}

      {/* Cancellation rate alert */}
      {!loading && data && (() => {
        const totals = data.dailyBookings.reduce(
          (acc, d) => ({ bookings: acc.bookings + d.total_bookings, cancelled: acc.cancelled + d.cancelled }),
          { bookings: 0, cancelled: 0 },
        );
        const cancelRate = totals.bookings > 5 ? Math.round((totals.cancelled / totals.bookings) * 100) : 0;
        if (cancelRate < 30) return null;
        return (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 px-4 py-3 flex items-start gap-3">
            <span className="text-rose-600 font-bold text-sm mt-0.5">⚠</span>
            <div className="text-sm">
              <span className="font-semibold text-rose-700 dark:text-rose-400">High cancellation rate: {cancelRate}%</span>
              <span className="text-muted-foreground ml-2">({totals.cancelled} of {totals.bookings} bookings in the last 30 days). Consider reviewing your cancellation policy.</span>
            </div>
          </div>
        );
      })()}

      {/* Monthly Report Card */}
      {!loading && report && (
        <section className="border rounded-lg p-5 space-y-4 bg-muted/20">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-base font-semibold">
                Monthly report — {formatMonth(report.month)}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">6 key metrics at a glance</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {sendStatus && (
                <span className={`text-xs ${sendStatus.includes('sent') ? 'text-green-700 dark:text-green-400' : 'text-destructive'}`}>
                  {sendStatus}
                </span>
              )}
              {!isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void sendReportToWhatsApp()}
                  disabled={sendingReport}
                >
                  {sendingReport ? 'Sending…' : '📱 Send to my WhatsApp'}
                </Button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <KpiCard label={`Total ${APPOINTMENTS_LABEL.toLowerCase()}`} value={report.totalBookings} />
            <KpiCard label="Revenue" value={formatCurrency(report.revenueCents)} />
            <KpiCard label="Top service" value={report.topService ?? '—'} />
            <KpiCard label="No-show rate" value={`${report.noShowPct}%`} />
            <KpiCard
              label="New customers"
              value={`${report.newCustomerPct}% new · ${report.returningCustomerPct}% returning`}
            />
            <KpiCard label="Busiest day" value={report.bestDay ?? '—'} />
          </div>
        </section>
      )}

      {/* Data */}
      {!loading && !error && data && hasAnyData && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard
              label="This month revenue"
              value={formatCurrency(currentMonthRevenue(data.revenue))}
              trend={revenueTrend(data.revenue)}
            />
            <KpiCard
              label={`${APPOINTMENTS_LABEL} (30 days)`}
              value={last30DaysBookings(data.dailyBookings)}
              trend={bookingsTrend(data.dailyBookings)}
            />
            <KpiCard label="Retention rate"   value={retentionRate(data.retention)} />
            <KpiCard label="Active customers" value={data.retention.at(-1)?.unique_customers ?? 0} />
          </div>

          {/* Daily bar chart */}
          <section>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h2 className="text-base font-semibold">Daily bookings — last 30 days</h2>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="size-2.5 rounded-sm bg-emerald-500 inline-block" />Completed</span>
                <span className="flex items-center gap-1"><span className="size-2.5 rounded-sm bg-rose-400 inline-block" />Cancelled</span>
                <span className="flex items-center gap-1"><span className="size-2.5 rounded-sm bg-amber-400 inline-block" />No-show</span>
              </div>
            </div>
            {data.dailyBookings.length === 0 ? <EmptySection label="No booking data yet." /> : (
              <div className="border rounded-xl p-4 bg-card">
                <div className="flex items-end gap-0.5 h-40">
                  {(() => {
                    const slice = data.dailyBookings.slice(-30);
                    const max = Math.max(...slice.map((x) => x.total_bookings), 1);
                    return slice.map((d, i) => {
                      const total = d.total_bookings || 0;
                      const completedPct = total > 0 ? (d.completed / max) * 100 : 0;
                      const cancelledPct = total > 0 ? (d.cancelled / max) * 100 : 0;
                      const noShowPct   = total > 0 ? (d.no_shows / max) * 100 : 0;
                      const emptyPct = Math.max(0, 2 - (completedPct + cancelledPct + noShowPct));
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                          <div className="w-full flex flex-col justify-end overflow-hidden rounded-t-sm" style={{ height: `${Math.max(completedPct + cancelledPct + noShowPct, total > 0 ? 3 : 0)}%` }}>
                            {noShowPct > 0 && <div className="w-full bg-amber-400" style={{ height: `${(noShowPct / (completedPct + cancelledPct + noShowPct)) * 100}%` }} />}
                            {cancelledPct > 0 && <div className="w-full bg-rose-400" style={{ height: `${(cancelledPct / (completedPct + cancelledPct + noShowPct)) * 100}%` }} />}
                            {completedPct > 0 && <div className="w-full bg-emerald-500" style={{ height: `${(completedPct / (completedPct + cancelledPct + noShowPct)) * 100}%` }} />}
                          </div>
                          {emptyPct > 0 && total === 0 && <div className="w-full bg-muted/40 rounded-t-sm" style={{ height: '3px' }} />}
                          <span className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center z-10 pointer-events-none">
                            <span className="bg-popover border rounded-lg px-2 py-1.5 shadow-md text-[10px] whitespace-nowrap space-y-0.5">
                              <span className="block font-medium">{d.booking_date}</span>
                              <span className="block text-emerald-600">✓ {d.completed} completed</span>
                              {d.cancelled > 0 && <span className="block text-rose-500">✕ {d.cancelled} cancelled</span>}
                              {d.no_shows > 0 && <span className="block text-amber-600">◦ {d.no_shows} no-show</span>}
                            </span>
                          </span>
                        </div>
                      );
                    });
                  })()}
                </div>
                <div className="flex justify-between text-[11px] text-muted-foreground mt-2 pt-2 border-t">
                  <span>{data.dailyBookings.slice(-30)[0]?.booking_date ?? '30 days ago'}</span>
                  <span>Today</span>
                </div>
              </div>
            )}
          </section>

          {/* Revenue */}
          <section>
            <h2 className="text-base font-semibold mb-3">Monthly revenue — last 6 months</h2>
            {data.revenue.length === 0 ? <EmptySection label="No revenue data yet." /> : (
              <div className="border rounded-xl bg-card overflow-hidden">
                {/* Bar chart */}
                <div className="px-4 pt-4 pb-2">
                  <div className="flex items-end gap-2 h-28">
                    {(() => {
                      const slice = data.revenue.slice(-6);
                      const max = Math.max(...slice.map((r) => r.total_revenue_cents), 1);
                      return slice.map((r) => {
                        const pct = (r.total_revenue_cents / max) * 100;
                        return (
                          <div key={r.month} className="flex-1 flex flex-col items-center gap-1 h-full group relative justify-end">
                            <div
                              className="w-full rounded-t-md bg-primary/60 group-hover:bg-primary transition-colors min-h-[4px]"
                              style={{ height: `${Math.max(pct, 3)}%` }}
                            />
                            <span className="text-[10px] text-muted-foreground">{formatMonth(r.month).split(' ')[0]}</span>
                            <span className="absolute -top-9 left-1/2 -translate-x-1/2 hidden group-hover:block text-[10px] bg-popover border rounded-lg px-2 py-1 shadow-md whitespace-nowrap z-10 pointer-events-none">
                              {formatMonth(r.month)}: {formatCurrency(r.total_revenue_cents)}
                            </span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
                {/* Table */}
                <div className="overflow-x-auto border-t">
                  <table className="w-full text-sm min-w-[400px]">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-3 font-medium">Month</th>
                        <th className="text-right p-3 font-medium">Revenue</th>
                        <th className="text-right p-3 font-medium">Customers</th>
                        <th className="text-right p-3 font-medium">Invoices</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {data.revenue.slice(-6).reverse().map((r) => (
                        <tr key={r.month} className="hover:bg-muted/30">
                          <td className="p-3">{formatMonth(r.month)}</td>
                          <td className="p-3 text-right font-medium tabular-nums">{formatCurrency(r.total_revenue_cents)}</td>
                          <td className="p-3 text-right tabular-nums">{r.unique_customers}</td>
                          <td className="p-3 text-right tabular-nums">{r.invoice_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>

          {/* Staff */}
          <section>
            <h2 className="text-base font-semibold mb-3">Staff performance — this month</h2>
            {data.staffPerformance.length === 0 ? <EmptySection label="No staff data yet this month." /> : (
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-sm min-w-[480px]">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-3 font-medium">Staff member</th>
                      <th className="text-right p-3 font-medium">Appointments</th>
                      <th className="text-right p-3 font-medium">Completed</th>
                      <th className="text-right p-3 font-medium">No-shows</th>
                      <th className="text-right p-3 font-medium">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.staffPerformance.map((s) => (
                      <tr key={s.staffId} className="hover:bg-muted/30">
                        <td className="p-3 font-medium">{s.staffName}</td>
                        <td className="p-3 text-right tabular-nums">{s.total_appointments}</td>
                        <td className="p-3 text-right tabular-nums">{s.completed}</td>
                        <td className="p-3 text-right tabular-nums text-destructive">{s.no_shows}</td>
                        <td className="p-3 text-right tabular-nums font-medium">{formatCurrency(s.revenue_cents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Staff ratings */}
          <section>
            <h2 className="text-base font-semibold mb-3">Staff ratings — last 3 months</h2>
            {!data.staffRatings || data.staffRatings.length === 0 ? (
              <EmptySection label="No ratings yet — they'll appear after customers complete the post-visit survey." />
            ) : (
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-sm min-w-[400px]">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-3 font-medium">Staff member</th>
                      <th className="text-right p-3 font-medium">Avg rating</th>
                      <th className="text-right p-3 font-medium">No. of ratings</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.staffRatings.map((s) => (
                      <tr key={s.staffId} className="hover:bg-muted/30">
                        <td className="p-3 font-medium">{s.staffName ?? '—'}</td>
                        <td className="p-3 text-right">
                          <span className="tabular-nums mr-1">{s.avg_rating.toFixed(1)}</span>
                          <StarDisplay score={Math.round(s.avg_rating)} />
                        </td>
                        <td className="p-3 text-right tabular-nums">{s.rating_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Retention */}
          <section>
            <h2 className="text-base font-semibold mb-3">Customer retention</h2>
            {data.retention.length === 0 ? <EmptySection label="No retention data yet." /> : (
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-sm min-w-[400px]">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-3 font-medium">Month</th>
                      <th className="text-right p-3 font-medium">Unique customers</th>
                      <th className="text-right p-3 font-medium">Returning</th>
                      <th className="text-right p-3 font-medium">Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.retention.slice(-6).reverse().map((r) => {
                      const rate = r.unique_customers > 0
                        ? Math.round((r.returning_customers / r.unique_customers) * 100)
                        : null;
                      return (
                        <tr key={r.month} className="hover:bg-muted/30">
                          <td className="p-3">{formatMonth(r.month)}</td>
                          <td className="p-3 text-right tabular-nums">{r.unique_customers}</td>
                          <td className="p-3 text-right tabular-nums">{r.returning_customers}</td>
                          <td className={cn('p-3 text-right font-medium tabular-nums',
                            rate !== null && rate >= 50 ? 'text-green-700 dark:text-green-400' : ''
                          )}>
                            {rate !== null ? `${rate}%` : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Recent reviews */}
          <section>
            <h2 className="text-base font-semibold mb-3">Recent reviews</h2>
            {!data.recentRatings || data.recentRatings.length === 0 ? (
              <EmptySection label="No reviews yet." />
            ) : (
              <div className="border rounded-lg divide-y overflow-x-auto">
                {data.recentRatings.map((r) => {
                  const name = r.firstName
                    ? `${r.firstName} ${r.lastName ? r.lastName.charAt(0) + '.' : ''}`.trim()
                    : r.waId;
                  return (
                    <div key={r.appointmentId} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm hover:bg-muted/30">
                      <StarDisplay score={r.csatScore} />
                      <span className="font-medium min-w-[100px]">{name}</span>
                      {r.serviceName && <span className="text-muted-foreground">{r.serviceName}</span>}
                      {r.staffName && <span className="text-muted-foreground">· {r.staffName}</span>}
                      <span className="ml-auto text-muted-foreground tabular-nums">{formatDate(r.start)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Loyalty KPIs */}
          {loyalty && (
            <section>
              <h2 className="text-base font-semibold mb-3">Loyalty programme — last 30 days</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KpiCard label="Stamps earned" value={loyalty.stampsEarned} />
                <KpiCard label="Stamps redeemed" value={loyalty.stampsRedeemed} />
                <KpiCard label="Active members" value={loyalty.activeCustomers} />
                <KpiCard
                  label="Redemption rate"
                  value={loyalty.stampsEarned > 0 ? `${loyalty.redemptionRate}%` : '—'}
                />
              </div>
            </section>
          )}

          {/* No-show patterns */}
          {(noShowByStaff.length > 0 || noShowByService.length > 0) && (
            <section>
              <h2 className="text-base font-semibold mb-3">No-show patterns — last 90 days</h2>
              <p className="text-xs text-muted-foreground mb-3">Rows with ≥ 3 appointments only.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {noShowByStaff.length > 0 && (
                  <div className="border rounded-lg overflow-x-auto">
                    <p className="text-xs font-medium text-muted-foreground px-3 pt-3">By staff</p>
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-3 font-medium">Staff</th>
                          <th className="text-right p-3 font-medium">Appts</th>
                          <th className="text-right p-3 font-medium">No-show</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {noShowByStaff.map((p, i) => (
                          <tr key={i} className="hover:bg-muted/30">
                            <td className="p-3 font-medium">{p.staffName ?? '—'}</td>
                            <td className="p-3 text-right tabular-nums">{p.total}</td>
                            <td className={cn(
                              'p-3 text-right font-medium tabular-nums',
                              p.rate >= 30 ? 'text-destructive' : p.rate >= 15 ? 'text-yellow-700 dark:text-yellow-400' : '',
                            )}>
                              {p.rate}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {noShowByService.length > 0 && (
                  <div className="border rounded-lg overflow-x-auto">
                    <p className="text-xs font-medium text-muted-foreground px-3 pt-3">By service</p>
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-3 font-medium">Service</th>
                          <th className="text-right p-3 font-medium">Appts</th>
                          <th className="text-right p-3 font-medium">No-show</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {noShowByService.map((p, i) => (
                          <tr key={i} className="hover:bg-muted/30">
                            <td className="p-3 font-medium">{p.serviceName ?? '—'}</td>
                            <td className="p-3 text-right tabular-nums">{p.total}</td>
                            <td className={cn(
                              'p-3 text-right font-medium tabular-nums',
                              p.rate >= 30 ? 'text-destructive' : p.rate >= 15 ? 'text-yellow-700 dark:text-yellow-400' : '',
                            )}>
                              {p.rate}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Booking funnel */}
          {funnel.length > 0 && (
            <section>
              <h2 className="text-base font-semibold mb-3">Booking funnel — last 30 days</h2>
              <div className="border rounded-lg divide-y">
                {funnel.map((step, i) => {
                  const prev = i > 0 ? funnel[i - 1]!.count : null;
                  const dropPct = prev !== null && prev > 0 ? Math.round(((prev - step.count) / prev) * 100) : null;
                  return (
                    <div key={step.label} className="flex items-center gap-4 px-4 py-3">
                      <span className="size-6 flex items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{step.label}</p>
                        {dropPct !== null && dropPct > 0 && (
                          <p className="text-xs text-muted-foreground">↓ {dropPct}% drop from previous step</p>
                        )}
                      </div>
                      <span className="text-lg font-bold tabular-nums">{step.count.toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Marketing opt-outs */}
          {optOuts && (
            <section>
              <h2 className="text-base font-semibold mb-3">Marketing opt-outs</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <KpiCard label="Total opted out" value={optOuts.totalOptedOut} />
                {optOuts.byMonth.length > 0 && (
                  <div className="border rounded-lg p-4">
                    <p className="text-xs text-muted-foreground mb-3">Monthly opt-outs (last 6 months)</p>
                    <div className="flex items-end gap-1 h-16">
                      {optOuts.byMonth.slice(0, 6).reverse().map((m) => {
                        const max = Math.max(...optOuts.byMonth.slice(0, 6).map((x) => x.cnt), 1);
                        return (
                          <div key={m.month} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                            <div
                              className="w-full bg-destructive/50 rounded-t-sm min-h-[2px] transition-colors group-hover:bg-destructive"
                              style={{ height: `${Math.max((m.cnt / max) * 100, 4)}%` }}
                            />
                            <span className="absolute -top-6 left-1/2 -translate-x-1/2 hidden group-hover:block text-[10px] bg-popover border rounded px-1.5 py-0.5 whitespace-nowrap z-10 shadow-sm pointer-events-none">
                              {formatMonth(m.month)}: {m.cnt}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground mt-2">
                      <span>{optOuts.byMonth.slice(0, 6).reverse()[0] ? formatMonth(optOuts.byMonth.slice(0, 6).reverse()[0]!.month) : ''}</span>
                      <span>This month</span>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Staff revenue — last 30 days */}
          {staffRevenue.length > 0 && (
            <section>
              <h2 className="text-base font-semibold mb-3">Staff performance — last 30 days</h2>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 text-left">
                      <th className="px-4 py-2.5 font-medium text-muted-foreground">Staff</th>
                      <th className="px-4 py-2.5 font-medium text-muted-foreground text-right">{APPOINTMENTS_LABEL}</th>
                      <th className="px-4 py-2.5 font-medium text-muted-foreground text-right">Completed</th>
                      <th className="px-4 py-2.5 font-medium text-muted-foreground text-right">Revenue</th>
                      <th className="px-4 py-2.5 font-medium text-muted-foreground text-right">No-shows</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {staffRevenue.map((row) => (
                      <tr key={row.staffId} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium">{row.staffName}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{row.bookings}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{row.completed}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-medium">
                          R {Math.round(row.revenueCents / 100).toLocaleString('en-ZA')}
                        </td>
                        <td className={cn('px-4 py-3 text-right tabular-nums', row.noShows > 0 && 'text-rose-600 dark:text-rose-400')}>
                          {row.noShows}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          {/* Campaign history */}
          {campaigns.length > 0 && (
            <section>
              <h2 className="text-base font-semibold mb-3">Recent campaigns</h2>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 text-left">
                      <th className="px-4 py-2.5 font-medium text-muted-foreground">Campaign</th>
                      <th className="px-4 py-2.5 font-medium text-muted-foreground">Status</th>
                      <th className="px-4 py-2.5 font-medium text-muted-foreground text-right">Recipients</th>
                      <th className="px-4 py-2.5 font-medium text-muted-foreground text-right">Delivered</th>
                      <th className="px-4 py-2.5 font-medium text-muted-foreground text-right">Failed</th>
                      <th className="px-4 py-2.5 font-medium text-muted-foreground">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {campaigns.map((c) => {
                      const date = c.sentAt ?? c.scheduledAt;
                      const deliverPct = c.totalRecipients > 0 ? Math.round((c.delivered / c.totalRecipients) * 100) : null;
                      return (
                        <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-medium max-w-[200px] truncate">{c.name}</td>
                          <td className="px-4 py-3">
                            <span className={cn(
                              'text-[10px] font-medium px-1.5 py-0.5 rounded uppercase tracking-wide',
                              c.status === 'SENT' ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300' :
                              c.status === 'SENDING' ? 'bg-blue-100 text-blue-700' :
                              c.status === 'SCHEDULED' ? 'bg-amber-100 text-amber-700' :
                              c.status === 'FAILED' ? 'bg-red-100 text-red-700' :
                              'bg-muted text-muted-foreground',
                            )}>
                              {c.status.toLowerCase()}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">{c.totalRecipients}</td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {c.delivered}
                            {deliverPct !== null && <span className="text-muted-foreground text-xs ml-1">({deliverPct}%)</span>}
                          </td>
                          <td className={cn('px-4 py-3 text-right tabular-nums', c.failed > 0 && 'text-rose-600 dark:text-rose-400')}>
                            {c.failed}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {date ? (() => { const d = new Date(date); return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: '2-digit' }); })() : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function KpiCard({ label, value, trend }: { label: string; value: string | number; trend?: number | null }) {
  return (
    <div className="border rounded-xl p-4 bg-card">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold mt-1 tabular-nums">{value}</p>
      {trend != null && trend !== 0 && (
        <p className={cn('text-xs font-medium mt-1 flex items-center gap-0.5', trend > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400')}>
          {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}% vs last month
        </p>
      )}
    </div>
  );
}

function EmptySection({ label }: { label: string }) {
  return (
    <p className="text-sm text-muted-foreground border rounded-lg px-4 py-6 text-center">{label}</p>
  );
}

function StarDisplay({ score }: { score: number }) {
  const filled = Math.max(0, Math.min(5, Math.round(score)));
  return (
    <span className="text-yellow-500 leading-none" aria-label={`${filled} out of 5 stars`}>
      {'★'.repeat(filled)}{'☆'.repeat(5 - filled)}
    </span>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatCurrency(cents: number): string {
  return `R${(cents / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;
}

function formatMonth(iso: string): string {
  // iso is "YYYY-MM" from the DB — append -01 so Date parsing is unambiguous
  return new Date(`${iso}-01`).toLocaleDateString('en-ZA', { month: 'short', year: 'numeric' });
}

function currentMonthRevenue(revenue: RevenueSummary[]): number {
  if (revenue.length === 0) return 0;
  return revenue[revenue.length - 1]!.total_revenue_cents;
}

function last30DaysBookings(daily: DailyBooking[]): number {
  return daily.slice(-30).reduce((sum, d) => sum + d.total_bookings, 0);
}

function revenueTrend(revenue: RevenueSummary[]): number | null {
  if (revenue.length < 2) return null;
  const curr = revenue[revenue.length - 1]!.total_revenue_cents;
  const prev = revenue[revenue.length - 2]!.total_revenue_cents;
  if (prev === 0) return null;
  return Math.round(((curr - prev) / prev) * 100);
}

function bookingsTrend(daily: DailyBooking[]): number | null {
  const last30 = daily.slice(-30).reduce((s, d) => s + d.total_bookings, 0);
  const prev30 = daily.slice(-60, -30).reduce((s, d) => s + d.total_bookings, 0);
  if (prev30 === 0) return null;
  return Math.round(((last30 - prev30) / prev30) * 100);
}

function retentionRate(retention: RetentionSummary[]): string {
  const latest = retention.at(-1);
  if (!latest || latest.unique_customers === 0) return '—';
  return `${Math.round((latest.returning_customers / latest.unique_customers) * 100)}%`;
}

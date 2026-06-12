'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch, ApiError } from '@/lib/api';
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

interface Props {
  token: string;
}

export function AnalyticsClient({ token }: Props) {
  const [data, setData]       = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [report, setReport]   = useState<MonthlyReport | null>(null);
  const [sendingReport, setSendingReport] = useState(false);
  const [sendStatus, setSendStatus] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [overview, monthlyReport] = await Promise.all([
        apiFetch<AnalyticsData>('/analytics/overview', {}, token),
        apiFetch<MonthlyReport>('/analytics/monthly-report', {}, token).catch(() => null),
      ]);
      setData(overview);
      setReport(monthlyReport);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

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
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Business performance at a glance.
          </p>
        </div>
        {!loading && (
          <Button variant="outline" size="sm" onClick={load}>
            Refresh
          </Button>
        )}
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
            <KpiCard label="Bookings (30 days)" value="0" />
            <KpiCard label="Retention rate" value="—" />
            <KpiCard label="Active customers" value="0" />
          </div>
          <div className="rounded-lg border border-dashed p-10 text-center space-y-2">
            <p className="text-sm font-medium">No activity yet</p>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">
              Analytics populate automatically once your first bookings come through WhatsApp.
            </p>
          </div>
        </div>
      )}

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
              <Button
                variant="outline"
                size="sm"
                onClick={() => void sendReportToWhatsApp()}
                disabled={sendingReport}
              >
                {sendingReport ? 'Sending…' : '📱 Send to my WhatsApp'}
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <KpiCard label="Total bookings" value={report.totalBookings} />
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
            <KpiCard label="This month revenue"  value={formatCurrency(currentMonthRevenue(data.revenue))} />
            <KpiCard label="Bookings (30 days)"  value={last30DaysBookings(data.dailyBookings)} />
            <KpiCard label="Retention rate"      value={retentionRate(data.retention)} />
            <KpiCard label="Active customers"    value={data.retention.length > 0 ? data.retention[data.retention.length - 1]!.unique_customers : 0} />
          </div>

          {/* Daily bar chart */}
          <section>
            <h2 className="text-base font-semibold mb-3">Daily bookings — last 30 days</h2>
            {data.dailyBookings.length === 0 ? <EmptySection label="No booking data yet." /> : (
              <div className="border rounded-lg p-4">
                <div className="flex items-end gap-0.5 h-32">
                  {data.dailyBookings.slice(-30).map((d, i) => {
                    const max = Math.max(...data.dailyBookings.slice(-30).map((x) => x.total_bookings), 1);
                    const pct = (d.total_bookings / max) * 100;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                        <div
                          className="w-full bg-primary/70 rounded-t-sm min-h-[2px] transition-colors group-hover:bg-primary"
                          style={{ height: `${Math.max(pct, 2)}%` }}
                        />
                        <span className="absolute -top-6 left-1/2 -translate-x-1/2 hidden group-hover:block text-[10px] bg-popover border rounded px-1.5 py-0.5 whitespace-nowrap z-10 shadow-sm pointer-events-none">
                          {d.booking_date}: {d.total_bookings}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-2">
                  <span>{data.dailyBookings.slice(-30)[0]?.booking_date ?? '30 days ago'}</span>
                  <span>Today</span>
                </div>
              </div>
            )}
          </section>

          {/* Revenue */}
          <section>
            <h2 className="text-base font-semibold mb-3">Monthly revenue</h2>
            {data.revenue.length === 0 ? <EmptySection label="No revenue data yet." /> : (
              <div className="border rounded-lg overflow-x-auto">
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
        </>
      )}
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border rounded-lg p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold mt-1 tabular-nums">{value}</p>
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

function retentionRate(retention: RetentionSummary[]): string {
  if (retention.length === 0) return '—';
  const latest = retention[retention.length - 1]!;
  if (latest.unique_customers === 0) return '—';
  return `${Math.round((latest.returning_customers / latest.unique_customers) * 100)}%`;
}

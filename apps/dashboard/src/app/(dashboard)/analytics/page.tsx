import { getToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';

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
  month: string;
  total_appointments: number;
  completed: number;
  no_shows: number;
  revenue_cents: number;
}

interface AnalyticsData {
  dailyBookings: DailyBooking[];
  revenue: RevenueSummary[];
  retention: RetentionSummary[];
  staffPerformance: StaffMetric[];
}

export default async function AnalyticsPage() {
  const token = await getToken();

  let data: AnalyticsData | null = null;
  try {
    data = await apiFetch<AnalyticsData>('/analytics/overview', {}, token);
  } catch {
    // API may not be ready yet
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Business performance at a glance. Data refreshes every 15 minutes.
        </p>
      </div>

      {!data ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>Analytics data is being prepared. Check back shortly.</p>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard
              label="This Month Revenue"
              value={formatCurrency(currentMonthRevenue(data.revenue))}
            />
            <KpiCard
              label="Total Bookings (30d)"
              value={last30DaysBookings(data.dailyBookings)}
            />
            <KpiCard
              label="Retention Rate"
              value={retentionRate(data.retention)}
            />
            <KpiCard
              label="Active Customers"
              value={data.retention.length > 0
                ? data.retention[data.retention.length - 1].unique_customers
                : 0}
            />
          </div>

          {/* Bookings Trend */}
          <section>
            <h2 className="text-lg font-semibold mb-3">Daily Bookings (Last 30 Days)</h2>
            <div className="border rounded-lg p-4">
              <div className="flex items-end gap-1 h-32">
                {data.dailyBookings.slice(-30).map((d, i) => {
                  const max = Math.max(...data.dailyBookings.slice(-30).map((x) => x.total_bookings), 1);
                  const height = (d.total_bookings / max) * 100;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                      <div
                        className="w-full bg-primary/70 rounded-t-sm min-h-[2px]"
                        style={{ height: `${height}%` }}
                        title={`${d.booking_date}: ${d.total_bookings} bookings`}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-2">
                <span>30 days ago</span>
                <span>Today</span>
              </div>
            </div>
          </section>

          {/* Revenue Trend */}
          <section>
            <h2 className="text-lg font-semibold mb-3">Monthly Revenue</h2>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
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
                      <td className="p-3 text-right font-medium">
                        {formatCurrency(r.total_revenue_cents)}
                      </td>
                      <td className="p-3 text-right">{r.unique_customers}</td>
                      <td className="p-3 text-right">{r.invoice_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Staff Performance */}
          <section>
            <h2 className="text-lg font-semibold mb-3">Staff Performance (This Month)</h2>
            {data.staffPerformance.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data yet.</p>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-3 font-medium">Staff</th>
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
                        <td className="p-3 text-right">{s.total_appointments}</td>
                        <td className="p-3 text-right">{s.completed}</td>
                        <td className="p-3 text-right">{s.no_shows}</td>
                        <td className="p-3 text-right">{formatCurrency(s.revenue_cents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Retention */}
          <section>
            <h2 className="text-lg font-semibold mb-3">Customer Retention</h2>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">Month</th>
                    <th className="text-right p-3 font-medium">Unique Customers</th>
                    <th className="text-right p-3 font-medium">Returning</th>
                    <th className="text-right p-3 font-medium">Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.retention.slice(-6).reverse().map((r) => (
                    <tr key={r.month} className="hover:bg-muted/30">
                      <td className="p-3">{formatMonth(r.month)}</td>
                      <td className="p-3 text-right">{r.unique_customers}</td>
                      <td className="p-3 text-right">{r.returning_customers}</td>
                      <td className="p-3 text-right font-medium">
                        {r.unique_customers > 0
                          ? `${Math.round((r.returning_customers / r.unique_customers) * 100)}%`
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}

function formatCurrency(cents: number): string {
  return `R${(cents / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;
}

function formatMonth(iso: string): string {
  return new Date(iso).toLocaleDateString('en-ZA', { month: 'short', year: 'numeric' });
}

function currentMonthRevenue(revenue: RevenueSummary[]): number {
  if (revenue.length === 0) return 0;
  return revenue[revenue.length - 1].total_revenue_cents;
}

function last30DaysBookings(daily: DailyBooking[]): number {
  return daily.slice(-30).reduce((sum, d) => sum + d.total_bookings, 0);
}

function retentionRate(retention: RetentionSummary[]): string {
  if (retention.length === 0) return '—';
  const latest = retention[retention.length - 1];
  if (latest.unique_customers === 0) return '—';
  return `${Math.round((latest.returning_customers / latest.unique_customers) * 100)}%`;
}

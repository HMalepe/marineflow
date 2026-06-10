import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getToken, getUser } from '@/lib/auth';
import { apiFetch } from '@/lib/api';

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

// ---------------------------------------------------------------------------
// Appointment view types & helpers
// ---------------------------------------------------------------------------

interface Appointment {
  id: string;
  start: string;
  end: string;
  status: string;
  service: { name: string };
  staff: { name: string };
  customer: { displayName: string | null; waId: string };
}

// ---------------------------------------------------------------------------
// Admin view types & helpers
// ---------------------------------------------------------------------------

interface PlatformStats {
  totalSalons: number;
  activeSalons: number;
  totalCustomers: number;
  totalAppointments: number;
  recentSignups: number;
}

interface Alert {
  id: string;
  name: string;
  slug?: string;
}

interface AlertsData {
  pastDue: Alert[];
  trialExpiring: (Alert & { trialEndsAt: string })[];
  overQuota: (Alert & { tier: string; _count: { staff: number } })[];
}

async function adminFetch<T>(path: string, token: string | null): Promise<T | null> {
  if (!token) return null;
  const res = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) return null;
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function OverviewPage() {
  const [user, token] = await Promise.all([getUser(), getToken()]);

  if (user?.role === 'SUPER_ADMIN') {
    return <SuperAdminView token={token} />;
  }

  return <AppointmentView token={token} />;
}

// ---------------------------------------------------------------------------
// SUPER_ADMIN view
// ---------------------------------------------------------------------------

async function SuperAdminView({ token }: { token: string | null }) {
  let stats: PlatformStats | null = null;
  let alerts: AlertsData | null = null;

  try {
    [stats, alerts] = await Promise.all([
      adminFetch<PlatformStats>('/admin/stats', token),
      adminFetch<AlertsData>('/admin/alerts', token),
    ]);
  } catch {
    // swallow — handled below
  }

  const hasAlerts =
    alerts !== null &&
    (alerts.pastDue.length > 0 || alerts.trialExpiring.length > 0 || alerts.overQuota.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Platform Overview</h1>
          <p className="text-muted-foreground text-sm mt-1">Platform-wide stats and alerts.</p>
        </div>
        <Link
          href="/admin"
          className="inline-flex items-center text-sm font-medium text-primary hover:underline"
        >
          Go to Admin Panel &rarr;
        </Link>
      </div>

      {/* KPI cards */}
      {stats ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <KpiCard label="Total Salons" value={stats.totalSalons} />
          <KpiCard label="Active Salons" value={stats.activeSalons} />
          <KpiCard label="Total Customers" value={stats.totalCustomers.toLocaleString()} />
          <KpiCard label="Total Bookings" value={stats.totalAppointments.toLocaleString()} />
          <KpiCard label="New This Week" value={stats.recentSignups} />
        </div>
      ) : (
        <p className="text-sm text-destructive">Failed to load platform stats.</p>
      )}

      {/* Alerts */}
      {hasAlerts && alerts && (
        <section className="border border-amber-200 bg-amber-50 rounded-lg p-4 space-y-3">
          <h2 className="text-sm font-bold text-amber-800">Alerts</h2>

          {alerts.pastDue.length > 0 && (
            <div>
              <p className="text-xs font-medium text-amber-700">
                Past Due ({alerts.pastDue.length})
              </p>
              <div className="flex flex-wrap gap-2 mt-1">
                {alerts.pastDue.map((s) => (
                  <span key={s.id} className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">
                    {s.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {alerts.trialExpiring.length > 0 && (
            <div>
              <p className="text-xs font-medium text-amber-700">
                Trial Expiring Soon ({alerts.trialExpiring.length})
              </p>
              <div className="flex flex-wrap gap-2 mt-1">
                {alerts.trialExpiring.map((s) => (
                  <span
                    key={s.id}
                    className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded"
                  >
                    {s.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {alerts.overQuota.length > 0 && (
            <div>
              <p className="text-xs font-medium text-amber-700">
                Over Quota ({alerts.overQuota.length})
              </p>
              <div className="flex flex-wrap gap-2 mt-1">
                {alerts.overQuota.map((s) => (
                  <span
                    key={s.id}
                    className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded"
                  >
                    {s.name} ({s._count.staff} staff on {s.tier})
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>
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

// ---------------------------------------------------------------------------
// Default (non-admin) appointment view — unchanged
// ---------------------------------------------------------------------------

async function AppointmentView({ token }: { token: string | null }) {
  let appointments: Appointment[] = [];
  let error: string | null = null;

  try {
    const data = await apiFetch<{ appointments: Appointment[] }>(
      '/appointments/today',
      {},
      token,
    );
    appointments = data.appointments;
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load';
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Today&apos;s overview</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Today's Appointments" value={appointments.length} />
        <StatCard
          title="Confirmed"
          value={appointments.filter((a) => a.status === 'CONFIRMED' || a.status === 'CONFIRMED_PAID').length}
        />
        <StatCard
          title="Pending"
          value={appointments.filter((a) => a.status === 'HELD' || a.status === 'PENDING_PAYMENT').length}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Today&apos;s Schedule</CardTitle>
        </CardHeader>
        <CardContent>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!error && appointments.length === 0 && (
            <p className="text-sm text-muted-foreground">No appointments today.</p>
          )}
          {appointments.length > 0 && (
            <div className="space-y-3">
              {appointments.map((appt) => (
                <div
                  key={appt.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      {appt.customer.displayName ?? appt.customer.waId}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {appt.service.name} with {appt.staff.name}
                    </p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-sm">
                      {new Date(appt.start).toLocaleTimeString('en-ZA', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                    <Badge variant={appt.status === 'CONFIRMED' ? 'default' : 'secondary'}>
                      {appt.status.toLowerCase().replace('_', ' ')}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <p className="text-xs text-muted-foreground">{title}</p>
        <p className="text-2xl font-bold mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}

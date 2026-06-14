import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getToken, getUser } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { Calendar, CheckCircle, Clock, Users, MessageSquare, BarChart2 } from 'lucide-react';

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
  let onboardingDone = true;

  try {
    const [apptData, settingsData] = await Promise.all([
      apiFetch<{ appointments: Appointment[] }>('/appointments/today', {}, token),
      apiFetch<{ salon: { onboardingCompletedAt: string | null; whatsappPhoneId: string | null } }>('/settings', {}, token),
    ]);
    appointments = apptData.appointments;
    onboardingDone = !!(settingsData.salon.onboardingCompletedAt || settingsData.salon.whatsappPhoneId);
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load';
  }

  const today = new Date().toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' });
  const confirmed = appointments.filter((a) => a.status === 'CONFIRMED' || a.status === 'CONFIRMED_PAID').length;
  const pending = appointments.filter((a) => a.status === 'HELD' || a.status === 'PENDING_PAYMENT').length;

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">{today}</p>
        </div>
        <Link
          href="/appointments"
          className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline shrink-0"
        >
          <Calendar className="w-4 h-4" />
          View all appointments →
        </Link>
      </div>

      {/* Onboarding banner */}
      {!onboardingDone && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            <p className="font-semibold text-sm">Finish setting up your account</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Connect WhatsApp, add services and staff to start taking bookings.
            </p>
          </div>
          <Link
            href="/onboarding"
            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shrink-0"
          >
            Resume setup →
          </Link>
        </div>
      )}

      {/* KPI row */}
      <div className="grid gap-3 grid-cols-3 lg:grid-cols-3">
        <StatCard title="Today&apos;s bookings" value={appointments.length} icon={<Calendar className="w-5 h-5" />} />
        <StatCard title="Confirmed" value={confirmed} icon={<CheckCircle className="w-5 h-5" />} accent="green" />
        <StatCard title="Pending payment" value={pending} icon={<Clock className="w-5 h-5" />} accent={pending > 0 ? 'amber' : undefined} />
      </div>

      {/* Quick links — desktop only bonus */}
      <div className="hidden lg:grid grid-cols-3 gap-4">
        {[
          { href: '/customers', icon: <Users className="w-5 h-5" />, label: 'Customers', desc: 'View & search customer records' },
          { href: '/conversations', icon: <MessageSquare className="w-5 h-5" />, label: 'Conversations', desc: 'WhatsApp inbox & handoffs' },
          { href: '/analytics', icon: <BarChart2 className="w-5 h-5" />, label: 'Analytics', desc: 'Revenue, bookings & trends' },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group rounded-xl border bg-card px-5 py-4 flex items-start gap-3.5 hover:border-primary/40 hover:shadow-sm transition-all"
          >
            <div className="mt-0.5 shrink-0 text-muted-foreground group-hover:text-primary transition-colors">
              {item.icon}
            </div>
            <div>
              <p className="font-semibold text-sm">{item.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Today's schedule */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Today&apos;s Schedule</CardTitle>
            {appointments.length > 0 && (
              <span className="text-xs text-muted-foreground">{appointments.length} booking{appointments.length === 1 ? '' : 's'}</span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!error && appointments.length === 0 && (
            <div className="text-center py-8">
              <Calendar className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm font-medium">No appointments today</p>
              <p className="text-xs text-muted-foreground mt-1">Enjoy the quiet — or share your booking link to fill the day.</p>
            </div>
          )}
          {appointments.length > 0 && (
            <div className="space-y-2">
              {appointments.map((appt) => (
                <div
                  key={appt.id}
                  className="flex items-center gap-3 p-3 rounded-xl border hover:bg-muted/30 transition-colors"
                >
                  <div className="text-right shrink-0 w-12">
                    <p className="text-sm font-semibold tabular-nums">
                      {new Date(appt.start).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="w-px h-8 bg-border shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {appt.customer.displayName ?? appt.customer.waId}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {appt.service.name} · {appt.staff.name}
                    </p>
                  </div>
                  <Badge variant={appt.status === 'CONFIRMED' || appt.status === 'CONFIRMED_PAID' ? 'default' : 'secondary'} className="shrink-0 text-[10px]">
                    {appt.status.replace('_', ' ').toLowerCase()}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ title, value, icon, accent }: { title: string; value: number; icon?: React.ReactNode; accent?: 'green' | 'amber' }) {
  return (
    <Card className={accent === 'green' && value > 0 ? 'ring-1 ring-green-500/20' : accent === 'amber' && value > 0 ? 'ring-1 ring-amber-500/20' : ''}>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs text-muted-foreground leading-tight">{title}</p>
          {icon && <span className={`shrink-0 ${accent === 'green' && value > 0 ? 'text-green-500' : accent === 'amber' && value > 0 ? 'text-amber-500' : 'text-muted-foreground/40'}`}>{icon}</span>}
        </div>
        <p className={`text-2xl sm:text-3xl font-bold mt-1.5 tabular-nums ${accent === 'green' && value > 0 ? 'text-green-600 dark:text-green-400' : accent === 'amber' && value > 0 ? 'text-amber-600 dark:text-amber-400' : ''}`}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

// React type for JSX
import type React from 'react';

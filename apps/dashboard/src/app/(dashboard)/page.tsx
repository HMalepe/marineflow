import type React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getToken, getUser } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { APPOINTMENTS_LABEL } from '@/lib/dashboard-nav';
import { KPIStrip, type OverviewKpiData } from '@/components/KPIStrip';
import { MiniBarChart } from '@/components/MiniBarChart';
import { StatCard } from '@/components/StatCard';
import { BusinessTypeBreakdown, type BusinessTypeCount } from '@/components/BusinessTypeBreakdown';
import { RevenueRow, type AdminRevenueData } from '@/components/RevenueRow';
import { BotHealthPanel, type BotHealthData } from '@/components/BotHealthPanel';
import { ActivityFeed } from '@/components/ActivityFeed';
import { Leaderboard, type AdminLeaderboardData } from '@/components/Leaderboard';
import { SystemHealthBar, type SystemHealthData } from '@/components/SystemHealthBar';
import { SetupHealthScore, type SetupHealthData } from '@/components/SetupHealthScore';
import { SalonLiveRouterRefresh } from '@/components/salon-live-router-refresh';
import { BusinessCoachCard } from '@/components/BusinessCoachCard';
import { AdminQuickAccess } from '@/components/admin-quick-access';
import { Calendar, Users, MessageSquare, BarChart2 } from 'lucide-react';
import {
  isDashboardDebugEnabled,
  isNextInternalNavigationError,
  serializeDashboardError,
} from '@/lib/dashboard-debug';
import { DashboardDebugErrorView } from '@/components/dashboard-debug-error-view';

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
  totalBusinesses: number;
  activeBusinesses: number;
  totalCustomers: number;
  totalAppointments: number;
  recentSignups: number;
  byBusinessType?: BusinessTypeCount[];
  /** @deprecated */
  totalSalons?: number;
  /** @deprecated */
  activeSalons?: number;
}

interface Alert {
  id: string;
  name: string;
  slug?: string;
}

interface AlertsData {
  pastDue: Alert[];
  trialExpiring: (Alert & { trialEndsAt: string })[];
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
  if (isDashboardDebugEnabled()) {
    try {
      return await OverviewPageInner();
    } catch (error) {
      if (isNextInternalNavigationError(error)) throw error;
      return (
        <DashboardDebugErrorView
          context="(dashboard)/page.tsx — Overview"
          error={serializeDashboardError(error)}
        />
      );
    }
  }
  return OverviewPageInner();
}

async function OverviewPageInner() {
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
  let revenue: AdminRevenueData | null = null;
  let botHealth: BotHealthData | null = null;
  let tenantHealth: { atRiskCount: number; churningCount: number } | null = null;
  let leaderboard: AdminLeaderboardData | null = null;
  let systemHealth: SystemHealthData | null = null;

  try {
    [stats, alerts, revenue, botHealth, tenantHealth, leaderboard, systemHealth] = await Promise.all([
      adminFetch<PlatformStats>('/admin/stats', token),
      adminFetch<AlertsData>('/admin/alerts', token),
      adminFetch<AdminRevenueData>('/admin/revenue', token),
      adminFetch<BotHealthData>('/admin/bot-health', token),
      adminFetch<{ atRiskCount: number; churningCount: number }>('/admin/tenants/health', token),
      adminFetch<AdminLeaderboardData>('/admin/leaderboard', token),
      adminFetch<SystemHealthData>('/admin/system-health', token),
    ]);
  } catch {
    // swallow — handled below
  }

  const hasAlerts =
    alerts != null &&
    ((alerts.pastDue?.length ?? 0) > 0 || (alerts.trialExpiring?.length ?? 0) > 0);

  return (
    <div className="space-y-6">
      {systemHealth?.postgres?.status && systemHealth.redis?.status && systemHealth.twilio?.status && (
        <div id="platform-health" data-section-label="System health" className="dashboard-section-anchor">
          <SystemHealthBar data={systemHealth} />
        </div>
      )}

      <div
        id="platform-intro"
        data-section-label="Summary"
        className="dashboard-section-anchor flex items-start justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Platform Overview</h1>
          <p className="text-muted-foreground text-sm mt-1">Platform-wide stats and alerts.</p>
        </div>
        <Link
          href="/admin"
          className="inline-flex items-center text-sm font-medium text-primary hover:underline"
        >
          Manage businesses &rarr;
        </Link>
      </div>

      {token && (
        <div id="platform-quick-access" data-section-label="Quick access" className="dashboard-section-anchor">
          <AdminQuickAccess token={token} title="Quick access — open any client dashboard" />
        </div>
      )}

      {/* KPI cards */}
      {stats ? (
        <div id="platform-stats" data-section-label="Platform stats" className="dashboard-section-anchor space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatCard
              label="Total Businesses"
              value={stats.totalBusinesses ?? stats.totalSalons ?? 0}
              href="/admin"
            />
            <StatCard
              label="Active Businesses"
              value={stats.activeBusinesses ?? stats.activeSalons ?? 0}
              href="/admin"
            />
            <StatCard label="Total Customers" value={stats.totalCustomers.toLocaleString()} />
            <StatCard
              label={`Total ${APPOINTMENTS_LABEL}`}
              value={stats.totalAppointments.toLocaleString()}
            />
            <StatCard label="New This Week" value={stats.recentSignups} />
          </div>
          {stats.byBusinessType && stats.byBusinessType.length > 0 && (
            <BusinessTypeBreakdown counts={stats.byBusinessType} />
          )}
        </div>
      ) : (
        <p className="text-sm text-destructive">Failed to load platform stats.</p>
      )}

      {revenue && (
        <div id="platform-revenue" data-section-label="Revenue" className="dashboard-section-anchor">
          <RevenueRow data={revenue} />
        </div>
      )}

      {leaderboard && (
        <div id="platform-leaderboard" data-section-label="Leaderboard" className="dashboard-section-anchor">
          <Leaderboard data={leaderboard} />
        </div>
      )}

      {botHealth && (
        <div id="platform-bot-health" data-section-label="Bot health" className="dashboard-section-anchor">
          <BotHealthPanel data={botHealth} />
        </div>
      )}

      {token && (
        <div id="platform-activity" data-section-label="Activity feed" className="dashboard-section-anchor">
          <ActivityFeed token={token} />
        </div>
      )}

      {tenantHealth && tenantHealth.atRiskCount > 0 && (
        <div id="platform-at-risk" data-section-label="At-risk tenants" className="dashboard-section-anchor">
        <Link
          href="/admin?health=AT_RISK"
          className="block rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 hover:border-amber-500/60 transition-colors"
        >
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            {tenantHealth.atRiskCount} tenant{tenantHealth.atRiskCount !== 1 ? 's' : ''} at risk
          </p>
          <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-0.5">
            No recent bookings or bot activity — review before they churn silently.
          </p>
        </Link>
        </div>
      )}

      {/* Alerts */}
      {hasAlerts && alerts && (
        <section
          id="platform-alerts"
          data-section-label="Alerts"
          className="dashboard-section-anchor border border-amber-200 bg-amber-50 rounded-lg p-4 space-y-3"
        >
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

        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Default (non-admin) appointment view — unchanged
// ---------------------------------------------------------------------------

async function AppointmentView({ token }: { token: string | null }) {
  let appointments: Appointment[] = [];
  let overviewKpis: OverviewKpiData | null = null;
  let setupHealth: SetupHealthData | null = null;
  let error: string | null = null;
  let onboardingDone = true;

  try {
    const [apptData, settingsData, kpiData, healthData] = await Promise.all([
      apiFetch<{ appointments: Appointment[] }>('/appointments/today', {}, token),
      apiFetch<{ salon: { onboardingCompletedAt: string | null; whatsappPhoneId: string | null } }>('/settings', {}, token),
      apiFetch<OverviewKpiData>('/tenant/overview-kpis', {}, token).catch(() => null),
      apiFetch<SetupHealthData>('/tenant/setup-health', {}, token).catch(() => null),
    ]);
    appointments = apptData.appointments ?? [];
    overviewKpis = kpiData;
    setupHealth = healthData;
    onboardingDone = !!(
      settingsData.salon?.onboardingCompletedAt || settingsData.salon?.whatsappPhoneId
    );
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load';
  }

  const today = new Date().toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="space-y-6 lg:space-y-8">
      {token && <SalonLiveRouterRefresh token={token} />}

      {setupHealth && Array.isArray(setupHealth.checks) && setupHealth.checks.length > 0 && (
        <div id="overview-setup-health" data-section-label="Setup health" className="dashboard-section-anchor">
          <SetupHealthScore data={setupHealth} />
        </div>
      )}

      {/* Header */}
      <div
        id="overview-intro"
        data-section-label="Summary"
        className="dashboard-section-anchor flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3"
      >
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Overview</h1>
          <p className="text-muted-foreground text-sm mt-1">{today}</p>
          <p className="text-xs text-muted-foreground/80 mt-1 max-w-xl">
            Today&apos;s bookings, revenue, and bot activity at a glance.
          </p>
        </div>
        <Link
          href="/appointments"
          className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline shrink-0"
        >
          <Calendar className="w-4 h-4" />
          View all {APPOINTMENTS_LABEL.toLowerCase()} →
        </Link>
      </div>

      {overviewKpis && (
        <div id="overview-kpis" data-section-label="Key metrics" className="dashboard-section-anchor space-y-6 lg:space-y-8">
          <KPIStrip data={overviewKpis} />
          {Array.isArray(overviewKpis.revenueLast7Days) && overviewKpis.revenueLast7Days.length > 0 && (
            <div id="overview-revenue" data-section-label="Revenue chart" className="dashboard-section-anchor">
              <MiniBarChart data={overviewKpis.revenueLast7Days} />
            </div>
          )}
        </div>
      )}

      {token && (
        <div id="overview-coach" data-section-label="AI coach" className="dashboard-section-anchor">
          <BusinessCoachCard token={token} />
        </div>
      )}

      {/* Onboarding banner */}
      {!onboardingDone && (
        <div
          id="overview-onboarding"
          data-section-label="Finish setup"
          className="dashboard-section-anchor rounded-xl border border-primary/30 bg-primary/5 px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3"
        >
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

      {/* Quick links — desktop only bonus */}
      <div
        id="overview-shortcuts"
        data-section-label="Quick links"
        className="dashboard-section-anchor hidden lg:grid grid-cols-3 gap-4"
      >
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
      <Card id="overview-today" data-section-label="Today's schedule" className="dashboard-section-anchor">
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
                      {appt.service?.name ?? 'Service'} · {appt.staff?.name ?? 'Staff'}
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

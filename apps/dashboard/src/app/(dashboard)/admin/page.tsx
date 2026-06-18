import { Suspense } from 'react';
import { getToken } from '@/lib/auth';
import { APPOINTMENTS_LABEL } from '@/lib/dashboard-nav';
import { AdminSalonList } from './admin-salon-list';
import { AdminPlatformInbox } from './admin-platform-inbox';
import { AdminQuickAccess } from '@/components/admin-quick-access';
import { StatCard } from '@/components/StatCard';
import { BusinessTypeBreakdown, type BusinessTypeCount } from '@/components/BusinessTypeBreakdown';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

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
  const res = await fetch(`${API_URL}/admin${path}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) return null;
  return res.json() as Promise<T>;
}

export default async function AdminPage() {
  const token = await getToken();

  let stats: PlatformStats | null = null;
  let alerts: AlertsData | null = null;

  try {
    [stats, alerts] = await Promise.all([
      adminFetch<PlatformStats>('/stats', token),
      adminFetch<AlertsData>('/alerts', token),
    ]);
  } catch {
    // Admin API may not be accessible for non-admin users
  }

  if (!stats) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <p className="text-lg font-medium">Admin Panel</p>
        <p className="text-sm mt-2">Access restricted to platform administrators.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Platform</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Platform-wide management — click any business for stats, team, and alerts.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="Total Businesses" value={stats.totalBusinesses ?? stats.totalSalons ?? 0} />
        <StatCard label="Active Businesses" value={stats.activeBusinesses ?? stats.activeSalons ?? 0} />
        <StatCard label="Total Customers" value={stats.totalCustomers.toLocaleString()} />
        <StatCard label={`Total ${APPOINTMENTS_LABEL}`} value={stats.totalAppointments.toLocaleString()} />
        <StatCard label="New (7d)" value={stats.recentSignups} />
      </div>

      {stats.byBusinessType && stats.byBusinessType.length > 0 && (
        <BusinessTypeBreakdown counts={stats.byBusinessType} />
      )}

      {/* Alerts */}
      {alerts && (alerts.pastDue.length > 0 || alerts.trialExpiring.length > 0) && (
        <section className="border border-amber-200 bg-amber-50 rounded-lg p-4 space-y-3">
          <h2 className="text-sm font-bold text-amber-800">Alerts</h2>
          {alerts.pastDue.length > 0 && (
            <div>
              <p className="text-xs font-medium text-amber-700">Past Due ({alerts.pastDue.length})</p>
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
              <p className="text-xs font-medium text-amber-700">Trial Expiring Soon ({alerts.trialExpiring.length})</p>
              <div className="flex flex-wrap gap-2 mt-1">
                {alerts.trialExpiring.map((s) => (
                  <span key={s.id} className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
                    {s.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      <AdminQuickAccess token={token ?? ''} />

      {/* Platform inbox — owner messages + bot errors */}
      <AdminPlatformInbox token={token ?? ''} />

      {/* Tenant health table */}
      <Suspense fallback={<p className="text-sm text-muted-foreground py-8 text-center">Loading businesses…</p>}>
        <AdminSalonList token={token ?? ''} />
      </Suspense>
    </div>
  );
}

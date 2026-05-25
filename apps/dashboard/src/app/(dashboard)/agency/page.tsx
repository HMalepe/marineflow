import { getToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { AgencyDashboard } from './agency-dashboard';

interface AgencyMetrics {
  totalSalons: number;
  activeSalons: number;
  totalCustomers: number;
  totalAppointments: number;
}

interface AgencySalon {
  id: string;
  name: string;
  slug: string;
  status: string;
  tier: string;
  createdAt: string;
  _count: { staff: number; customers: number; appointments: number };
}

export default async function AgencyPage() {
  const token = await getToken();

  let metrics: AgencyMetrics | null = null;
  let salons: AgencySalon[] = [];

  try {
    const [metricsRes, salonsRes] = await Promise.all([
      apiFetch<AgencyMetrics>('/metrics', {}, token).catch(() => null),
      apiFetch<{ salons: AgencySalon[] }>('/salons', {}, token).catch(() => ({ salons: [] })),
    ]);
    metrics = metricsRes;
    salons = salonsRes?.salons ?? [];
  } catch {
    // Not an agency user
  }

  if (!metrics) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <p className="text-lg font-medium">Agency Portal</p>
        <p className="text-sm mt-2">Access restricted to agency users.</p>
      </div>
    );
  }

  return <AgencyDashboard metrics={metrics} salons={salons} token={token ?? ''} />;
}

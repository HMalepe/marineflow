import { getToken } from '@/lib/auth';
import { AgencyDashboard } from './agency-dashboard';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

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

async function agencyFetch<T>(path: string, token: string | null): Promise<T | null> {
  if (!token) return null;
  const res = await fetch(`${API_URL}/agency${path}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) return null;
  return res.json() as Promise<T>;
}

export default async function AgencyPage() {
  const token = await getToken();

  let metrics: AgencyMetrics | null = null;
  let salons: AgencySalon[] = [];

  try {
    const [metricsRes, salonsRes] = await Promise.all([
      agencyFetch<AgencyMetrics>('/metrics', token),
      agencyFetch<{ salons: AgencySalon[] }>('/salons', token),
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

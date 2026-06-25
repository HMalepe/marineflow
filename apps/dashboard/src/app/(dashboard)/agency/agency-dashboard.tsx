'use client';

import { useState } from 'react';
import { APPOINTMENTS_LABEL } from '@/lib/dashboard-nav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DashboardPageHeader } from '@/components/dashboard-page-header';

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

interface Props {
  metrics: AgencyMetrics;
  salons: AgencySalon[];
  token: string;
}

import { resolveApiUrl } from '@/lib/api-config';

export function AgencyDashboard({ metrics, salons: initialSalons, token }: Props) {
  const [salons, setSalons] = useState(initialSalons);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreating(true);
    const form = new FormData(e.currentTarget);
    const body = {
      name: form.get('name') as string,
      slug: form.get('slug') as string,
      ownerEmail: form.get('ownerEmail') as string,
      ownerPassword: form.get('ownerPassword') as string,
    };

    const res = await fetch(resolveApiUrl('agency', '/salons', { forBrowser: true }), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const { salon } = await res.json();
      setSalons([salon, ...salons]);
      setShowCreate(false);
    }
    setCreating(false);
  }

  return (
    <div className="dashboard-page-flow space-y-8">
      <DashboardPageHeader
        title="Agency Portal"
        variant="violet"
        subtitle="Manage your businesses and monitor performance."
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total Businesses" value={metrics.totalSalons} />
        <KpiCard label="Active" value={metrics.activeSalons} />
        <KpiCard label="Customers" value={metrics.totalCustomers.toLocaleString()} />
        <KpiCard label={APPOINTMENTS_LABEL} value={metrics.totalAppointments.toLocaleString()} />
      </div>

      {/* Create business */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Your Businesses ({salons.length})</h2>
        <Button onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? 'Cancel' : '+ New Business'}
        </Button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="border rounded-lg p-4 space-y-3 bg-card">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Business name</Label>
              <Input name="name" placeholder="e.g. Glow Beauty Studio" required />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">URL Slug</Label>
              <Input name="slug" placeholder="e.g. glow-beauty" required pattern="[a-z0-9-]+" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Owner Email</Label>
              <Input name="ownerEmail" type="email" placeholder="owner@salon.co.za" required />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Owner Password</Label>
              <Input name="ownerPassword" type="password" placeholder="Min 8 characters" required minLength={8} />
            </div>
          </div>
          <Button type="submit" disabled={creating}>
            {creating ? 'Creating...' : 'Create business'}
          </Button>
        </form>
      )}

      {/* Business table */}
      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium">Business</th>
              <th className="text-left p-3 font-medium">Status</th>
              <th className="text-left p-3 font-medium">Tier</th>
              <th className="text-right p-3 font-medium">Staff</th>
              <th className="text-right p-3 font-medium">Customers</th>
              <th className="text-right p-3 font-medium">{APPOINTMENTS_LABEL}</th>
              <th className="text-left p-3 font-medium">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {salons.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted-foreground">
                  No businesses yet. Create your first one above.
                </td>
              </tr>
            )}
            {salons.map((s) => (
              <tr key={s.id} className="hover:bg-muted/30">
                <td className="p-3">
                  <p className="font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.slug}</p>
                </td>
                <td className="p-3">
                  <StatusBadge status={s.status} />
                </td>
                <td className="p-3">
                  <span className="text-xs font-medium px-2 py-0.5 bg-muted rounded capitalize">
                    {s.tier}
                  </span>
                </td>
                <td className="p-3 text-right">{s._count?.staff ?? 0}</td>
                <td className="p-3 text-right">{s._count?.customers ?? 0}</td>
                <td className="p-3 text-right">{s._count?.appointments ?? 0}</td>
                <td className="p-3 text-muted-foreground text-xs">
                  {new Date(s.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-700',
    TRIAL: 'bg-blue-100 text-blue-700',
    PAST_DUE: 'bg-red-100 text-red-700',
    SUSPENDED: 'bg-gray-100 text-gray-700',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[status] ?? 'bg-muted'}`}>
      {status}
    </span>
  );
}

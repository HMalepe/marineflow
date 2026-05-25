'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Salon {
  id: string;
  name: string;
  slug: string;
  status: string;
  tier: string;
  createdAt: string;
  _count: {
    staff: number;
    customers: number;
    appointments: number;
    branches: number;
  };
}

interface Props {
  token: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export function AdminSalonList({ token }: Props) {
  const [salons, setSalons] = useState<Salon[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [impersonating, setImpersonating] = useState<string | null>(null);

  useEffect(() => {
    loadSalons();
  }, [page, search]);

  async function loadSalons() {
    const params = new URLSearchParams({ page: String(page) });
    if (search) params.set('search', search);

    const res = await fetch(`${API_URL}/admin/salons?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setSalons(data.salons);
      setTotal(data.total);
    }
  }

  async function handleImpersonate(salonId: string) {
    const res = await fetch(`${API_URL}/admin/salons/${salonId}/impersonate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    if (res.ok) {
      const data = await res.json();
      setImpersonating(data.impersonating);
      // Store impersonation token for session
      document.cookie = `imp_token=${data.token}; path=/; max-age=3600; SameSite=Strict`;
      alert(`Impersonating ${data.salon.name} as ${data.impersonating}. Token stored.`);
    } else {
      const err = await res.json();
      alert(err.error ?? 'Failed to impersonate');
    }
  }

  const pages = Math.ceil(total / 25);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Salons ({total})</h2>
        <Input
          className="max-w-xs"
          placeholder="Search salons..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium">Salon</th>
              <th className="text-left p-3 font-medium">Status</th>
              <th className="text-left p-3 font-medium">Tier</th>
              <th className="text-right p-3 font-medium">Staff</th>
              <th className="text-right p-3 font-medium">Customers</th>
              <th className="text-right p-3 font-medium">Bookings</th>
              <th className="text-left p-3 font-medium">Created</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {salons.map((s) => (
              <tr key={s.id} className="hover:bg-muted/30">
                <td className="p-3">
                  <div>
                    <p className="font-medium">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.slug}</p>
                  </div>
                </td>
                <td className="p-3">
                  <StatusBadge status={s.status} />
                </td>
                <td className="p-3">
                  <span className="text-xs font-medium px-2 py-0.5 bg-muted rounded capitalize">
                    {s.tier}
                  </span>
                </td>
                <td className="p-3 text-right">{s._count.staff}</td>
                <td className="p-3 text-right">{s._count.customers}</td>
                <td className="p-3 text-right">{s._count.appointments}</td>
                <td className="p-3 text-muted-foreground text-xs">
                  {new Date(s.createdAt).toLocaleDateString()}
                </td>
                <td className="p-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleImpersonate(s.id)}
                    className="text-xs"
                  >
                    Impersonate
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {pages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>
            Next
          </Button>
        </div>
      )}

      {impersonating && (
        <p className="text-xs text-muted-foreground text-center">
          Last impersonated: {impersonating}
        </p>
      )}
    </section>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-700',
    TRIAL: 'bg-blue-100 text-blue-700',
    PAST_DUE: 'bg-red-100 text-red-700',
    SUSPENDED: 'bg-gray-100 text-gray-700',
    CHURNED: 'bg-gray-200 text-gray-600',
  };

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[status] ?? 'bg-muted'}`}>
      {status}
    </span>
  );
}

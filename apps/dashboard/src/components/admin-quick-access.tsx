'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '@/lib/api';
import { resolveApiUrl } from '@/lib/api-config';
import { OpenClientDashboardButton } from '@/components/open-client-dashboard-button';

interface BusinessRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  industryTemplate?: string;
}

async function adminFetch<T>(path: string, token: string): Promise<T> {
  const res = await fetch(resolveApiUrl('admin', path, { forBrowser: true }), {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error ?? 'Request failed');
  }
  return res.json() as Promise<T>;
}

export function AdminQuickAccess({ token, title = 'Quick access — client dashboards' }: { token: string; title?: string }) {
  const [businesses, setBusinesses] = useState<BusinessRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminFetch<{ salons: BusinessRow[] }>('/salons?limit=200', token);
      setBusinesses(data.salons);
    } catch {
      setBusinesses([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading businesses…</p>;
  }

  if (businesses.length === 0) return null;

  return (
    <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Jump straight into any client&apos;s WhatsApp bot dashboard to fix settings, conversations, or roster.
        </p>
        <div className="flex flex-wrap gap-2">
          {businesses.map((b) => (
            <div
              key={b.id}
              className="inline-flex items-center gap-2 rounded-lg border bg-card px-2.5 py-1.5 shadow-sm"
            >
              <span className="text-sm font-medium truncate max-w-[160px]" title={b.name}>
                {b.name}
              </span>
              <OpenClientDashboardButton
                businessId={b.id}
                businessName={b.name}
                variant="default"
                size="xs"
                compact
              />
            </div>
          ))}
        </div>
    </div>
  );
}

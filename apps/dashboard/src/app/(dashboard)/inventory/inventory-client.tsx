'use client';

import { useCallback, useMemo, useState, useTransition } from 'react';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useSalonLiveUpdates } from '@/hooks/use-salon-live-updates';

export type InventorySku = {
  id: string;
  name: string;
  priceCents: number;
  active: boolean;
  trackInventory: boolean;
  stockQty: number;
  lowStockThreshold: number;
  category: { id: string; name: string } | null;
};

function formatZar(cents: number) {
  return `R${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

function statusOf(s: InventorySku): 'out' | 'low' | 'ok' | 'off' {
  if (!s.active) return 'off';
  if (!s.trackInventory) return 'ok';
  if (s.stockQty <= 0) return 'out';
  if (s.stockQty <= s.lowStockThreshold) return 'low';
  return 'ok';
}

export function InventoryClient({
  token,
  initialServices,
}: {
  token: string;
  initialServices: InventorySku[];
}) {
  const [services, setServices] = useState(initialServices);
  const [filter, setFilter] = useState<'ALL' | 'OUT' | 'LOW' | 'OK'>('ALL');
  const [query, setQuery] = useState('');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiFetch<{ services: InventorySku[] }>('/services', {}, token);
      setServices(data.services ?? []);
    } catch {
      // keep
    }
  }, [token]);

  const onLiveUpdate = useCallback(
    (type: string) => {
      if (type === 'service.catalog_changed') void refresh();
    },
    [refresh],
  );
  useSalonLiveUpdates(token, onLiveUpdate);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return services.filter((s) => {
      if (q && !s.name.toLowerCase().includes(q) && !s.category?.name.toLowerCase().includes(q)) {
        return false;
      }
      const st = statusOf(s);
      if (filter === 'OUT') return st === 'out';
      if (filter === 'LOW') return st === 'low';
      if (filter === 'OK') return st === 'ok' && s.trackInventory;
      return true;
    });
  }, [services, filter, query]);

  const counts = useMemo(() => {
    let out = 0;
    let low = 0;
    for (const s of services) {
      const st = statusOf(s);
      if (st === 'out') out += 1;
      if (st === 'low') low += 1;
    }
    return { out, low, total: services.length };
  }, [services]);

  function patchLocal(id: string, patch: Partial<InventorySku>) {
    setServices((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  async function saveSku(id: string, patch: Partial<InventorySku>) {
    setError(null);
    startTransition(async () => {
      try {
        const data = await apiFetch<{ service: InventorySku }>(
          `/services/${id}`,
          { method: 'PATCH', body: JSON.stringify(patch) },
          token,
        );
        patchLocal(id, data.service);
        setSavedId(id);
        setTimeout(() => setSavedId((cur) => (cur === id ? null : cur)), 1200);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not save stock');
        void refresh();
      }
    });
  }

  async function enableTrackingAll() {
    setError(null);
    startTransition(async () => {
      try {
        const updates = services
          .filter((s) => s.active && !s.trackInventory)
          .map((s) => ({
            id: s.id,
            trackInventory: true,
            stockQty: s.stockQty > 0 ? s.stockQty : 25,
          }));
        if (updates.length === 0) return;
        await apiFetch('/inventory/bulk', { method: 'POST', body: JSON.stringify({ updates }) }, token);
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Bulk update failed');
      }
    });
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="dashboard-section-anchor" id="inventory-hero" data-section-label="Inventory">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/70 mb-2">
          Dispensary ops
        </p>
        <h1 className="text-3xl font-semibold tracking-tight solupair-text-gradient">Inventory</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-xl">
          Stock levels drive WhatsApp availability — out-of-stock SKUs stay off the menu until you
          restock. Customer order history lives in the same database as every other MarineFlow
          tenant.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-border/60 bg-card/40 p-4">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">SKUs</p>
          <p className="text-2xl font-bold tabular-nums mt-1">{counts.total}</p>
        </div>
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="text-[11px] uppercase tracking-wide text-amber-800 dark:text-amber-200">Low</p>
          <p className="text-2xl font-bold tabular-nums mt-1">{counts.low}</p>
        </div>
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4">
          <p className="text-[11px] uppercase tracking-wide text-destructive">Out</p>
          <p className="text-2xl font-bold tabular-nums mt-1">{counts.out}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        {(
          [
            ['ALL', 'All'],
            ['OUT', 'Out of stock'],
            ['LOW', 'Low stock'],
            ['OK', 'In stock'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={cn(
              'rounded-full px-4 py-2 text-xs font-semibold border transition-all',
              filter === id
                ? 'nav-link-active text-foreground'
                : 'bg-muted/40 text-muted-foreground border-border/60 hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search products…"
          className="ml-auto min-w-[12rem] flex-1 max-w-xs rounded-xl border border-border/60 bg-background/70 px-3 py-2 text-sm"
        />
        <button
          type="button"
          disabled={pending}
          onClick={() => void enableTrackingAll()}
          className="rounded-xl border border-border/70 px-3 py-2 text-xs font-semibold hover:border-primary/30 disabled:opacity-40"
        >
          Track all active SKUs
        </button>
      </div>

      {error && (
        <p className="text-sm text-destructive border border-destructive/30 rounded-xl px-3 py-2">
          {error}
        </p>
      )}

      <ul className="space-y-2">
        {visible.map((s) => {
          const st = statusOf(s);
          return (
            <li
              key={s.id}
              className={cn(
                'rounded-2xl border bg-card/40 px-4 py-3 flex flex-wrap items-center gap-3',
                st === 'out' && 'border-destructive/35',
                st === 'low' && 'border-amber-500/35',
                st === 'ok' && 'border-border/60',
                st === 'off' && 'border-border/40 opacity-70',
                savedId === s.id && 'ring-2 ring-emerald-500/40',
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm truncate">{s.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {s.category?.name ?? 'Uncategorised'} · {formatZar(s.priceCents)}
                  {!s.trackInventory ? ' · not tracked' : ''}
                </p>
              </div>

              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={s.trackInventory}
                  disabled={pending}
                  onChange={(e) => {
                    const trackInventory = e.target.checked;
                    patchLocal(s.id, { trackInventory });
                    void saveSku(s.id, {
                      trackInventory,
                      ...(trackInventory && s.stockQty <= 0 ? { stockQty: 10 } : {}),
                    });
                  }}
                />
                Track
              </label>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={pending || !s.trackInventory}
                  className="size-8 rounded-lg border border-border/70 text-sm font-bold disabled:opacity-30"
                  onClick={() => {
                    const stockQty = Math.max(0, s.stockQty - 1);
                    patchLocal(s.id, { stockQty });
                    void saveSku(s.id, { stockQty, trackInventory: true });
                  }}
                >
                  −
                </button>
                <input
                  type="number"
                  min={0}
                  value={s.stockQty}
                  disabled={pending || !s.trackInventory}
                  onChange={(e) => {
                    const stockQty = Math.max(0, Number.parseInt(e.target.value || '0', 10) || 0);
                    patchLocal(s.id, { stockQty });
                  }}
                  onBlur={() => {
                    if (!s.trackInventory) return;
                    void saveSku(s.id, { stockQty: s.stockQty, trackInventory: true });
                  }}
                  className="w-16 rounded-lg border border-border/70 bg-background/80 px-2 py-1.5 text-center text-sm tabular-nums disabled:opacity-30"
                />
                <button
                  type="button"
                  disabled={pending || !s.trackInventory}
                  className="size-8 rounded-lg border border-border/70 text-sm font-bold disabled:opacity-30"
                  onClick={() => {
                    const stockQty = s.stockQty + 1;
                    patchLocal(s.id, { stockQty });
                    void saveSku(s.id, { stockQty, trackInventory: true });
                  }}
                >
                  +
                </button>
              </div>

              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  const active = !s.active;
                  patchLocal(s.id, { active });
                  void saveSku(s.id, { active });
                }}
                className={cn(
                  'rounded-xl px-3 py-2 text-[11px] font-semibold border',
                  s.active
                    ? 'border-border/70 text-muted-foreground'
                    : 'border-destructive/30 text-destructive',
                )}
              >
                {s.active ? 'On menu' : 'Hidden'}
              </button>

              <button
                type="button"
                disabled={pending || !s.trackInventory}
                onClick={() => {
                  patchLocal(s.id, { stockQty: 0, trackInventory: true });
                  void saveSku(s.id, { stockQty: 0, trackInventory: true });
                }}
                className="rounded-xl px-3 py-2 text-[11px] font-semibold border border-destructive/30 text-destructive disabled:opacity-30"
              >
                Mark OOS
              </button>
            </li>
          );
        })}
      </ul>

      {visible.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-10">
          No products match this filter. Seed the Dr. Marley menu or clear search.
        </p>
      )}
    </div>
  );
}

'use client';

import { useCallback, useMemo, useState, useTransition } from 'react';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useSalonLiveUpdates } from '@/hooks/use-salon-live-updates';

export type RetailOrderRow = {
  id: string;
  status: string;
  fulfillment: 'DELIVERY' | 'COLLECTION';
  subtotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  deliveryLine1: string | null;
  deliverySuburb: string | null;
  deliveryCity: string | null;
  createdAt: string;
  items: {
    id: string;
    nameSnapshot: string;
    quantity: number;
    unitPriceCents: number;
    lineTotalCents: number;
  }[];
  customer: {
    id: string;
    displayName: string | null;
    firstName: string | null;
    lastName: string | null;
    waId: string;
  };
};

const STATUS_FLOW = [
  'PAID',
  'PREPARING',
  'OUT_FOR_DELIVERY',
  'READY_FOR_COLLECTION',
  'COMPLETED',
] as const;

function formatZar(cents: number) {
  return `R${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

function customerLabel(o: RetailOrderRow) {
  return (
    o.customer.displayName?.trim() ||
    [o.customer.firstName, o.customer.lastName].filter(Boolean).join(' ') ||
    o.customer.waId
  );
}

function statusChip(status: string) {
  const map: Record<string, string> = {
    PAID: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30',
    PREPARING: 'bg-amber-500/15 text-amber-900 dark:text-amber-200 border-amber-500/30',
    OUT_FOR_DELIVERY: 'bg-sky-500/15 text-sky-900 dark:text-sky-200 border-sky-500/30',
    READY_FOR_COLLECTION: 'bg-violet-500/15 text-violet-900 dark:text-violet-200 border-violet-500/30',
    COMPLETED: 'bg-muted text-muted-foreground border-border',
    CANCELLED: 'bg-destructive/10 text-destructive border-destructive/30',
  };
  return map[status] ?? 'bg-muted text-muted-foreground border-border';
}

export function OrdersClient({
  token,
  initialOrders,
}: {
  token: string;
  initialOrders: RetailOrderRow[];
}) {
  const [orders, setOrders] = useState(initialOrders);
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'DONE'>('ACTIVE');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const refreshOrders = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiFetch<{ orders: RetailOrderRow[] }>('/retail-orders', {}, token);
      setOrders(data.orders ?? []);
    } catch {
      // keep current list
    }
  }, [token]);

  const onLiveUpdate = useCallback(
    (eventType: string) => {
      if (eventType === 'retail.order.created' || eventType === 'retail.order.updated') {
        void refreshOrders();
      }
    },
    [refreshOrders],
  );

  const { connected: liveConnected } = useSalonLiveUpdates(token, onLiveUpdate);

  const visible = useMemo(() => {
    if (filter === 'ALL') return orders;
    if (filter === 'DONE') {
      return orders.filter((o) => o.status === 'COMPLETED' || o.status === 'CANCELLED');
    }
    return orders.filter((o) => o.status !== 'COMPLETED' && o.status !== 'CANCELLED');
  }, [orders, filter]);

  async function updateStatus(orderId: string, status: string) {
    setError(null);
    startTransition(async () => {
      try {
        if (!token) throw new Error('Not signed in');
        const data = await apiFetch<{ order: RetailOrderRow }>(
          `/retail-orders/${orderId}`,
          { method: 'PATCH', body: JSON.stringify({ status }) },
          token,
        );
        setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, ...data.order } : o)));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not update order');
      }
    });
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="dashboard-section-anchor" id="orders-hero" data-section-label="Orders">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/70 mb-2">
          Dispensary ops
        </p>
        <h1 className="text-3xl font-semibold tracking-tight solupair-text-gradient">Orders</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-xl">
          WhatsApp carts become live tickets here — prep, dispatch, and complete. Staff get a WhatsApp
          ping on every new order{liveConnected ? ' · live updates on' : ''}.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ['ACTIVE', 'In progress'],
            ['DONE', 'Completed'],
            ['ALL', 'All'],
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
      </div>

      {error && (
        <p className="text-sm text-destructive border border-destructive/30 rounded-xl px-3 py-2">
          {error}
        </p>
      )}

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 p-10 text-center text-sm text-muted-foreground">
          No orders yet. When customers order on WhatsApp, they appear here instantly.
        </div>
      ) : (
        <ul className="space-y-4">
          {visible.map((order) => {
            const addr = [order.deliveryLine1, order.deliverySuburb, order.deliveryCity]
              .filter(Boolean)
              .join(', ');
            return (
              <li
                key={order.id}
                className="rounded-2xl border border-border/60 bg-card/40 backdrop-blur-sm p-5 shadow-[var(--solupair-glass-highlight-subtle)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      #{order.id.slice(-6).toUpperCase()} ·{' '}
                      {new Date(order.createdAt).toLocaleString('en-ZA', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </p>
                    <p className="text-lg font-semibold mt-1">{customerLabel(order)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{order.customer.waId}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span
                      className={cn(
                        'inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide',
                        statusChip(order.status),
                      )}
                    >
                      {order.status.replace(/_/g, ' ')}
                    </span>
                    <span className="text-sm font-bold tabular-nums">
                      {formatZar(order.totalCents)}
                    </span>
                  </div>
                </div>

                <p className="text-sm mt-3 text-muted-foreground">
                  {order.fulfillment === 'DELIVERY' ? '🚚 Delivery' : '🏪 Collection'}
                  {addr ? ` · ${addr}` : ''}
                </p>

                <ul className="mt-3 space-y-1 text-sm">
                  {order.items.map((item) => (
                    <li key={item.id} className="flex justify-between gap-3">
                      <span>
                        {item.nameSnapshot} ×{item.quantity}
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {formatZar(item.lineTotalCents)}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="mt-4 flex flex-wrap gap-2">
                  {STATUS_FLOW.filter((s) => {
                    if (order.fulfillment === 'COLLECTION' && s === 'OUT_FOR_DELIVERY') return false;
                    if (order.fulfillment === 'DELIVERY' && s === 'READY_FOR_COLLECTION') return false;
                    return true;
                  }).map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={pending || order.status === s}
                      onClick={() => updateStatus(order.id, s)}
                      className={cn(
                        'rounded-xl px-3 py-2 text-[11px] font-semibold border transition-all disabled:opacity-40',
                        order.status === s
                          ? 'nav-link-active'
                          : 'bg-background/60 border-border/70 hover:border-primary/30',
                      )}
                    >
                      {s.replace(/_/g, ' ')}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={pending || order.status === 'CANCELLED'}
                    onClick={() => updateStatus(order.id, 'CANCELLED')}
                    className="rounded-xl px-3 py-2 text-[11px] font-semibold border border-destructive/30 text-destructive hover:bg-destructive/10 disabled:opacity-40"
                  >
                    Cancel
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

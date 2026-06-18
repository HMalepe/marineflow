'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Activity, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
const POLL_MS = 30_000;

export type PlatformEventItem = {
  id: string;
  type: string;
  salonId: string | null;
  tenantName: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

const EVENT_COPY: Record<string, { icon: string; label: string }> = {
  TENANT_CREATED: { icon: '🏢', label: 'New business signed up' },
  APPOINTMENT_BOOKED: { icon: '🎉', label: 'First booking' },
  PAYMENT_SUCCEEDED: { icon: '💳', label: 'Payment received' },
  PAYMENT_FAILED: { icon: '⚠️', label: 'Payment failed' },
  BOT_UNHANDLED: { icon: '❓', label: 'Unhandled bot message' },
  BOT_ERROR: { icon: '🤖', label: 'Bot error' },
  ONBOARDING_INCOMPLETE: { icon: '⏳', label: 'Onboarding incomplete (48h+)' },
};

function eventLabel(ev: PlatformEventItem): { icon: string; label: string } {
  const base = EVENT_COPY[ev.type] ?? { icon: '•', label: ev.type.replace(/_/g, ' ').toLowerCase() };
  if (ev.type !== 'PAYMENT_FAILED') return base;

  const source = ev.metadata?.source;
  const kind = ev.metadata?.kind;
  if (source === 'subscription') {
    if (kind === 'CHECKOUT_ABANDONED') {
      return { icon: '🚪', label: 'Ignored PayFast checkout' };
    }
    if (kind === 'PAYMENT_DECLINED') {
      return { icon: '💸', label: 'PayFast subscription payment failed' };
    }
    return { icon: '⚠️', label: 'Subscription payment issue' };
  }

  return base;
}

function formatTimeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

type Props = {
  token: string;
  limit?: number;
  className?: string;
};

export function ActivityFeed({ token, limit = 50, className }: Props) {
  const [events, setEvents] = useState<PlatformEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await fetch(`${API_URL}/admin/events?limit=${limit}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (res.ok) {
        const data = (await res.json()) as { events: PlatformEventItem[] };
        setEvents(data.events);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, limit]);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(true), POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  return (
    <section className={cn('rounded-xl border bg-card shadow-sm', className)}>
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <Activity className="size-4 text-primary" />
          <h2 className="text-sm font-semibold">Live activity</h2>
        </div>
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          <RefreshCw className={cn('size-3.5', refreshing && 'animate-spin')} />
          Refresh
        </button>
      </div>

      <div className="max-h-80 overflow-y-auto divide-y">
        {loading && events.length === 0 && (
          <p className="px-4 py-8 text-sm text-center text-muted-foreground">Loading activity…</p>
        )}
        {!loading && events.length === 0 && (
          <p className="px-4 py-8 text-sm text-center text-muted-foreground">
            No platform events yet — activity will appear as tenants sign up and book.
          </p>
        )}
        {events.map((ev) => {
          const copy = eventLabel(ev);
          const tenant = ev.tenantName ?? 'Unknown business';
          return (
            <div key={ev.id} className="px-4 py-3 flex items-start gap-3 text-sm hover:bg-muted/30 transition-colors">
              <span className="text-base shrink-0 mt-0.5" aria-hidden>
                {copy.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="leading-snug">
                  <span className="font-medium">{copy.label}</span>
                  <span className="text-muted-foreground"> · </span>
                  {ev.salonId ? (
                    <Link
                      href={`/admin/businesses/${ev.salonId}`}
                      className="text-foreground hover:text-primary hover:underline underline-offset-2"
                    >
                      {tenant}
                    </Link>
                  ) : (
                    <span>{tenant}</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{formatTimeAgo(ev.createdAt)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

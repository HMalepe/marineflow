'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  Clock,
  MessageCircle,
  Radio,
  RefreshCw,
  User,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useSalonLiveUpdates } from '@/hooks/use-salon-live-updates';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type StationStatus = 'occupied' | 'idle' | 'arriving' | 'payment_pending' | 'off';

interface PulseStation {
  staffId: string;
  staffName: string;
  branchId: string | null;
  branchName: string | null;
  status: StationStatus;
  customerName: string | null;
  serviceName: string | null;
  until: string | null;
  appointmentId: string | null;
}

interface PulseConversation {
  id: string;
  customerName: string;
  step: string;
  stepLabel: string;
  lastMessageAt: string | null;
  isHandoff: boolean;
}

interface PulseTickerItem {
  id: string;
  at: string;
  text: string;
}

interface PulseSnapshot {
  generatedAt: string;
  stations: PulseStation[];
  conversations: PulseConversation[];
  ticker: PulseTickerItem[];
  summary: {
    occupied: number;
    idle: number;
    arriving: number;
    paymentPending: number;
    activeChats: number;
  };
}

interface BranchOption {
  id: string;
  name: string;
}

interface Props {
  token: string;
  initialBranches: BranchOption[];
}

const STATION_STYLES: Record<
  StationStatus,
  { ring: string; bg: string; label: string; dot: string }
> = {
  occupied: {
    ring: 'ring-green-500/50',
    bg: 'bg-green-500/10 border-green-500/30',
    label: 'In chair',
    dot: 'bg-green-500',
  },
  idle: {
    ring: 'ring-muted-foreground/20',
    bg: 'bg-muted/40 border-border',
    label: 'Idle',
    dot: 'bg-muted-foreground/40',
  },
  arriving: {
    ring: 'ring-blue-500/50',
    bg: 'bg-blue-500/10 border-blue-500/30',
    label: 'Arriving soon',
    dot: 'bg-blue-500 animate-pulse',
  },
  payment_pending: {
    ring: 'ring-amber-500/50',
    bg: 'bg-amber-500/10 border-amber-500/30',
    label: 'Payment pending',
    dot: 'bg-amber-500',
  },
  off: {
    ring: 'ring-muted-foreground/10',
    bg: 'bg-muted/20 border-dashed border-border opacity-60',
    label: 'Off roster',
    dot: 'bg-muted-foreground/25',
  },
};

function formatTime(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
}

function formatRelative(iso: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return formatTime(iso);
}

export function PulseClient({ token, initialBranches }: Props) {
  const [branches] = useState(initialBranches);
  const [branchId, setBranchId] = useState<string>('');
  const [data, setData] = useState<PulseSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (!token) return;
      if (!silent) setRefreshing(true);
      try {
        const qs = branchId ? `?branchId=${encodeURIComponent(branchId)}` : '';
        const res = await apiFetch<PulseSnapshot>(`/tenant/pulse${qs}`, {}, token);
        setData(res);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load pulse');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, branchId],
  );

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  useEffect(() => {
    const id = setInterval(() => void load(true), 60_000);
    return () => clearInterval(id);
  }, [load]);

  const onLiveUpdate = useCallback(() => {
    void load(true);
  }, [load]);

  const { connected: liveConnected } = useSalonLiveUpdates(token, onLiveUpdate);

  const summary = data?.summary;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <Radio className="size-4" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Live Pulse</h1>
            <Badge
              variant="outline"
              className={cn(
                'ml-1 gap-1 text-[10px] font-normal',
                liveConnected
                  ? 'border-green-500/40 text-green-700 dark:text-green-400'
                  : 'text-muted-foreground',
              )}
            >
              <span
                className={cn(
                  'size-1.5 rounded-full',
                  liveConnected ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground',
                )}
              />
              {liveConnected ? 'Live' : 'Polling'}
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm max-w-xl">
            Air-traffic control for your floor — chairs, arrivals, payments, and bot conversations right now.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {branches.length > 1 && (
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="rounded-lg border bg-background px-3 py-2 text-sm min-w-[160px]"
            >
              <option value="">All branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load()}
            disabled={refreshing}
            className="gap-1.5"
          >
            <RefreshCw className={cn('size-3.5', refreshing && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Summary strip */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: 'In chair', value: summary.occupied, color: 'text-green-600' },
            { label: 'Idle', value: summary.idle, color: 'text-muted-foreground' },
            { label: 'Arriving', value: summary.arriving, color: 'text-blue-600' },
            { label: 'Payment hold', value: summary.paymentPending, color: 'text-amber-600' },
            { label: 'Active chats', value: summary.activeChats, color: 'text-violet-600' },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl border bg-card px-4 py-3 text-center">
              <p className={cn('text-2xl font-bold tabular-nums', color)}>{value}</p>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Station floor plan */}
        <section className="lg:col-span-2 space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Activity className="size-4 text-muted-foreground" />
            Stations
          </h2>
          {loading && !data ? (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-28 rounded-xl bg-muted/50 animate-pulse" />
              ))}
            </div>
          ) : !data?.stations.length ? (
            <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
              No bookable staff on roster today — add staff in{' '}
              <Link href="/roster" className="text-primary hover:underline">
                Staff Roster
              </Link>
              .
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {data.stations.map((station) => {
                const style = STATION_STYLES[station.status];
                return (
                  <div
                    key={station.staffId}
                    className={cn(
                      'rounded-xl border p-4 ring-2 transition-all',
                      style.bg,
                      style.ring,
                    )}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-background/80">
                          <User className="size-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">{station.staffName}</p>
                          {station.branchName && branches.length > 1 && (
                            <p className="text-[10px] text-muted-foreground truncate">{station.branchName}</p>
                          )}
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium shrink-0">
                        <span className={cn('size-2 rounded-full', style.dot)} />
                        {style.label}
                      </span>
                    </div>
                    {station.customerName ? (
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium truncate">{station.customerName}</p>
                        {station.serviceName && (
                          <p className="text-xs text-muted-foreground truncate">{station.serviceName}</p>
                        )}
                        {station.until && (
                          <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-1">
                            <Clock className="size-3" />
                            until {formatTime(station.until)}
                          </p>
                        )}
                      </div>
                    ) : station.status === 'idle' ? (
                      <p className="text-xs text-muted-foreground">Chair open</p>
                    ) : null}
                    {station.appointmentId && (
                      <Link
                        href={`/appointments?highlight=${station.appointmentId}`}
                        className="text-[11px] text-primary hover:underline mt-2 inline-block"
                      >
                        View booking →
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Active bot conversations */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <MessageCircle className="size-4 text-muted-foreground" />
            Bot conversations now
          </h2>
          <div className="rounded-xl border bg-card divide-y max-h-[480px] overflow-y-auto">
            {!data?.conversations.length ? (
              <p className="text-sm text-muted-foreground p-6 text-center">No active WhatsApp flows</p>
            ) : (
              data.conversations.map((c) => (
                <div key={c.id} className="px-4 py-3 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{c.customerName}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {c.isHandoff ? (
                        <span className="text-orange-600 dark:text-orange-400 font-medium">Live handoff</span>
                      ) : (
                        c.stepLabel
                      )}
                    </p>
                  </div>
                  <time className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
                    {formatRelative(c.lastMessageAt)}
                  </time>
                </div>
              ))
            )}
          </div>
          <Link
            href="/conversations"
            className="text-xs text-primary hover:underline inline-flex items-center gap-1"
          >
            Open inbox →
          </Link>
        </section>
      </div>

      {/* Live ticker */}
      {data && data.ticker.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="overflow-hidden py-2.5">
            <div className="flex animate-marquee whitespace-nowrap gap-8 text-sm">
              {[...data.ticker, ...data.ticker].map((item, i) => (
                <span key={`${item.id}-${i}`} className="inline-flex items-center gap-2 text-muted-foreground">
                  <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <span>{item.text}</span>
                  <span className="text-[10px] opacity-60">{formatTime(item.at)}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {data?.generatedAt && (
        <p className="text-[11px] text-muted-foreground text-right">
          Updated {formatTime(data.generatedAt)} · auto-refresh every 60s
        </p>
      )}
    </div>
  );
}

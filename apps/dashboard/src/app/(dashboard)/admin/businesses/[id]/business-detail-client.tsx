'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  Bot,
  Calendar,
  MessageSquare,
  User,
  Users,
} from 'lucide-react';
import { OpenClientDashboardButton } from '@/components/open-client-dashboard-button';
import { BusinessTypeBadge } from '@/components/BusinessTypeBreakdown';
import type { BusinessType } from '@/lib/labels';
import { ApiError } from '@/lib/api';
import { PLATFORM_BOT_NAME } from '@/lib/bot-branding';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardPageHeader } from '@/components/dashboard-page-header';
import { cn } from '@/lib/utils';
import { resolveApiUrl } from '@/lib/api-config';

interface BusinessSummary {
  business: {
    id: string;
    name: string;
    slug: string;
    status: string;
    tier: string;
    botName: string;
    industryTemplate: string;
    industryLabel: string;
    businessType: BusinessType;
    timezone: string;
    createdAt: string;
    trialEndsAt: string | null;
    phoneDisplay: string | null;
    contactEmail: string | null;
    subscription: {
      status: string;
      trialEndsAt: string | null;
      plan: { name: string; priceMonthly: number };
    } | null;
    _count: {
      staff: number;
      staffUsers: number;
      customers: number;
      appointments: number;
      branches: number;
      services: number;
      conversations: number;
      tickets: number;
      campaigns: number;
    };
  };
  stats: {
    appointments7d: number;
    appointments30d: number;
    completed7d: number;
    messages7d: number;
    unreadAlerts: number;
  };
  funnel: {
    funnel: { step: string; count: number }[];
    completedBookings7d: number;
  };
  staffUsers: {
    id: string;
    name: string;
    email: string;
    role: string;
    active: boolean;
    createdAt: string;
  }[];
  alerts: {
    id: string;
    kind: string;
    status: string;
    title: string;
    body: string;
    createdAt: string;
    from: { name: string; email: string } | null;
  }[];
}

async function adminFetch<T>(path: string, token: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(resolveApiUrl('admin', path, { forBrowser: true }), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers as Record<string, string>),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error ?? 'Request failed');
  }
  return res.json() as Promise<T>;
}

function StatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    TRIAL: 'bg-yellow-500/15 text-yellow-800 dark:text-yellow-300 border-yellow-600/30',
    ACTIVE: 'bg-green-600/15 text-green-700 dark:text-green-400 border-green-600/30',
    SUSPENDED: 'bg-destructive/10 text-destructive border-destructive/30',
    PAST_DUE: 'bg-orange-500/15 text-orange-800 dark:text-orange-300 border-orange-600/30',
  };
  return <Badge className={cn('border', cls[status] ?? 'bg-muted')}>{status}</Badge>;
}

export function BusinessDetailClient({ businessId, token }: { businessId: string; token: string }) {
  const [data, setData] = useState<BusinessSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const summary = await adminFetch<BusinessSummary>(`/salons/${businessId}/summary`, token);
      setData(summary);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load business');
    } finally {
      setLoading(false);
    }
  }, [businessId, token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function markAlertRead(id: string) {
    try {
      await adminFetch(`/platform-inbox/${id}`, token, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'READ' }),
      });
      void load();
    } catch {
      // non-critical
    }
  }

  if (loading && !data) {
    return <p className="text-sm text-muted-foreground py-12 text-center">Loading business…</p>;
  }

  if (error || !data) {
    return (
      <div className="py-12 text-center space-y-3">
        <p className="text-destructive">{error ?? 'Business not found'}</p>
        <Link href="/admin" className={buttonVariants({ variant: 'outline' })}>
          Back to businesses
        </Link>
      </div>
    );
  }

  const { business, stats, funnel, staffUsers, alerts } = data;
  const maxFunnel = Math.max(...funnel.funnel.map((f) => f.count), 1);

  return (
    <div className="dashboard-page-flow space-y-8">
      <DashboardPageHeader
        variant="violet"
        title={
          <>
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
            >
              <ArrowLeft className="size-4" />
              All businesses
            </Link>
            <span className="flex flex-wrap items-center gap-2">
              <span className="truncate">{business.name}</span>
              <BusinessTypeBadge type={business.businessType} />
              <StatusBadge status={business.status} />
              <Badge variant="outline" className="capitalize">{business.tier}</Badge>
            </span>
          </>
        }
        subtitle={
          <>
            <span className="block">
              {business.industryLabel} · <span className="font-mono text-xs">{business.slug}</span>
              · Assistant: {business.botName?.trim() || PLATFORM_BOT_NAME}
            </span>
            <span className="block text-xs mt-1">
              Joined {new Date(business.createdAt).toLocaleDateString()} · {business.timezone}
              {business.subscription?.plan && (
                <> · Plan: {business.subscription.plan.name}</>
              )}
            </span>
          </>
        }
        actions={
          <>
            <OpenClientDashboardButton businessId={business.id} businessName={business.name} />
            <Link href={`/analytics?business=${business.id}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              Analytics
            </Link>
          </>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Kpi icon={Users} label="Customers" value={business._count.customers} />
        <Kpi icon={Calendar} label="Appointments" value={business._count.appointments} />
        <Kpi icon={Calendar} label="Bookings (7d)" value={stats.appointments7d} />
        <Kpi icon={Calendar} label="Completed (7d)" value={stats.completed7d} />
        <Kpi icon={MessageSquare} label="WhatsApp msgs (7d)" value={stats.messages7d} />
        <Kpi icon={Bot} label="Unread alerts" value={stats.unreadAlerts} highlight={stats.unreadAlerts > 0} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Bot funnel */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Booking funnel (live conversations)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {funnel.funnel.map((step) => (
              <div key={step.step} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{step.step.replace(/_/g, ' ')}</span>
                  <span className="font-medium tabular-nums">{step.count}</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary/70 rounded-full transition-all"
                    style={{ width: `${Math.max(4, (step.count / maxFunnel) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
            <p className="text-xs text-muted-foreground pt-1">
              {funnel.completedBookings7d} completed booking{funnel.completedBookings7d !== 1 ? 's' : ''} in the last 7 days
            </p>
          </CardContent>
        </Card>

        {/* Business snapshot */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Business snapshot</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <Stat label="Staff (roster)" value={business._count.staff} />
              <Stat label="Dashboard users" value={business._count.staffUsers} />
              <Stat label="Services" value={business._count.services} />
              <Stat label="Branches" value={business._count.branches} />
              <Stat label="Conversations" value={business._count.conversations} />
              <Stat label="Support tickets" value={business._count.tickets} />
              <Stat label="Campaigns" value={business._count.campaigns} />
              <Stat label="Bookings (30d)" value={stats.appointments30d} />
            </dl>
          </CardContent>
        </Card>
      </div>

      {/* Team */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="size-4" />
            Team &amp; owners
          </CardTitle>
        </CardHeader>
        <CardContent>
          {staffUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No dashboard users yet.</p>
          ) : (
            <div className="divide-y">
              {staffUsers.map((u) => (
                <div key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{u.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="text-[10px] capitalize">{u.role.toLowerCase().replace(/_/g, ' ')}</Badge>
                    {!u.active && <Badge variant="outline" className="text-[10px]">Inactive</Badge>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Inbox alerts for this business */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">Inbox &amp; bot alerts</CardTitle>
            {stats.unreadAlerts > 0 && (
              <Badge className="bg-destructive text-destructive-foreground">{stats.unreadAlerts} unread</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
              No messages or bot errors for this business yet.
            </p>
          ) : (
            alerts.map((alert) => (
              <div
                key={alert.id}
                className={cn(
                  'rounded-lg border p-3 space-y-1.5',
                  alert.status === 'UNREAD' && 'border-l-4 border-l-destructive bg-destructive/5',
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{alert.title}</p>
                    <Badge variant="outline" className="text-[10px] mt-1">
                      {alert.kind === 'BOT_ERROR' ? 'Bot error' : 'Owner message'}
                    </Badge>
                  </div>
                  {alert.status === 'UNREAD' && (
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => void markAlertRead(alert.id)}>
                      Mark read
                    </Button>
                  )}
                </div>
                <p className="text-sm whitespace-pre-wrap break-words">{alert.body}</p>
                {alert.from && (
                  <p className="text-xs text-muted-foreground">From {alert.from.name}</p>
                )}
                <p className="text-[10px] text-muted-foreground">{new Date(alert.createdAt).toLocaleString()}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  highlight,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className={cn('rounded-lg border p-3', highlight && 'border-destructive/40 bg-destructive/5')}>
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
        <Icon className="size-3.5" />
        <p className="text-[10px] font-medium uppercase tracking-wide">{label}</p>
      </div>
      <p className="text-xl font-bold tabular-nums">{value.toLocaleString()}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums text-right">{value.toLocaleString()}</dd>
    </>
  );
}

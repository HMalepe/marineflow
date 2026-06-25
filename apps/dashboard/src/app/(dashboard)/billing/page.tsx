import { redirect } from 'next/navigation';
import { getToken, getUser } from '@/lib/auth';
import { apiFetch, ApiError } from '@/lib/api';
import { API_MISCONFIGURED_MESSAGE, isApiMisconfiguredForProduction } from '@/lib/api-config';
import { BillingClient } from './billing-client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getApiBaseUrl } from '@/lib/api-config';
import type { BillingPlan } from '@/lib/billing';
import { adminBillingIssueLabel } from '@/lib/billing';
import { DashboardPageHeader } from '@/components/dashboard-page-header';

const API_URL = getApiBaseUrl();

interface Subscription {
  id: string;
  planId: string;
  status: string;
  billingProvider: string;
  currentPeriodEnd: string | null;
  trialEndsAt?: string | null;
  cancelAtPeriodEnd: boolean;
  plan: BillingPlan;
  billingIssue?: {
    kind: 'PAYMENT_DECLINED' | 'CHECKOUT_ABANDONED';
    at: string;
    detail: string | null;
  } | null;
}

interface AdminSubscription {
  salonId: string;
  salonName: string;
  salonSlug: string;
  salonStatus: string;
  tier: string;
  status: string;
  planName: string;
  priceMonthly: number;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
  lastBillingIssueKind: 'PAYMENT_DECLINED' | 'CHECKOUT_ABANDONED' | null;
  lastBillingIssueAt: string | null;
  lastBillingIssueDetail: string | null;
  lastPaymentAt: string | null;
}

interface AdminBillingData {
  mrr: number;
  arr: number;
  byStatus: {
    ACTIVE: number;
    TRIAL: number;
    PAST_DUE: number;
    CANCELLED: number;
    PAUSED: number;
  };
  subscriptions: AdminSubscription[];
  paymentIssuesCount: number;
  paymentIssues: AdminSubscription[];
}

function formatZAR(cents: number): string {
  return 'R ' + (cents / 100).toLocaleString('en-ZA');
}

function SubStatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    ACTIVE: 'bg-green-600/15 text-green-700 dark:text-green-400 border-green-600/30',
    TRIAL: 'bg-yellow-500/15 text-yellow-800 dark:text-yellow-300 border-yellow-600/30',
    PAST_DUE: 'bg-orange-500/15 text-orange-800 dark:text-orange-300 border-orange-600/30',
    CANCELLED: 'bg-muted text-muted-foreground border-border',
    PAUSED: 'bg-blue-500/15 text-blue-800 dark:text-blue-300 border-blue-600/30',
  };
  return (
    <Badge className={`border ${cls[status] ?? 'bg-muted'}`}>{status}</Badge>
  );
}

function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="dashboard-kpi-tile p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}

async function AdminBillingPage({ token }: { token: string }) {
  let data: AdminBillingData | null = null;

  try {
    const res = await fetch(`${API_URL}/admin/billing`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (res.ok) {
      data = (await res.json()) as AdminBillingData;
    }
  } catch {
    // Admin API may not be accessible
  }

  if (!data) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <p className="text-lg font-medium">Billing &amp; Subscriptions</p>
        <p className="text-sm mt-2">Access restricted to platform administrators.</p>
      </div>
    );
  }

  const statusEntries = Object.entries(data.byStatus) as [string, number][];

  return (
    <div className="dashboard-page-flow space-y-8">
      <DashboardPageHeader
        title="Billing & Subscriptions"
        variant="emerald"
        subtitle="Platform-wide subscription and revenue overview."
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KpiCard label="MRR" value={formatZAR(data.mrr)} />
        <KpiCard label="ARR" value={formatZAR(data.arr)} />
        <KpiCard label="Active Subscriptions" value={data.byStatus.ACTIVE} />
        <KpiCard label="Past Due" value={data.byStatus.PAST_DUE} />
        <KpiCard label="Payment Issues" value={data.paymentIssuesCount} />
      </div>

      <section>
        <h2 className="text-sm font-semibold mb-3">Status Breakdown</h2>
        <div className="flex flex-wrap gap-3">
          {statusEntries.map(([status, count]) => (
            <div key={status} className="flex items-center gap-2 border rounded-lg px-3 py-2">
              <SubStatusBadge status={status} />
              <span className="text-sm font-medium tabular-nums">{count}</span>
            </div>
          ))}
        </div>
      </section>

      {data.paymentIssues.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold mb-1">PayFast payment issues</h2>
          <p className="text-xs text-muted-foreground mb-3">
            Declined monthly debits vs salons that opened PayFast and left without paying.
          </p>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Business</TableHead>
                    <TableHead>Issue</TableHead>
                    <TableHead>Subscription</TableHead>
                    <TableHead>Detail</TableHead>
                    <TableHead>When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.paymentIssues.map((sub) => (
                    <TableRow key={`issue-${sub.salonId}`}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{sub.salonName}</p>
                          <p className="text-xs text-muted-foreground">{sub.salonSlug}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={`border ${
                            sub.lastBillingIssueKind === 'PAYMENT_DECLINED'
                              ? 'bg-orange-500/15 text-orange-800 dark:text-orange-300 border-orange-600/30'
                              : 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-600/30'
                          }`}
                        >
                          {adminBillingIssueLabel(sub.lastBillingIssueKind)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <SubStatusBadge status={sub.status} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs">
                        {sub.lastBillingIssueDetail ?? '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {sub.lastBillingIssueAt
                          ? new Date(sub.lastBillingIssueAt).toLocaleString('en-ZA')
                          : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>
      )}

      <section>
        <h2 className="text-sm font-semibold mb-3">All Subscriptions</h2>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last PayFast issue</TableHead>
                  <TableHead className="text-right">Price/mo</TableHead>
                  <TableHead>Period End / Trial Ends</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.subscriptions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                      No subscriptions found.
                    </TableCell>
                  </TableRow>
                )}
                {data.subscriptions.map((sub) => (
                  <TableRow key={sub.salonId}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{sub.salonName}</p>
                        <p className="text-xs text-muted-foreground">{sub.salonSlug}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm">{sub.planName}</p>
                        <p className="text-xs text-muted-foreground capitalize">{sub.tier}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <SubStatusBadge status={sub.status} />
                        {sub.cancelAtPeriodEnd && (
                          <span className="text-xs text-muted-foreground">Cancels at period end</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {sub.lastBillingIssueKind ? (
                        <div className="space-y-0.5">
                          <span
                            className={
                              sub.lastBillingIssueKind === 'PAYMENT_DECLINED'
                                ? 'text-orange-700 dark:text-orange-300 font-medium'
                                : 'text-amber-700 dark:text-amber-300 font-medium'
                            }
                          >
                            {adminBillingIssueLabel(sub.lastBillingIssueKind)}
                          </span>
                          {sub.lastBillingIssueAt && (
                            <p className="text-xs text-muted-foreground">
                              {new Date(sub.lastBillingIssueAt).toLocaleDateString('en-ZA')}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatZAR(sub.priceMonthly)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {sub.trialEndsAt
                        ? `Trial: ${new Date(sub.trialEndsAt).toLocaleDateString()}`
                        : sub.currentPeriodEnd
                        ? new Date(sub.currentPeriodEnd).toLocaleDateString()
                        : '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(sub.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const params = await searchParams;
  const checkoutStatus =
    params.checkout === 'success' || params.checkout === 'cancelled'
      ? params.checkout
      : null;

  const [token, user] = await Promise.all([getToken(), getUser()]);

  if (user?.role === 'SUPER_ADMIN') {
    return <AdminBillingPage token={token ?? ''} />;
  }

  if (user?.role !== 'OWNER') {
    redirect('/');
  }

  if (isApiMisconfiguredForProduction()) {
    return (
      <div className="space-y-8 max-w-3xl">
        <BillingPageHeader />
        <p className="text-sm text-destructive">{API_MISCONFIGURED_MESSAGE}</p>
      </div>
    );
  }

  let plans: BillingPlan[] = [];
  let subscription: Subscription | null = null;
  let loadError: string | null = null;

  try {
    const [plansRes, subRes] = await Promise.all([
      apiFetch<{ plans: BillingPlan[] }>('/subscription/plans', {}, token),
      apiFetch<{ subscription: Subscription | null }>('/subscription', {}, token),
    ]);
    plans = plansRes.plans.filter((p) => p.priceMonthly > 0);
    subscription = subRes.subscription;
  } catch (e) {
    loadError = e instanceof ApiError ? e.message : 'Failed to load billing information';
  }

  if (loadError) {
    return (
      <div className="space-y-8 max-w-3xl">
        <BillingPageHeader />
        <Card>
          <CardContent className="py-8">
            <p className="text-sm text-destructive font-medium">{loadError}</p>
            <p className="text-sm text-muted-foreground mt-2">Please refresh the page or try again later.</p>
            <p className="text-xs text-muted-foreground mt-4">
              API: {API_URL} — if this looks wrong, update NEXT_PUBLIC_API_URL and redeploy.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="dashboard-page-flow space-y-8 max-w-5xl">
      <BillingPageHeader />

      <BillingClient
        plans={plans}
        subscription={subscription}
        token={token ?? ''}
        checkoutStatus={checkoutStatus}
      />
    </div>
  );
}

function BillingPageHeader() {
  return (
    <DashboardPageHeader
      title="Billing"
      variant="emerald"
      subtitle="One simple plan — WhatsApp bookings, dashboard, and onboarding included."
    />
  );
}

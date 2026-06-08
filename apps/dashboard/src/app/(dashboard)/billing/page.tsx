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

const API_URL = getApiBaseUrl();

interface Plan {
  id: string;
  name: string;
  tier: string;
  priceMonthly: number;
  priceAnnual: number;
  maxStaff: number;
  maxBranches: number;
  maxServices: number;
  features: string[];
  aiEnabled: boolean;
}

interface Subscription {
  id: string;
  planId: string;
  status: string;
  billingProvider: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  plan: Plan;
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
    <div className="border rounded-lg p-4">
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
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Billing &amp; Subscriptions</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Platform-wide subscription and revenue overview.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="MRR" value={formatZAR(data.mrr)} />
        <KpiCard label="ARR" value={formatZAR(data.arr)} />
        <KpiCard label="Active Subscriptions" value={data.byStatus.ACTIVE} />
        <KpiCard label="Past Due" value={data.byStatus.PAST_DUE} />
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

      <section>
        <h2 className="text-sm font-semibold mb-3">All Subscriptions</h2>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Salon</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Price/mo</TableHead>
                  <TableHead>Period End / Trial Ends</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.subscriptions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
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

export default async function BillingPage() {
  const [token, user] = await Promise.all([getToken(), getUser()]);

  if (user?.role === 'SUPER_ADMIN') {
    return <AdminBillingPage token={token ?? ''} />;
  }

  if (isApiMisconfiguredForProduction()) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Billing &amp; Subscription</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage your plan and payment method.
          </p>
        </div>
        <p className="text-sm text-destructive">{API_MISCONFIGURED_MESSAGE}</p>
      </div>
    );
  }

  let plans: Plan[] = [];
  let subscription: Subscription | null = null;
  let loadError: string | null = null;

  try {
    const [plansRes, subRes] = await Promise.all([
      apiFetch<{ plans: Plan[] }>('/subscription/plans', {}, token),
      apiFetch<{ subscription: Subscription | null }>('/subscription', {}, token),
    ]);
    plans = plansRes.plans;
    subscription = subRes.subscription;
  } catch (e) {
    loadError = e instanceof ApiError ? e.message : 'Failed to load billing information';
  }

  if (loadError) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Billing &amp; Subscription</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage your plan and payment method.
          </p>
        </div>
        <p className="text-sm text-destructive">{loadError}. Please try again.</p>
        <p className="text-xs text-muted-foreground">
          API: {API_URL} — if this looks wrong, update NEXT_PUBLIC_API_URL and redeploy.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Billing &amp; Subscription</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage your plan and payment method.
        </p>
      </div>

      <BillingClient plans={plans} subscription={subscription} token={token ?? ''} />
    </div>
  );
}

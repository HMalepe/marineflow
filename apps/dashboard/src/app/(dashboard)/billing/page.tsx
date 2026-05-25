import { getToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { BillingClient } from './billing-client';

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

export default async function BillingPage() {
  const token = await getToken();

  const [{ plans }, { subscription }] = await Promise.all([
    apiFetch<{ plans: Plan[] }>('/subscription/plans', {}, token),
    apiFetch<{ subscription: Subscription | null }>('/subscription', {}, token),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Billing & Subscription</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage your plan and payment method.
        </p>
      </div>

      <BillingClient plans={plans} subscription={subscription} token={token ?? ''} />
    </div>
  );
}

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

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

interface Props {
  plans: Plan[];
  subscription: Subscription | null;
  token: string;
}

export function BillingClient({ plans, subscription, token }: Props) {
  const [cycle, setCycle] = useState<'monthly' | 'annual'>('monthly');
  const [loading, setLoading] = useState<string | null>(null);

  async function handleSubscribe(planTier: string) {
    setLoading(planTier);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planTier, billingCycle: cycle, token }),
      });
      const data = await res.json();
      if (data.url && data.formData) {
        // Create a form and submit to PayFast
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = data.url;
        for (const [key, value] of Object.entries(data.formData)) {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = key;
          input.value = value as string;
          form.appendChild(input);
        }
        document.body.appendChild(form);
        form.submit();
      }
    } finally {
      setLoading(null);
    }
  }

  async function handleCancel() {
    if (!confirm('Are you sure you want to cancel your subscription?')) return;
    setLoading('cancel');
    await fetch('/api/billing/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    window.location.reload();
  }

  const currentTier = subscription?.plan.tier ?? 'starter';

  return (
    <div className="space-y-6">
      {/* Current Plan */}
      {subscription && (
        <div className="border rounded-lg p-6 bg-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Current Plan</p>
              <p className="text-xl font-bold">{subscription.plan.name}</p>
              <p className="text-sm text-muted-foreground mt-1">
                Status: <span className="font-medium capitalize">{subscription.status.toLowerCase()}</span>
                {subscription.currentPeriodEnd && (
                  <> &middot; Renews {new Date(subscription.currentPeriodEnd).toLocaleDateString()}</>
                )}
              </p>
            </div>
            {subscription.status === 'ACTIVE' && !subscription.cancelAtPeriodEnd && (
              <Button variant="ghost" onClick={handleCancel} disabled={loading === 'cancel'}>
                Cancel Plan
              </Button>
            )}
            {subscription.cancelAtPeriodEnd && (
              <span className="text-sm text-amber-600 font-medium">Cancels at period end</span>
            )}
          </div>
        </div>
      )}

      {/* Billing Cycle Toggle */}
      <div className="flex items-center justify-center gap-2">
        <button
          onClick={() => setCycle('monthly')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            cycle === 'monthly' ? 'bg-primary text-primary-foreground' : 'bg-muted'
          }`}
        >
          Monthly
        </button>
        <button
          onClick={() => setCycle('annual')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            cycle === 'annual' ? 'bg-primary text-primary-foreground' : 'bg-muted'
          }`}
        >
          Annual <span className="text-xs opacity-75">(save 20%)</span>
        </button>
      </div>

      {/* Plan Cards */}
      <div className="grid md:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const price = cycle === 'annual' ? plan.priceAnnual / 12 : plan.priceMonthly;
          const isCurrent = plan.tier === currentTier;

          return (
            <div
              key={plan.id}
              className={`border rounded-xl p-6 flex flex-col ${
                plan.tier === 'pro' ? 'border-primary shadow-lg ring-1 ring-primary/20' : ''
              }`}
            >
              {plan.tier === 'pro' && (
                <div className="text-xs font-bold text-primary mb-2 uppercase tracking-wide">
                  Most Popular
                </div>
              )}
              <h3 className="text-lg font-bold">{plan.name}</h3>
              <div className="mt-2">
                <span className="text-3xl font-bold">
                  R{(price / 100).toFixed(0)}
                </span>
                <span className="text-muted-foreground text-sm">/mo</span>
              </div>

              <ul className="mt-4 space-y-2 flex-1">
                <li className="text-sm flex items-center gap-2">
                  <Check /> Up to {plan.maxStaff === 9999 ? 'unlimited' : plan.maxStaff} staff
                </li>
                <li className="text-sm flex items-center gap-2">
                  <Check /> {plan.maxBranches === 9999 ? 'Unlimited' : plan.maxBranches} branch{plan.maxBranches > 1 ? 'es' : ''}
                </li>
                <li className="text-sm flex items-center gap-2">
                  <Check /> {plan.maxServices === 9999 ? 'Unlimited' : plan.maxServices} services
                </li>
                {plan.aiEnabled && (
                  <li className="text-sm flex items-center gap-2">
                    <Check /> AI-powered FAQ & search
                  </li>
                )}
                {plan.features.includes('priority_support') && (
                  <li className="text-sm flex items-center gap-2">
                    <Check /> Priority support
                  </li>
                )}
              </ul>

              <div className="mt-6">
                {isCurrent ? (
                  <Button className="w-full" disabled variant="outline">
                    Current Plan
                  </Button>
                ) : plan.priceMonthly === 0 ? (
                  <Button className="w-full" variant="outline" disabled>
                    Free
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    onClick={() => handleSubscribe(plan.tier)}
                    disabled={loading === plan.tier}
                  >
                    {loading === plan.tier ? 'Redirecting...' : 'Upgrade'}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-center text-muted-foreground">
        Payments processed securely via PayFast. All prices in South African Rand (ZAR).
      </p>
    </div>
  );
}

function Check() {
  return (
    <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

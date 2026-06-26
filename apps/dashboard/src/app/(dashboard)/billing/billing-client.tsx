'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  Calendar,
  Check,
  CreditCard,
  Loader2,
  ShieldCheck,
  Sparkles,
  Wrench,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CollapsibleCard } from '@/components/collapsible-card';
import { CollapsibleSection } from '@/components/collapsible-section';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  type BillingCycle,
  type BillingPlan,
  type BillingIssue,
  billingIssueMeta,
  checkoutErrorMessage,
  computeBillingQuote,
  formatZAR,
  isSubscriptionActive,
  pickPaidPlan,
  subscriptionStatusMeta,
} from '@/lib/billing';

interface Subscription {
  id: string;
  planId: string;
  status: string;
  billingProvider: string;
  currentPeriodEnd: string | null;
  trialEndsAt?: string | null;
  cancelAtPeriodEnd: boolean;
  plan: BillingPlan;
  billingIssue?: BillingIssue | null;
}

interface Props {
  plans: BillingPlan[];
  subscription: Subscription | null;
  token: string;
  checkoutStatus?: 'success' | 'cancelled' | null;
}

const FEATURES = [
  'WhatsApp booking bot on your business number',
  'Owner dashboard, CRM & appointment calendar',
  'Loyalty stamps, campaigns & customer insights',
  'AI-powered FAQs and smart search',
];

const STEPS = [
  {
    icon: CreditCard,
    title: 'Pay subscription on PayFast',
    body: 'Secure recurring billing — monthly or annual, your choice.',
  },
  {
    icon: Wrench,
    title: 'We invoice setup & onboarding',
    body: 'One-off fee before go-live. We configure your bot, services, and staff.',
  },
  {
    icon: Sparkles,
    title: 'Go live on WhatsApp',
    body: 'Customers book through your number. You manage everything from the dashboard.',
  },
];

function StatusBanner({
  variant,
  title,
  message,
  onDismiss,
}: {
  variant: 'success' | 'warning' | 'error';
  title: string;
  message: string;
  onDismiss?: () => void;
}) {
  const styles = {
    success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100',
    warning: 'border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100',
    error: 'border-destructive/30 bg-destructive/10 text-destructive',
  };

  return (
    <div className={`relative rounded-xl border px-4 py-3 pr-10 ${styles[variant]}`}>
      <p className="font-medium text-sm">{title}</p>
      <p className="text-sm mt-0.5 opacity-90">{message}</p>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="absolute top-3 right-3 rounded-md p-1 opacity-70 hover:opacity-100"
          aria-label="Dismiss"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}

export function BillingClient({ plans, subscription, token, checkoutStatus }: Props) {
  const router = useRouter();
  const plan = pickPaidPlan(plans);
  const [cycle, setCycle] = useState<BillingCycle>('monthly');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [banner, setBanner] = useState(checkoutStatus ?? null);
  const abandonedLogged = useRef(false);

  useEffect(() => {
    if (checkoutStatus !== 'cancelled' || abandonedLogged.current) return;
    abandonedLogged.current = true;
    void fetch('/api/billing/checkout-abandoned', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    }).catch(() => undefined);
  }, [checkoutStatus, token]);

  const dismissBanner = useCallback(() => {
    setBanner(null);
    router.replace('/billing');
  }, [router]);

  if (!plan) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          <p className="font-medium">No plans available</p>
          <p className="text-sm mt-1">Contact support@marineflow.co.za to subscribe.</p>
        </CardContent>
      </Card>
    );
  }

  const selectedPlan = plan;
  const quote = computeBillingQuote(selectedPlan, cycle);
  const active = isSubscriptionActive(subscription);
  const statusMeta = subscription ? subscriptionStatusMeta(subscription.status) : null;
  const billingIssue = billingIssueMeta(subscription?.billingIssue);
  const canSubscribe = !active;

  async function handleSubscribe() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planTier: selectedPlan.tier, billingCycle: cycle, token }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(checkoutErrorMessage(data.error));
        return;
      }

      if (data.url && data.formData) {
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
        return;
      }

      setError('Could not start checkout. Please try again.');
    } catch {
      setError('Network error. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/billing/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(checkoutErrorMessage(data.error));
        setShowCancelConfirm(false);
        return;
      }
      setShowCancelConfirm(false);
      setBanner(null);
      router.refresh();
    } catch {
      setError('Could not cancel subscription. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const payfastCta =
    cycle === 'monthly'
      ? `Continue to PayFast — ${formatZAR(selectedPlan.priceMonthly)}/mo`
      : `Continue to PayFast — ${formatZAR(selectedPlan.priceAnnual)}/yr`;

  // Compute trial days remaining
  const trialDaysLeft = (() => {
    const trialEnd = subscription?.trialEndsAt ?? (subscription?.status === 'TRIALING' ? subscription?.currentPeriodEnd : null);
    if (!trialEnd) return null;
    const diff = new Date(trialEnd).getTime() - Date.now();
    return diff > 0 ? Math.ceil(diff / 86_400_000) : 0;
  })();
  const isTrialing = subscription?.status === 'TRIALING' || (trialDaysLeft !== null && trialDaysLeft > 0);

  return (
    <div className="space-y-6">
      {/* Trial countdown banner — shown prominently when in trial */}
      {isTrialing && trialDaysLeft !== null && (
        <div className={`rounded-2xl border px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between ${
          trialDaysLeft <= 3
            ? 'border-red-500/30 bg-red-500/10'
            : trialDaysLeft <= 7
            ? 'border-amber-500/30 bg-amber-500/10'
            : 'border-primary/20 bg-primary/5'
        }`}>
          <div className="space-y-0.5">
            <p className={`font-semibold text-sm ${trialDaysLeft <= 3 ? 'text-red-800 dark:text-red-200' : trialDaysLeft <= 7 ? 'text-amber-800 dark:text-amber-200' : ''}`}>
              {trialDaysLeft === 0
                ? '⚠️ Your trial ends today'
                : trialDaysLeft === 1
                ? '⚠️ Your trial ends tomorrow'
                : `🕐 ${trialDaysLeft} days left on your trial`}
            </p>
            <p className="text-xs text-muted-foreground">Subscribe below to keep your bot live and all customer data intact.</p>
          </div>
          <Button size="sm" onClick={() => document.getElementById('subscribe-section')?.scrollIntoView({ behavior: 'smooth' })}>
            Subscribe now
          </Button>
        </div>
      )}

      {billingIssue && (
        <StatusBanner
          variant={billingIssue.variant}
          title={billingIssue.title}
          message={billingIssue.message}
        />
      )}

      {banner === 'success' && (
        <StatusBanner
          variant="success"
          title="Payment submitted"
          message="PayFast is processing your subscription. Full access activates once payment confirms — usually within a few minutes."
          onDismiss={dismissBanner}
        />
      )}
      {banner === 'cancelled' && (
        <StatusBanner
          variant="warning"
          title="Checkout cancelled"
          message="No charge was made. Choose a plan below when you are ready."
          onDismiss={dismissBanner}
        />
      )}
      {error && (
        <StatusBanner
          variant="error"
          title="Something went wrong"
          message={error}
          onDismiss={() => setError(null)}
        />
      )}

      {subscription && statusMeta && (
        <CollapsibleCard
          id="billing-subscription"
          title="Your subscription"
          description={statusMeta.description}
        >
          <div className="space-y-3">
            <div className="flex justify-end -mt-1">
              <Badge className={`border shrink-0 ${statusMeta.badgeClass}`}>
                {statusMeta.label}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Plan </span>
                <span className="font-medium">{subscription.plan.name}</span>
              </div>
              {subscription.currentPeriodEnd && subscription.status === 'ACTIVE' && (
                <div className="flex items-center gap-1.5">
                  <Calendar className="size-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {subscription.cancelAtPeriodEnd ? 'Access until' : 'Renews'}{' '}
                  </span>
                  <span className="font-medium tabular-nums">
                    {new Date(subscription.currentPeriodEnd).toLocaleDateString('en-ZA', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              )}
              {subscription.billingProvider && (
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="size-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Billing via </span>
                  <span className="font-medium capitalize">{subscription.billingProvider}</span>
                </div>
              )}
            </div>

            {subscription.status === 'PAST_DUE' && (
              <p className="text-sm text-orange-800 dark:text-orange-200 bg-orange-500/10 border border-orange-500/20 rounded-lg px-3 py-2">
                Your monthly PayFast debit failed. Update your card or retry payment below — your bot may
                be limited until payment succeeds.
              </p>
            )}

            {subscription.cancelAtPeriodEnd && (
              <p className="text-sm text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                Cancellation scheduled — you keep full access until the end of your billing period.
              </p>
            )}

            {active && !showCancelConfirm && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => setShowCancelConfirm(true)}
                disabled={loading}
              >
                Cancel subscription
              </Button>
            )}

            {showCancelConfirm && (
              <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
                <div className="flex gap-2">
                  <AlertCircle className="size-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Cancel at period end?</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Your WhatsApp bot and dashboard stay active until{' '}
                      {subscription.currentPeriodEnd
                        ? new Date(subscription.currentPeriodEnd).toLocaleDateString('en-ZA')
                        : 'the end of your billing period'}
                      . No refund for the current period.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleCancel}
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="size-4 animate-spin" /> : 'Yes, cancel'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCancelConfirm(false)}
                    disabled={loading}
                  >
                    Keep subscription
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CollapsibleCard>
      )}

      {canSubscribe && (
        <CollapsibleSection id="billing-subscribe" title="Choose your plan" defaultOpen>
        <div id="subscribe-section" className="grid lg:grid-cols-5 gap-6 items-start">
          {subscription?.status === 'PAST_DUE' && (
            <div className="lg:col-span-5">
              <StatusBanner
                variant="error"
                title="Retry your PayFast subscription"
                message="Open PayFast again to pay your overdue monthly subscription and restore full access."
              />
            </div>
          )}
          <div className="lg:col-span-3 space-y-4">
            <div className="inline-flex rounded-lg border bg-muted/50 p-1 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setCycle('monthly')}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  cycle === 'monthly'
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setCycle('annual')}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  cycle === 'annual'
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Annual upfront
                {quote.annualSavingsCents > 0 && (
                  <span className="ml-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    Save {formatZAR(quote.annualSavingsCents)}
                  </span>
                )}
              </button>
            </div>

            <Card className="ring-primary/20 shadow-md">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-xl">{selectedPlan.name}</CardTitle>
                    <CardDescription className="mt-1">
                      Everything you need to run bookings on WhatsApp
                    </CardDescription>
                  </div>
                  {cycle === 'annual' && quote.annualSavingsCents > 0 && (
                    <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 shrink-0">
                      Best value
                    </Badge>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {FEATURES.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <Check className="size-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                  <li className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check className="size-4 text-emerald-500 shrink-0 mt-0.5" />
                    Unlimited staff · up to {selectedPlan.maxBranches} branches · unlimited services
                  </li>
                </ul>

                <Separator />

                <div className="space-y-3">
                  <PriceRow
                    label="Subscription (PayFast)"
                    detail={quote.payfastLabel}
                    amount={quote.recurringCents}
                    highlight
                  />
                  <PriceRow
                    label="Installation & onboarding"
                    detail="Invoiced once before go-live — not charged on PayFast"
                    amount={quote.setupCents}
                  />
                  <div className="rounded-lg bg-muted/60 px-4 py-3 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold">Total due at signup</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        PayFast today + setup invoice from our team
                      </p>
                    </div>
                    <p className="text-2xl font-bold tabular-nums">{formatZAR(quote.totalDueCents)}</p>
                  </div>
                </div>
              </CardContent>

              <CardFooter className="flex-col gap-2 items-stretch border-t bg-muted/30">
                <Button
                  className="w-full h-11 text-base"
                  onClick={handleSubscribe}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="size-4 animate-spin mr-2" />
                      Opening PayFast…
                    </>
                  ) : (
                    payfastCta
                  )}
                </Button>
                <p className="text-[11px] text-center text-muted-foreground leading-relaxed">
                  You&apos;ll complete payment on PayFast&apos;s secure site. Setup fee is invoiced
                  separately ({formatZAR(quote.setupCents)}) before we onboard your salon.
                </p>
              </CardFooter>
            </Card>
          </div>

          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">How it works</CardTitle>
                <CardDescription>Simple, transparent pricing — no hidden tiers</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {STEPS.map((step, i) => (
                  <div key={step.title} className="flex gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <step.icon className="size-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        <span className="text-muted-foreground mr-1.5">{i + 1}.</span>
                        {step.title}
                      </p>
                      <p className="text-sm text-muted-foreground mt-0.5">{step.body}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <p className="text-xs text-muted-foreground mt-4 text-center leading-relaxed">
              All prices in ZAR (South African Rand). VAT may apply where relevant.
              Questions? Email support@marineflow.co.za
            </p>
          </div>
        </div>
        </CollapsibleSection>
      )}

      {active && (
        <CollapsibleSection id="billing-active-note" title="Billing support" defaultOpen={false}>
        <Card className="border-dashed">
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            You&apos;re on the {selectedPlan.name} plan. Need to change billing cycle or have a billing
            question? Contact{' '}
            <a href="mailto:support@marineflow.co.za" className="text-primary underline-offset-4 hover:underline">
              support@marineflow.co.za
            </a>
          </CardContent>
        </Card>
        </CollapsibleSection>
      )}
    </div>
  );
}

function PriceRow({
  label,
  detail,
  amount,
  highlight,
}: {
  label: string;
  detail: string;
  amount: number;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className={`text-sm ${highlight ? 'font-medium' : 'text-muted-foreground'}`}>{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{detail}</p>
      </div>
      <p className={`tabular-nums shrink-0 ${highlight ? 'text-lg font-bold' : 'font-semibold'}`}>
        {formatZAR(amount)}
      </p>
    </div>
  );
}

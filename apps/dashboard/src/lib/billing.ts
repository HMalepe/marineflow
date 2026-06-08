export interface BillingPlan {
  id: string;
  name: string;
  tier: string;
  priceMonthly: number;
  priceAnnual: number;
  setupFeeMonthly: number;
  setupFeeAnnual: number;
  maxStaff: number;
  maxBranches: number;
  maxServices: number;
  features: string[];
  aiEnabled: boolean;
  isActive?: boolean;
}

export type BillingCycle = 'monthly' | 'annual';

export interface BillingQuote {
  cycle: BillingCycle;
  recurringCents: number;
  setupCents: number;
  totalDueCents: number;
  monthlyEquivalentCents: number;
  annualSavingsCents: number;
  recurringPeriodLabel: string;
  payfastLabel: string;
}

export function formatZAR(cents: number): string {
  return `R${(cents / 100).toLocaleString('en-ZA', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

export function computeBillingQuote(plan: BillingPlan, cycle: BillingCycle): BillingQuote {
  const recurringCents = cycle === 'annual' ? plan.priceAnnual : plan.priceMonthly;
  const setupCents = cycle === 'annual' ? plan.setupFeeAnnual : plan.setupFeeMonthly;
  const annualSavingsCents = Math.max(0, plan.priceMonthly * 12 - plan.priceAnnual);

  return {
    cycle,
    recurringCents,
    setupCents,
    totalDueCents: recurringCents + setupCents,
    monthlyEquivalentCents: cycle === 'annual'
      ? Math.round(plan.priceAnnual / 12)
      : plan.priceMonthly,
    annualSavingsCents,
    recurringPeriodLabel: cycle === 'annual' ? 'per year' : 'per month',
    payfastLabel: cycle === 'annual'
      ? `${formatZAR(plan.priceAnnual)} billed once per year`
      : `${formatZAR(plan.priceMonthly)} billed every month`,
  };
}

export function pickPaidPlan(plans: BillingPlan[]): BillingPlan | undefined {
  return plans.find((p) => p.isActive !== false && p.priceMonthly > 0)
    ?? plans.find((p) => p.priceMonthly > 0);
}

export const CHECKOUT_ERRORS: Record<string, string> = {
  invalid_input: 'Please choose a valid billing option.',
  invalid_plan: 'That plan is no longer available.',
  payfast_not_configured: 'Online payments are being set up. Contact us to subscribe.',
  already_subscribed: 'You already have an active subscription.',
  unauthorized: 'Only the salon owner can manage billing.',
  no_subscription: 'No active subscription to cancel.',
  not_active: 'Your subscription is not active.',
};

export function checkoutErrorMessage(code?: string): string {
  if (!code) return 'Something went wrong. Please try again.';
  return CHECKOUT_ERRORS[code] ?? 'Something went wrong. Please try again.';
}

export interface SubscriptionStatusMeta {
  label: string;
  description: string;
  badgeClass: string;
}

export function subscriptionStatusMeta(status: string): SubscriptionStatusMeta {
  const map: Record<string, SubscriptionStatusMeta> = {
    ACTIVE: {
      label: 'Active',
      description: 'Your subscription is active and billing through PayFast.',
      badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
    },
    TRIAL: {
      label: 'Trial',
      description: 'Complete checkout to activate your full MarineFlow plan.',
      badgeClass: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30',
    },
    PAST_DUE: {
      label: 'Past due',
      description: 'Payment failed. Update your PayFast subscription to restore access.',
      badgeClass: 'bg-orange-500/15 text-orange-800 dark:text-orange-300 border-orange-500/30',
    },
    CANCELLED: {
      label: 'Cancelled',
      description: 'Your subscription has ended. Subscribe again to restore full access.',
      badgeClass: 'bg-muted text-muted-foreground border-border',
    },
    PAUSED: {
      label: 'Paused',
      description: 'Billing is paused. Contact support if you need help.',
      badgeClass: 'bg-blue-500/15 text-blue-800 dark:text-blue-300 border-blue-500/30',
    },
  };

  return map[status] ?? {
    label: status,
    description: '',
    badgeClass: 'bg-muted text-muted-foreground border-border',
  };
}

export function isSubscriptionActive(
  subscription: { status: string; cancelAtPeriodEnd?: boolean } | null | undefined,
): boolean {
  return subscription?.status === 'ACTIVE' && !subscription.cancelAtPeriodEnd;
}

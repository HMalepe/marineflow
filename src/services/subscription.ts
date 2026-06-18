import crypto from 'node:crypto';
import type { SubscriptionBillingIssueKind } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { env } from '../config.js';
import { isPayfastConfigured } from '../lib/billingUrls.js';
import { payfastCredentials, payfastProcessUrl } from '../lib/integrations/payments/payfast.js';
import { buildPayfastSignature } from '../lib/integrations/payments/payfastSignature.js';
import {
  parsePayfastAmountCents,
  payfastFailureDetail,
  billingIssueKindFromPayfastStatus,
  toBillingIssueDto,
  type SubscriptionBillingIssueDto,
} from '../lib/subscriptionBilling.js';
import { emitPlatformEvent } from './platformEvents.js';

interface CreateSubscriptionInput {
  salonId: string;
  planTier: string;
  billingCycle: 'monthly' | 'annual';
  returnUrl: string;
  cancelUrl: string;
  notifyUrl: string;
}

export interface CheckoutSummary {
  billingCycle: 'monthly' | 'annual';
  recurringCents: number;
  setupCents: number;
  totalDueCents: number;
  payfastRecurringCents: number;
  planName: string;
  planTier: string;
}

export type SalonSubscriptionDto = Awaited<ReturnType<typeof getSalonSubscription>> & {
  billingIssue: SubscriptionBillingIssueDto | null;
};

export async function getPlans() {
  return prisma.subscriptionPlan.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  });
}

export async function getSalonSubscription(salonId: string) {
  const sub = await prisma.salonSubscription.findUnique({
    where: { salonId },
    include: { plan: true },
  });
  if (!sub) return null;

  return {
    ...sub,
    billingIssue: toBillingIssueDto({
      kind: sub.lastBillingIssueKind,
      at: sub.lastBillingIssueAt,
      detail: sub.lastBillingIssueDetail,
    }),
  };
}

async function resolveDefaultPlanId(planId?: string | null): Promise<string> {
  if (planId) {
    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (plan) return plan.id;
  }
  const fallback = await prisma.subscriptionPlan.findFirst({
    where: { tier: 'marineflow', isActive: true },
  });
  return fallback?.id ?? 'plan_marineflow';
}

async function recordSubscriptionBillingIssue(input: {
  salonId: string;
  kind: SubscriptionBillingIssueKind;
  detail: string;
  planId?: string | null;
  setPastDue?: boolean;
  amountCents?: number | null;
  payfastReference?: string | null;
}): Promise<void> {
  const planId = await resolveDefaultPlanId(input.planId);
  const now = new Date();

  await prisma.salonSubscription.upsert({
    where: { salonId: input.salonId },
    create: {
      salonId: input.salonId,
      planId,
      status: input.setPastDue ? 'PAST_DUE' : 'TRIAL',
      billingProvider: 'payfast',
      lastBillingIssueKind: input.kind,
      lastBillingIssueAt: now,
      lastBillingIssueDetail: input.detail,
      lastPaymentAt: input.kind === 'PAYMENT_DECLINED' ? now : null,
      lastPaymentAmountCents: input.amountCents ?? null,
    },
    update: {
      ...(input.setPastDue ? { status: 'PAST_DUE' as const } : {}),
      lastBillingIssueKind: input.kind,
      lastBillingIssueAt: now,
      lastBillingIssueDetail: input.detail,
      ...(input.kind === 'PAYMENT_DECLINED'
        ? {
            lastPaymentAt: now,
            lastPaymentAmountCents: input.amountCents ?? null,
          }
        : {}),
    },
  });

  if (input.setPastDue) {
    await prisma.salon.update({
      where: { id: input.salonId },
      data: { status: 'PAST_DUE', statusChangedAt: now },
    });
  }

  emitPlatformEvent({
    type: 'PAYMENT_FAILED',
    salonId: input.salonId,
    metadata: {
      source: 'subscription',
      kind: input.kind,
      detail: input.detail,
      amountCents: input.amountCents ?? null,
      payfastReference: input.payfastReference ?? null,
    },
  });
}

/** Owner returned from PayFast cancel URL without paying. */
export async function recordCheckoutAbandoned(salonId: string): Promise<void> {
  const existing = await prisma.salonSubscription.findUnique({ where: { salonId } });
  if (existing?.status === 'ACTIVE' && existing.payfastSubscriptionId) return;

  await recordSubscriptionBillingIssue({
    salonId,
    kind: 'CHECKOUT_ABANDONED',
    detail: 'Customer left PayFast checkout without completing payment.',
    planId: existing?.planId,
  });
}

export async function createPayfastSubscription(input: CreateSubscriptionInput) {
  if (!isPayfastConfigured()) {
    return { ok: false as const, error: 'payfast_not_configured' as const };
  }

  const plan = await prisma.subscriptionPlan.findUnique({
    where: { tier: input.planTier },
  });

  if (!plan || !plan.isActive || plan.priceMonthly <= 0) {
    return { ok: false as const, error: 'invalid_plan' as const };
  }

  const existing = await prisma.salonSubscription.findUnique({
    where: { salonId: input.salonId },
  });

  if (existing?.status === 'ACTIVE' && !existing.cancelAtPeriodEnd && existing.payfastSubscriptionId) {
    return { ok: false as const, error: 'already_subscribed' as const };
  }

  const recurringCents = input.billingCycle === 'annual'
    ? plan.priceAnnual
    : plan.priceMonthly;

  const setupCents = input.billingCycle === 'annual'
    ? plan.setupFeeAnnual
    : plan.setupFeeMonthly;

  const recurringRands = (recurringCents / 100).toFixed(2);
  const frequency = input.billingCycle === 'annual' ? '6' : '3'; // 3=monthly, 6=annually in PayFast

  const cycleLabel = input.billingCycle === 'annual' ? 'Annual' : 'Monthly';

  const { merchantId, merchantKey } = payfastCredentials();

  const data: Record<string, string> = {
    merchant_id: merchantId,
    merchant_key: merchantKey,
    return_url: input.returnUrl,
    cancel_url: input.cancelUrl,
    notify_url: input.notifyUrl,
    name_first: 'Salon',
    email_address: '',
    m_payment_id: `sub_${input.salonId}_${Date.now()}`,
    amount: recurringRands,
    item_name: `MarineFlow ${cycleLabel} subscription`,
    subscription_type: '1',
    frequency: frequency,
    cycles: '0', // indefinite
    custom_str1: input.salonId,
    custom_str2: plan.id,
    custom_str3: input.billingCycle,
  };

  const signature = generatePayfastSignature(data);
  data.signature = signature;

  const summary: CheckoutSummary = {
    billingCycle: input.billingCycle,
    recurringCents,
    setupCents,
    totalDueCents: recurringCents + setupCents,
    payfastRecurringCents: recurringCents,
    planName: plan.name,
    planTier: plan.tier,
  };

  return {
    ok: true as const,
    url: payfastProcessUrl(),
    formData: data,
    summary,
  };
}

export async function handlePayfastSubscriptionWebhook(body: Record<string, string>) {
  const salonId = body.custom_str1;
  const planId = body.custom_str2;
  const payfastToken = body.token;
  const paymentStatus = body.payment_status;

  if (!salonId) return;

  const existing = await prisma.salonSubscription.findUnique({ where: { salonId } });
  const hadActiveSubscription =
    existing?.status === 'ACTIVE' && Boolean(existing.payfastSubscriptionId?.trim());

  if (paymentStatus === 'COMPLETE') {
    const billingCycle = body.custom_str3 === 'annual' ? 'annual' : 'monthly';
    const periodMs = billingCycle === 'annual'
      ? 365 * 24 * 60 * 60 * 1000
      : 30 * 24 * 60 * 60 * 1000;

    const plan = planId
      ? await prisma.subscriptionPlan.findUnique({ where: { id: planId } })
      : await prisma.subscriptionPlan.findFirst({ where: { tier: 'marineflow', isActive: true } });

    const resolvedPlanId = plan?.id ?? planId ?? 'plan_marineflow';
    const amountCents = parsePayfastAmountCents(body);
    const now = new Date();

    await prisma.salonSubscription.upsert({
      where: { salonId },
      create: {
        salonId,
        planId: resolvedPlanId,
        status: 'ACTIVE',
        billingProvider: 'payfast',
        payfastSubscriptionId: payfastToken,
        currentPeriodStart: now,
        currentPeriodEnd: new Date(now.getTime() + periodMs),
        cancelAtPeriodEnd: false,
        cancelledAt: null,
        lastPaymentAt: now,
        lastPaymentAmountCents: amountCents,
        lastBillingIssueKind: null,
        lastBillingIssueAt: null,
        lastBillingIssueDetail: null,
      },
      update: {
        planId: resolvedPlanId,
        status: 'ACTIVE',
        payfastSubscriptionId: payfastToken,
        currentPeriodStart: now,
        currentPeriodEnd: new Date(now.getTime() + periodMs),
        cancelAtPeriodEnd: false,
        cancelledAt: null,
        lastPaymentAt: now,
        lastPaymentAmountCents: amountCents,
        lastBillingIssueKind: null,
        lastBillingIssueAt: null,
        lastBillingIssueDetail: null,
      },
    });

    await prisma.salon.update({
      where: { id: salonId },
      data: { tier: plan?.tier ?? 'marineflow', status: 'ACTIVE', statusChangedAt: now },
    });

    emitPlatformEvent({
      type: 'PAYMENT_SUCCEEDED',
      salonId,
      metadata: {
        source: 'subscription',
        amountCents,
        payfastReference: body.m_payment_id ?? null,
        billingCycle,
      },
    });
    return;
  }

  const issueKind = billingIssueKindFromPayfastStatus(paymentStatus, hadActiveSubscription);

  if (issueKind === 'PAYMENT_DECLINED') {
    await recordSubscriptionBillingIssue({
      salonId,
      kind: 'PAYMENT_DECLINED',
      detail: payfastFailureDetail(body),
      planId: planId ?? existing?.planId,
      setPastDue: true,
      amountCents: parsePayfastAmountCents(body),
      payfastReference: body.m_payment_id ?? null,
    });
    return;
  }

  if (issueKind === 'CHECKOUT_ABANDONED') {
    await recordSubscriptionBillingIssue({
      salonId,
      kind: 'CHECKOUT_ABANDONED',
      detail: payfastFailureDetail(body),
      planId: planId ?? existing?.planId,
      payfastReference: body.m_payment_id ?? null,
    });
    return;
  }

  if (paymentStatus === 'CANCELLED' && hadActiveSubscription) {
    await prisma.salonSubscription.updateMany({
      where: { salonId },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
    await prisma.salon.update({
      where: { id: salonId },
      data: { tier: 'starter' },
    });
  }
}

export async function cancelSubscription(salonId: string) {
  const sub = await prisma.salonSubscription.findUnique({ where: { salonId } });
  if (!sub) return { ok: false, error: 'no_subscription' as const };
  if (sub.status !== 'ACTIVE') return { ok: false, error: 'not_active' as const };
  if (sub.cancelAtPeriodEnd) return { ok: true as const, alreadyScheduled: true as const };

  if (sub.payfastSubscriptionId && payfastCredentials().merchantId) {
    const cancelUrl = env.PAYFAST_IS_TEST
      ? `https://sandbox.payfast.co.za/subscriptions/${sub.payfastSubscriptionId}/cancel`
      : `https://api.payfast.co.za/subscriptions/${sub.payfastSubscriptionId}/cancel`;

    const timestamp = new Date().toISOString().replace(/\.\d+Z$/, '+02:00');
    const sig = generateApiSignature(timestamp);

    await fetch(cancelUrl, {
      method: 'PUT',
      headers: {
        'merchant-id': env.PAYFAST_MERCHANT_ID ?? '',
        version: 'v1',
        timestamp,
        signature: sig,
      },
    });
  }

  await prisma.salonSubscription.update({
    where: { salonId },
    data: { cancelAtPeriodEnd: true },
  });

  return { ok: true as const };
}

export function checkQuota(
  tier: string,
  resource: 'staff' | 'branches' | 'services',
  currentCount: number,
): { allowed: boolean; limit: number } {
  if (resource === 'staff') {
    return { allowed: true, limit: 9999 };
  }

  const limits: Record<string, Record<string, number>> = {
    starter: { branches: 1, services: 10 },
    marineflow: { branches: 5, services: 9999 },
    pro: { branches: 3, services: 50 },
    enterprise: { branches: 9999, services: 9999 },
  };

  const tierLimits = limits[tier] ?? limits.starter;
  const limit = tierLimits[resource] ?? 0;

  return { allowed: currentCount < limit, limit };
}

function generatePayfastSignature(data: Record<string, string>): string {
  const { passphrase } = payfastCredentials();
  const order = [
    'merchant_id',
    'merchant_key',
    'return_url',
    'cancel_url',
    'notify_url',
    'name_first',
    'email_address',
    'm_payment_id',
    'amount',
    'item_name',
    'subscription_type',
    'frequency',
    'cycles',
    'custom_str1',
    'custom_str2',
    'custom_str3',
  ] as const;
  const fields = order
    .filter((key) => data[key] !== undefined && data[key] !== '')
    .map((key) => [key, data[key]!] as [string, string]);
  return buildPayfastSignature(fields, passphrase || undefined);
}

function generateApiSignature(timestamp: string): string {
  const { passphrase, merchantId } = payfastCredentials();
  const str = `merchant-id=${merchantId}&passphrase=${passphrase}&timestamp=${timestamp}&version=v1`;
  return crypto.createHash('md5').update(str).digest('hex');
}

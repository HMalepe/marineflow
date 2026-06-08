import crypto from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { env } from '../config.js';
import { isPayfastConfigured } from '../lib/billingUrls.js';

const PAYFAST_URL = env.PAYFAST_IS_TEST
  ? 'https://sandbox.payfast.co.za/eng/process'
  : 'https://www.payfast.co.za/eng/process';

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

export async function getPlans() {
  return prisma.subscriptionPlan.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  });
}

export async function getSalonSubscription(salonId: string) {
  return prisma.salonSubscription.findUnique({
    where: { salonId },
    include: { plan: true },
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

  if (existing?.status === 'ACTIVE' && !existing.cancelAtPeriodEnd) {
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

  const data: Record<string, string> = {
    merchant_id: env.PAYFAST_MERCHANT_ID ?? '',
    merchant_key: env.PAYFAST_MERCHANT_KEY ?? '',
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
    url: PAYFAST_URL,
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

  if (paymentStatus === 'COMPLETE') {
    const billingCycle = body.custom_str3 === 'annual' ? 'annual' : 'monthly';
    const periodMs = billingCycle === 'annual'
      ? 365 * 24 * 60 * 60 * 1000
      : 30 * 24 * 60 * 60 * 1000;

    const plan = planId
      ? await prisma.subscriptionPlan.findUnique({ where: { id: planId } })
      : await prisma.subscriptionPlan.findFirst({ where: { tier: 'marineflow', isActive: true } });

    const resolvedPlanId = plan?.id ?? planId ?? 'plan_marineflow';

    await prisma.salonSubscription.upsert({
      where: { salonId },
      create: {
        salonId,
        planId: resolvedPlanId,
        status: 'ACTIVE',
        billingProvider: 'payfast',
        payfastSubscriptionId: payfastToken,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + periodMs),
        cancelAtPeriodEnd: false,
        cancelledAt: null,
      },
      update: {
        planId: resolvedPlanId,
        status: 'ACTIVE',
        payfastSubscriptionId: payfastToken,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + periodMs),
        cancelAtPeriodEnd: false,
        cancelledAt: null,
      },
    });

    await prisma.salon.update({
      where: { id: salonId },
      data: { tier: plan?.tier ?? 'marineflow' },
    });
  } else if (paymentStatus === 'CANCELLED') {
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

  if (sub.payfastSubscriptionId && env.PAYFAST_MERCHANT_ID) {
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
  const limits: Record<string, Record<string, number>> = {
    starter: { staff: 3, branches: 1, services: 10 },
    marineflow: { staff: 20, branches: 5, services: 9999 },
    pro: { staff: 10, branches: 3, services: 50 },
    enterprise: { staff: 9999, branches: 9999, services: 9999 },
  };

  const tierLimits = limits[tier] ?? limits.starter;
  const limit = tierLimits[resource] ?? 0;

  return { allowed: currentCount < limit, limit };
}

function generatePayfastSignature(data: Record<string, string>): string {
  const passphrase = env.PAYFAST_PASSPHRASE ?? '';
  const params = Object.entries(data)
    .filter(([_, v]) => v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(v.trim()).replace(/%20/g, '+')}`)
    .join('&');

  const withPassphrase = passphrase ? `${params}&passphrase=${encodeURIComponent(passphrase)}` : params;
  return crypto.createHash('md5').update(withPassphrase).digest('hex');
}

function generateApiSignature(timestamp: string): string {
  const passphrase = env.PAYFAST_PASSPHRASE ?? '';
  const merchantId = env.PAYFAST_MERCHANT_ID ?? '';
  const str = `merchant-id=${merchantId}&passphrase=${passphrase}&timestamp=${timestamp}&version=v1`;
  return crypto.createHash('md5').update(str).digest('hex');
}

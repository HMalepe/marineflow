import crypto from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { env } from '../config.js';

const PAYFAST_URL = env.NODE_ENV === 'production'
  ? 'https://www.payfast.co.za/eng/process'
  : 'https://sandbox.payfast.co.za/eng/process';

interface CreateSubscriptionInput {
  salonId: string;
  planTier: string;
  billingCycle: 'monthly' | 'annual';
  returnUrl: string;
  cancelUrl: string;
  notifyUrl: string;
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
  const plan = await prisma.subscriptionPlan.findUniqueOrThrow({
    where: { tier: input.planTier },
  });

  const amount = input.billingCycle === 'annual'
    ? plan.priceAnnual
    : plan.priceMonthly;

  const amountRands = (amount / 100).toFixed(2);
  const frequency = input.billingCycle === 'annual' ? '6' : '3'; // 3=monthly, 6=annually in PayFast

  const data: Record<string, string> = {
    merchant_id: env.PAYFAST_MERCHANT_ID ?? '',
    merchant_key: env.PAYFAST_MERCHANT_KEY ?? '',
    return_url: input.returnUrl,
    cancel_url: input.cancelUrl,
    notify_url: input.notifyUrl,
    name_first: 'Salon',
    email_address: '',
    m_payment_id: `sub_${input.salonId}_${Date.now()}`,
    amount: amountRands,
    item_name: `MarineFlow ${plan.name} (${input.billingCycle})`,
    subscription_type: '1',
    frequency: frequency,
    cycles: '0', // indefinite
    custom_str1: input.salonId,
    custom_str2: plan.id,
  };

  const signature = generatePayfastSignature(data);
  data.signature = signature;

  // Create local record
  await prisma.salonSubscription.upsert({
    where: { salonId: input.salonId },
    create: {
      salonId: input.salonId,
      planId: plan.id,
      status: 'TRIAL',
      billingProvider: 'payfast',
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
    update: {
      planId: plan.id,
      status: 'TRIAL',
    },
  });

  return { url: PAYFAST_URL, formData: data };
}

export async function handlePayfastSubscriptionWebhook(body: Record<string, string>) {
  const salonId = body.custom_str1;
  const planId = body.custom_str2;
  const payfastToken = body.token;
  const paymentStatus = body.payment_status;

  if (!salonId) return;

  if (paymentStatus === 'COMPLETE') {
    await prisma.salonSubscription.upsert({
      where: { salonId },
      create: {
        salonId,
        planId: planId || 'plan_starter',
        status: 'ACTIVE',
        billingProvider: 'payfast',
        payfastSubscriptionId: payfastToken,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
      update: {
        status: 'ACTIVE',
        payfastSubscriptionId: payfastToken,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    // Update salon tier
    await prisma.salon.update({
      where: { id: salonId },
      data: { tier: (await prisma.subscriptionPlan.findUnique({ where: { id: planId } }))?.tier ?? 'starter' },
    });
  } else if (paymentStatus === 'CANCELLED') {
    await prisma.salonSubscription.update({
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
  if (!sub) return { ok: false, error: 'no_subscription' };

  if (sub.payfastSubscriptionId && env.PAYFAST_MERCHANT_ID) {
    // PayFast cancel API
    const cancelUrl = env.NODE_ENV === 'production'
      ? `https://api.payfast.co.za/subscriptions/${sub.payfastSubscriptionId}/cancel`
      : `https://sandbox.payfast.co.za/subscriptions/${sub.payfastSubscriptionId}/cancel`;

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

  return { ok: true };
}

export function checkQuota(
  tier: string,
  resource: 'staff' | 'branches' | 'services',
  currentCount: number,
): { allowed: boolean; limit: number } {
  const limits: Record<string, Record<string, number>> = {
    starter: { staff: 3, branches: 1, services: 10 },
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

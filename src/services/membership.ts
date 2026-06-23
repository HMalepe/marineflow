import { MessageDirection } from '@prisma/client';
import { DateTime } from 'luxon';
import { env } from '../config.js';
import { getTenantDb } from '../lib/db/tenantSession.js';
import { parseAutomationsFromMetadata } from '../lib/automationSettings.js';
import {
  buildPayfastRecurringCheckoutForm,
  isPayfastConfigured,
  payfastAdapter,
} from '../lib/integrations/payments/payfast.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { sendWithFallback } from './channelRouter.js';
import { parsePayfastAmountCents } from '../lib/subscriptionBilling.js';

const PAYFAST_MEMBERSHIP_NOTIFY_PATH = '/webhooks/payfast/membership';

function membershipPaymentReference(): string {
  return `mem_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function getActiveMembershipPlans(salonId: string) {
  const db = getTenantDb();
  return db.membershipPlan.findMany({
    where: { salonId, active: true },
    orderBy: { sortOrder: 'asc' },
  });
}

export async function getCustomerActiveMembership(salonId: string, customerId: string) {
  const db = getTenantDb();
  return db.customerMembership.findFirst({
    where: { salonId, customerId, active: true, renewsAt: { gt: new Date() } },
    include: { plan: true },
  });
}

export async function createMembershipCheckoutSession(input: {
  salonId: string;
  customerId: string;
  planId: string;
}): Promise<{ checkoutUrl: string | null; error?: string }> {
  if (!isPayfastConfigured()) {
    return { checkoutUrl: null, error: 'payfast_not_configured' };
  }

  const db = getTenantDb();
  const plan = await db.membershipPlan.findFirst({
    where: { id: input.planId, salonId: input.salonId, active: true },
  });
  if (!plan) return { checkoutUrl: null, error: 'plan_not_found' };

  const salon = await db.salon.findUnique({
    where: { id: input.salonId },
    select: { metadata: true, name: true, tradingName: true },
  });
  const automations = parseAutomationsFromMetadata(salon?.metadata);
  if (!automations.membership.enabled) {
    return { checkoutUrl: null, error: 'membership_disabled' };
  }

  const existing = await getCustomerActiveMembership(input.salonId, input.customerId);
  if (existing) {
    return { checkoutUrl: null, error: 'already_subscribed' };
  }

  const baseUrl = env.PUBLIC_BASE_URL ?? 'http://localhost:3000';
  const reference = membershipPaymentReference();
  const salonName = salon?.tradingName?.trim() || salon?.name || 'Salon';

  const form = buildPayfastRecurringCheckoutForm({
    reference,
    amountCents: plan.priceCents,
    description: `${salonName} VIP — ${plan.name}`,
    returnUrl: `${baseUrl}/pay/success?ref=${reference}`,
    cancelUrl: `${baseUrl}/pay/cancel?ref=${reference}`,
    notifyUrl: `${baseUrl}${PAYFAST_MEMBERSHIP_NOTIFY_PATH}`,
    customStr1: input.salonId,
    customStr2: input.customerId,
    customStr3: plan.id,
    frequency: '3',
    cycles: '0',
  });

  const payment = await db.payment.create({
    data: {
      salonId: input.salonId,
      customerId: input.customerId,
      provider: 'PAYFAST',
      status: 'PENDING',
      amountCents: plan.priceCents,
      currency: 'ZAR',
      externalReference: reference,
      payfastMerchantRef: reference,
      metadata: {
        type: 'membership',
        planId: plan.id,
        reference,
        provider: 'payfast',
        payfastForm: form,
      },
    },
  });

  return { checkoutUrl: `${baseUrl}/pay/checkout/${payment.id}` };
}

async function sendMembershipWelcomeWhatsApp(input: {
  salonId: string;
  customerId: string;
  planName: string;
  visitsPerMonth: number;
  priceCents: number;
  savingsCents: number;
  renewsAt: Date;
  isRenewal: boolean;
}): Promise<void> {
  const customer = await prisma.customer.findUnique({
    where: { id: input.customerId },
    select: { waId: true, firstName: true },
  });
  if (!customer?.waId) return;

  const salon = await prisma.salon.findUnique({
    where: { id: input.salonId },
    select: { name: true, tradingName: true },
  });
  const salonName = salon?.tradingName?.trim() || salon?.name || 'us';
  const price = (input.priceCents / 100).toFixed(0);
  const savings =
    input.savingsCents > 0 ? `\n💰 Save up to *R${(input.savingsCents / 100).toFixed(0)}* when you use all ${input.visitsPerMonth} cuts.` : '';
  const renewLabel = DateTime.fromJSDate(input.renewsAt).toFormat('dd MMM yyyy');

  const lines = input.isRenewal
    ? [
        customer.firstName ? `Hi ${customer.firstName}!` : 'Hi there!',
        '',
        `✅ Your *${input.planName}* membership renewed — *${input.visitsPerMonth}* visits loaded for this month.`,
        `Next debit: *R${price}* on ${renewLabel} via PayFast.`,
        '',
        'Reply *MENU* to book your next cut.',
      ]
    : [
        customer.firstName ? `🎉 Welcome, ${customer.firstName}!` : '🎉 Welcome to VIP!',
        '',
        `You're in — *${input.planName}* at *R${price}/month* via PayFast.`,
        `✂️ Up to *${input.visitsPerMonth} haircuts* each month.${savings}`,
        '',
        `PayFast will debit on the same day each month. Renews: *${renewLabel}*.`,
        'Your 10th cut loyalty reward still applies on top! 🎁',
        '',
        'Reply *MENU* to book.',
      ];

  const body = lines.join('\n');
  let providerSid: string | null = null;
  try {
    const { result } = await sendWithFallback({
      salonId: input.salonId,
      to: customer.waId,
      body,
    });
    providerSid = result.providerMessageId ?? null;
  } catch {
    /* best-effort */
  }

  const conv = await prisma.conversation.findUnique({
    where: { salonId_customerId: { salonId: input.salonId, customerId: input.customerId } },
    select: { id: true },
  });
  if (conv) {
    await prisma.message.create({
      data: {
        conversationId: conv.id,
        customerId: input.customerId,
        direction: MessageDirection.OUTBOUND,
        body,
        providerSid,
      },
    });
  }
}

export async function activateMembershipFromPayfast(input: {
  salonId: string;
  customerId: string;
  planId: string;
  payfastToken: string | null;
  amountCents: number | null;
  paymentId?: string | null;
}): Promise<void> {
  const plan = await prisma.membershipPlan.findFirst({
    where: { id: input.planId, salonId: input.salonId, active: true },
  });
  if (!plan) {
    logger.warn({ planId: input.planId, salonId: input.salonId }, 'membership_plan_missing_on_itn');
    return;
  }

  const token = input.payfastToken?.trim() || null;
  const renewsAt = new Date();
  renewsAt.setMonth(renewsAt.getMonth() + 1);

  const existingByToken =
    token != null
      ? await prisma.customerMembership.findFirst({
          where: { salonId: input.salonId, payfastToken: token, active: true },
          include: { plan: true },
        })
      : null;

  if (existingByToken) {
    await prisma.customerMembership.update({
      where: { id: existingByToken.id },
      data: {
        visitsRemaining: plan.visitsPerMonth,
        renewsAt,
        payfastSubscriptionId: token,
      },
    });
    if (input.paymentId) {
      await prisma.payment.updateMany({
        where: { id: input.paymentId, status: 'PENDING' },
        data: { status: 'SUCCEEDED', payfastPaymentId: token, paidAt: new Date() },
      });
    }
    await sendMembershipWelcomeWhatsApp({
      salonId: input.salonId,
      customerId: input.customerId,
      planName: plan.name,
      visitsPerMonth: plan.visitsPerMonth,
      priceCents: plan.priceCents,
      savingsCents: plan.savingsCents,
      renewsAt,
      isRenewal: true,
    });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.customerMembership.updateMany({
      where: { salonId: input.salonId, customerId: input.customerId, active: true },
      data: { active: false },
    });

    await tx.customerMembership.create({
      data: {
        salonId: input.salonId,
        customerId: input.customerId,
        planId: plan.id,
        visitsRemaining: plan.visitsPerMonth,
        renewsAt,
        active: true,
        payfastToken: token,
        payfastSubscriptionId: token,
      },
    });

    if (input.paymentId) {
      await tx.payment.updateMany({
        where: { id: input.paymentId, status: 'PENDING' },
        data: { status: 'SUCCEEDED', payfastPaymentId: token, paidAt: new Date() },
      });
    }
  });

  await sendMembershipWelcomeWhatsApp({
    salonId: input.salonId,
    customerId: input.customerId,
    planName: plan.name,
    visitsPerMonth: plan.visitsPerMonth,
    priceCents: input.amountCents ?? plan.priceCents,
    savingsCents: plan.savingsCents,
    renewsAt,
    isRenewal: false,
  });
}

export async function handlePayfastMembershipWebhook(body: Record<string, string>): Promise<void> {
  const verified = payfastAdapter.verifyWebhook(body, {});
  if (!verified.valid) {
    logger.warn({ reference: body.m_payment_id }, 'payfast_membership_itn_invalid');
    return;
  }

  const reference = verified.reference;
  if (!reference?.startsWith('mem_')) return;

  const salonId = body.custom_str1;
  const customerId = body.custom_str2;
  const planId = body.custom_str3;
  if (!salonId || !customerId || !planId) {
    logger.warn({ reference }, 'payfast_membership_itn_missing_custom_fields');
    return;
  }

  const payment = await prisma.payment.findFirst({
    where: { externalReference: reference, salonId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, status: true },
  });

  if (verified.status !== 'success') {
    if (payment) {
      await prisma.payment.updateMany({
        where: { id: payment.id, status: 'PENDING' },
        data: { status: 'FAILED', failureReason: verified.status ?? 'failed' },
      });
    }
    return;
  }

  await activateMembershipFromPayfast({
    salonId,
    customerId,
    planId,
    payfastToken: body.token ?? null,
    amountCents: parsePayfastAmountCents(body) ?? verified.amountCents ?? null,
    paymentId: payment?.id ?? null,
  });
}

/** @deprecated Instant subscribe without payment — use createMembershipCheckoutSession. */
export async function subscribeCustomerToPlan(params: {
  salonId: string;
  customerId: string;
  planId: string;
}) {
  return createMembershipCheckoutSession(params);
}

export async function consumeMembershipVisit(params: {
  salonId: string;
  customerId: string;
}): Promise<{ used: boolean; visitsRemaining?: number }> {
  const db = getTenantDb();
  const active = await getCustomerActiveMembership(params.salonId, params.customerId);
  if (!active || active.visitsRemaining <= 0) return { used: false };

  const updated = await db.customerMembership.update({
    where: { id: active.id },
    data: { visitsRemaining: { decrement: 1 } },
  });

  return { used: true, visitsRemaining: updated.visitsRemaining };
}

export function formatMembershipPlansMenu(
  plans: Awaited<ReturnType<typeof getActiveMembershipPlans>>,
): string {
  if (!plans.length) return 'No membership plans available right now.';
  const lines = plans.map((p, i) => {
    const price = (p.priceCents / 100).toFixed(0);
    const savings = p.savingsCents > 0 ? ` — save ~R${(p.savingsCents / 100).toFixed(0)}` : '';
    const desc = p.description?.trim();
    const detail = desc ? `\n   _${desc}_` : '';
    return `${i + 1}. *${p.name}* — R${price}/mo\n   ✂️ Up to ${p.visitsPerMonth} cuts/month${savings}${detail}`;
  });
  return [
    '💎 *VIP Membership*',
    'Sign up once — PayFast debits the same day every month. Cancel anytime via the salon.',
    '',
    ...lines,
    '',
    'Reply with a number to subscribe securely on PayFast, or BACK.',
  ].join('\n');
}

export function formatMembershipCheckoutPrompt(plan: {
  name: string;
  priceCents: number;
  visitsPerMonth: number;
  savingsCents: number;
}): string {
  const price = (plan.priceCents / 100).toFixed(0);
  const savings =
    plan.savingsCents > 0
      ? `\n💰 Use all ${plan.visitsPerMonth} cuts and save ~R${(plan.savingsCents / 100).toFixed(0)} vs walk-in.`
      : '';
  return [
    `💳 *${plan.name}* — R${price}/month`,
    `Up to ${plan.visitsPerMonth} haircuts per month.${savings}`,
    '',
    'Tap below for secure PayFast checkout (card, Apple Pay, etc.).',
    'PayFast will debit on this day each month until you cancel.',
  ].join('\n');
}

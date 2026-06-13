import { getTenantDb } from '../lib/db/tenantSession.js';
import { sendWithFallback } from './channelRouter.js';
import { generateReferralCode } from './referrals.js';
import { parseAutomationsFromMetadata } from '../lib/automationSettings.js';
import { shouldSendReferralPrompt } from '../lib/powerFeaturesMenu.js';
import { logger } from '../lib/logger.js';

const APP_BASE = process.env.APP_PUBLIC_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.marineflow.co.za';

/**
 * Build a WhatsApp deep-link style referral message for sharing.
 */
export function buildReferralShareMessage(params: {
  code: string;
  salonName: string;
  rewardCents: number;
}): string {
  const reward = (params.rewardCents / 100).toFixed(0);
  return (
    `Join me at ${params.salonName}! Use my referral code *${params.code}* when you book your first visit.\n\n` +
    `We both get R${reward} off 💈`
  );
}

export async function getOrCreateReferralCode(salonId: string, customerId: string) {
  const db = getTenantDb();
  const salon = await db.salon.findUnique({
    where: { id: salonId },
    select: { metadata: true, name: true, tradingName: true },
  });
  if (!salon) return null;

  const automations = parseAutomationsFromMetadata(salon.metadata);
  if (!automations.referral.enabled) return null;

  const code = await generateReferralCode(salonId, customerId);

  if (automations.referral.rewardCents !== code.rewardCents) {
    await db.referralCode.update({
      where: { id: code.id },
      data: { rewardCents: automations.referral.rewardCents },
    });
  }

  return {
    code,
    salonName: salon.tradingName ?? salon.name,
    rewardCents: automations.referral.rewardCents,
  };
}

/**
 * After a completed visit, nudge referrer-worthy customers with their code.
 */
export async function maybeSendReferralPrompt(params: {
  salonId: string;
  customerId: string;
  completedVisits: number;
}): Promise<boolean> {
  const db = getTenantDb();
  const [salon, customer] = await Promise.all([
    db.salon.findUnique({
      where: { id: params.salonId },
      select: { metadata: true, name: true, tradingName: true },
    }),
    db.customer.findUnique({
      where: { id: params.customerId },
      select: { waId: true, firstName: true, marketingConsentStatus: true },
    }),
  ]);
  if (!salon || !customer?.waId) return false;
  if (customer.marketingConsentStatus !== 'ACCEPTED') return false;

  const automations = parseAutomationsFromMetadata(salon.metadata);
  if (!automations.referral.enabled) return false;

  const visits = params.completedVisits;
  if (!shouldSendReferralPrompt(visits, automations.referral.promptAfterVisits)) {
    return false;
  }

  const recentPrompt = await db.analyticsEvent.findMany({
    where: {
      salonId: params.salonId,
      customerId: params.customerId,
      type: 'referral_prompt_sent',
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { payload: true },
  });
  if (
    recentPrompt.some((e) => {
      const p = e.payload as { visit?: number } | null;
      return p?.visit === visits;
    })
  ) {
    return false;
  }

  const ref = await getOrCreateReferralCode(params.salonId, params.customerId);
  if (!ref) return false;

  const reward = (ref.rewardCents / 100).toFixed(0);
  const body =
    `Hey ${customer.firstName ?? 'there'}! 🙌\n\n` +
    `Know someone who needs a fresh cut? Refer a friend with code *${ref.code.code}* — ` +
    `you get R${reward} off your next visit when they book and pay.\n\n` +
    `Share this link: ${APP_BASE}/r/${ref.code.code}\n\n` +
    `Reply REFERRAL anytime for your code. Reply STOP to opt out.`;

  try {
    await sendWithFallback({ salonId: params.salonId, to: customer.waId, body });
    await db.analyticsEvent.create({
      data: {
        salonId: params.salonId,
        customerId: params.customerId,
        type: 'referral_prompt_sent',
        payload: { visit: visits, code: ref.code.code },
      },
    });
    return true;
  } catch (err) {
    logger.warn({ err, customerId: params.customerId }, 'referral_prompt_failed');
    return false;
  }
}

/**
 * Award referrer when referee completes first paid booking with referral code.
 */
export async function notifyReferrerReward(params: {
  salonId: string;
  referrerCustomerId: string;
  refereeName: string;
  rewardCents: number;
}): Promise<void> {
  const db = getTenantDb();
  const referrer = await db.customer.findUnique({
    where: { id: params.referrerCustomerId },
    select: { waId: true, firstName: true },
  });
  if (!referrer?.waId) return;

  const reward = (params.rewardCents / 100).toFixed(0);
  const body =
    `Great news ${referrer.firstName ?? 'there'}! 🎉\n\n` +
    `${params.refereeName} just booked using your referral — you've earned R${reward} off your next haircut.\n\n` +
    `Reply 1 to book now and use your reward!`;

  await sendWithFallback({ salonId: params.salonId, to: referrer.waId, body });
}

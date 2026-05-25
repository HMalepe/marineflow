import crypto from 'node:crypto';
import { getTenantDb } from '../lib/db/tenantSession.js';
import { ensureLoyaltyProgram } from './loyalty.js';
import { logger } from '../lib/logger.js';

/**
 * Generate a unique referral code for a customer.
 */
export async function generateReferralCode(salonId: string, customerId: string) {
  const db = getTenantDb();

  const existing = await db.referralCode.findFirst({
    where: { salonId, customerId, active: true },
  });
  if (existing) return existing;

  const code = `REF-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

  return db.referralCode.create({
    data: {
      salonId,
      customerId,
      code,
      rewardStamps: 1,
    },
  });
}

/**
 * Redeem a referral code for a new customer.
 * Awards stamps to both the referrer and the referee.
 */
export async function redeemReferralCode(params: {
  salonId: string;
  code: string;
  referredCustomerId: string;
}) {
  const db = getTenantDb();

  const referral = await db.referralCode.findFirst({
    where: { code: params.code, salonId: params.salonId, active: true },
  });

  if (!referral) return { success: false, error: 'invalid_code' };
  if (referral.customerId === params.referredCustomerId) {
    return { success: false, error: 'self_referral' };
  }
  if (referral.maxUses > 0 && referral.usageCount >= referral.maxUses) {
    return { success: false, error: 'max_uses_reached' };
  }

  const existingRedemption = await db.referralRedemption.findFirst({
    where: { referralCodeId: referral.id, referredCustomerId: params.referredCustomerId },
  });
  if (existingRedemption) return { success: false, error: 'already_redeemed' };

  // Record the redemption
  await db.referralRedemption.create({
    data: { referralCodeId: referral.id, referredCustomerId: params.referredCustomerId },
  });

  // Increment usage
  await db.referralCode.update({
    where: { id: referral.id },
    data: { usageCount: { increment: 1 } },
  });

  // Award stamps to referrer
  const program = await ensureLoyaltyProgram(params.salonId);
  await db.loyaltyLedger.create({
    data: {
      programId: program.id,
      customerId: referral.customerId,
      delta: referral.rewardStamps,
      reason: `Referral reward (${params.code})`,
    },
  });

  // Award stamps to referee
  await db.loyaltyLedger.create({
    data: {
      programId: program.id,
      customerId: params.referredCustomerId,
      delta: 1,
      reason: `Welcome bonus (referred by ${params.code})`,
    },
  });

  logger.info({ code: params.code, referrer: referral.customerId, referee: params.referredCustomerId }, 'referral_redeemed');

  return { success: true };
}

/**
 * Determine the customer's loyalty tier based on lifetime visits.
 */
export async function getCustomerTier(salonId: string, customerId: string) {
  const db = getTenantDb();

  const visitCount = await db.appointment.count({
    where: { salonId, customerId, status: 'COMPLETED' },
  });

  const tiers = await db.loyaltyTier.findMany({
    where: { salonId },
    orderBy: { minVisits: 'desc' },
  });

  const currentTier = tiers.find((t) => visitCount >= t.minVisits) ?? null;

  return {
    visitCount,
    tier: currentTier,
    nextTier: tiers.find((t) => t.minVisits > visitCount) ?? null,
    visitsToNext: currentTier
      ? (tiers.find((t) => t.minVisits > visitCount)?.minVisits ?? visitCount) - visitCount
      : (tiers[tiers.length - 1]?.minVisits ?? 0) - visitCount,
  };
}

/**
 * Check for milestone rewards (e.g. every 10th visit).
 */
export async function checkMilestoneReward(salonId: string, customerId: string) {
  const db = getTenantDb();

  const visitCount = await db.appointment.count({
    where: { salonId, customerId, status: 'COMPLETED' },
  });

  // Milestone every 10 visits
  if (visitCount > 0 && visitCount % 10 === 0) {
    const existingReward = await db.loyaltyLedger.findFirst({
      where: {
        customerId,
        reason: `Milestone: ${visitCount} visits`,
      },
    });

    if (!existingReward) {
      const program = await ensureLoyaltyProgram(salonId);
      await db.loyaltyLedger.create({
        data: {
          programId: program.id,
          customerId,
          delta: 5,
          reason: `Milestone: ${visitCount} visits`,
        },
      });
      return { milestone: true, visits: visitCount, stampsAwarded: 5 };
    }
  }

  return { milestone: false, visits: visitCount };
}

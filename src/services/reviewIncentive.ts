import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import { getTenantDb } from '../lib/db/tenantSession.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { parseAutomationsFromMetadata } from '../lib/automationSettings.js';

const APP_BASE =
  process.env.APP_PUBLIC_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.marineflow.co.za';

export const REVIEW_CLAIM_EXPIRY_DAYS = 30;
export const REVIEW_TOKEN_RE = /^RVW-[A-F0-9]{8}$/;

export function formatReviewReward(cents: number): string {
  if (!Number.isFinite(cents) || cents <= 0) return 'R0';
  return `R${Math.round(cents / 100)}`;
}

export function normalizeReviewToken(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const token = raw.trim().toUpperCase();
  return REVIEW_TOKEN_RE.test(token) ? token : null;
}

/** Strict parse — avoids false positives like "reviewed my haircut". */
export function parseReviewClaimCommand(
  text: string,
): { kind: 'reviewed'; token?: string } | { kind: 'token_only'; token: string } | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const tokenOnly = normalizeReviewToken(trimmed);
  if (tokenOnly) return { kind: 'token_only', token: tokenOnly };

  const reviewedMatch = trimmed.match(/^reviewed(?:\s+(RVW-[A-F0-9]{8}))?\s*$/i);
  if (reviewedMatch) {
    const token = normalizeReviewToken(reviewedMatch[1]);
    return token ? { kind: 'reviewed', token } : { kind: 'reviewed' };
  }

  return null;
}

export function isValidGoogleReviewUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  const trimmed = url.trim();
  return trimmed.startsWith('https://') && trimmed.length <= 2048;
}

export function resolveGoogleReviewSettings(metadata: unknown): {
  enabled: boolean;
  incentiveEnabled: boolean;
  incentiveCents: number;
} {
  const automations = parseAutomationsFromMetadata(metadata);
  return {
    enabled: automations.googleReview.enabled,
    incentiveEnabled: automations.googleReview.incentiveEnabled,
    incentiveCents: automations.googleReview.incentiveCents,
  };
}

export function shouldSendGoogleReviewFollowUp(params: {
  googleReviewUrl: string | null | undefined;
  googleReviewEnabled: boolean;
  marketingConsentStatus?: string | null;
  reviewRequestSentAt?: Date | null;
}): boolean {
  if (!params.googleReviewEnabled) return false;
  if (!isValidGoogleReviewUrl(params.googleReviewUrl)) return false;
  if (params.reviewRequestSentAt) return false;
  if (params.marketingConsentStatus && params.marketingConsentStatus !== 'ACCEPTED') return false;
  return true;
}

export function buildReviewClaimUrl(token: string): string {
  return `${APP_BASE}/review-reward/${encodeURIComponent(token)}`;
}

function generateClaimToken(): string {
  return `RVW-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

export function buildWhatsAppClaimDeepLink(params: {
  twilioWhatsAppNumber: string | null | undefined;
  token: string;
}): string | null {
  const raw = params.twilioWhatsAppNumber?.replace(/^whatsapp:/i, '').trim();
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  const text = encodeURIComponent(`REVIEWED ${params.token}`);
  return `https://wa.me/${digits}?text=${text}`;
}

export function buildGoogleReviewFollowUpMessage(params: {
  googleReviewUrl: string;
  incentiveEnabled: boolean;
  incentiveCents: number;
  claimUrl?: string;
}): string {
  const safeUrl = params.googleReviewUrl.replace(/[*_~`[\]]/g, '');
  const reward = formatReviewReward(params.incentiveCents);

  if (params.incentiveEnabled && params.incentiveCents > 0 && params.claimUrl) {
    const safeClaim = params.claimUrl.replace(/[*_~`[\]]/g, '');
    return (
      `We'd love your honest feedback on Google — good or bad, it all helps us improve:\n${safeUrl}\n\n` +
      `Leave your review, then claim ${reward} off your next visit:\n${safeClaim}\n\n` +
      `Open the link above and tap "Claim on WhatsApp", or reply *REVIEWED* here after you've reviewed.`
    );
  }

  return (
    `We'd love your honest feedback on Google — good or bad, it all helps us improve:\n${safeUrl}`
  );
}

export async function getOrCreateReviewClaim(params: {
  salonId: string;
  customerId: string;
  appointmentId: string | null;
  rewardCents: number;
}): Promise<{ token: string; claimUrl: string; rewardCents: number; claimed: boolean; expired: boolean }> {
  const db = getTenantDb();
  const now = new Date();
  const rewardCents = Math.max(0, Math.round(params.rewardCents));

  if (params.appointmentId) {
    const existing = await db.reviewIncentiveClaim.findFirst({
      where: { appointmentId: params.appointmentId, customerId: params.customerId },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) {
      if (!existing.claimedAt && existing.rewardCents !== rewardCents && rewardCents > 0) {
        await db.reviewIncentiveClaim.update({
          where: { id: existing.id },
          data: { rewardCents },
        });
        existing.rewardCents = rewardCents;
      }
      return {
        token: existing.token,
        claimUrl: buildReviewClaimUrl(existing.token),
        rewardCents: existing.rewardCents,
        claimed: existing.claimedAt != null,
        expired: existing.expiresAt <= now,
      };
    }
  }

  const expiresAt = new Date(now.getTime() + REVIEW_CLAIM_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  for (let attempt = 0; attempt < 5; attempt++) {
    const token = generateClaimToken();
    try {
      const claim = await db.reviewIncentiveClaim.create({
        data: {
          salonId: params.salonId,
          customerId: params.customerId,
          appointmentId: params.appointmentId,
          token,
          rewardCents,
          expiresAt,
        },
      });
      return {
        token: claim.token,
        claimUrl: buildReviewClaimUrl(claim.token),
        rewardCents: claim.rewardCents,
        claimed: false,
        expired: false,
      };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2002') {
          const target = (err.meta?.target as string[] | undefined) ?? [];
          if (target.includes('appointmentId') && params.appointmentId) {
            const raced = await db.reviewIncentiveClaim.findFirst({
              where: { appointmentId: params.appointmentId, customerId: params.customerId },
            });
            if (raced) {
              return {
                token: raced.token,
                claimUrl: buildReviewClaimUrl(raced.token),
                rewardCents: raced.rewardCents,
                claimed: raced.claimedAt != null,
                expired: raced.expiresAt <= now,
              };
            }
          }
          continue;
        }
      }
      throw err;
    }
  }

  throw new Error('review_claim_token_collision');
}

export type ClaimReviewResult =
  | { ok: true; rewardCents: number; alreadyClaimed: boolean }
  | { ok: false; reason: 'not_found' | 'wrong_customer' | 'expired' | 'no_pending' | 'invalid_token' };

export async function claimReviewIncentive(params: {
  salonId: string;
  customerId: string;
  token?: string;
}): Promise<ClaimReviewResult> {
  const db = getTenantDb();
  const now = new Date();
  const normalizedToken = params.token ? normalizeReviewToken(params.token) : null;

  if (params.token && !normalizedToken) {
    return { ok: false, reason: 'invalid_token' };
  }

  let claim = normalizedToken
    ? await db.reviewIncentiveClaim.findUnique({ where: { token: normalizedToken } })
    : await db.reviewIncentiveClaim.findFirst({
        where: {
          salonId: params.salonId,
          customerId: params.customerId,
          claimedAt: null,
          expiresAt: { gt: now },
        },
        orderBy: { createdAt: 'desc' },
      });

  if (!claim) {
    return { ok: false, reason: normalizedToken ? 'not_found' : 'no_pending' };
  }
  if (claim.salonId !== params.salonId || claim.customerId !== params.customerId) {
    return { ok: false, reason: 'wrong_customer' };
  }
  if (claim.expiresAt <= now) {
    return { ok: false, reason: 'expired' };
  }
  if (claim.claimedAt) {
    return { ok: true, rewardCents: claim.rewardCents, alreadyClaimed: true };
  }

  let credited = false;
  await prisma.$transaction(async (tx) => {
    const updated = await tx.reviewIncentiveClaim.updateMany({
      where: { id: claim!.id, claimedAt: null, expiresAt: { gt: now } },
      data: { claimedAt: now },
    });
    if (updated.count === 0) {
      const fresh = await tx.reviewIncentiveClaim.findUnique({ where: { id: claim!.id } });
      if (fresh?.claimedAt) {
        claim = fresh;
      }
      return;
    }

    await tx.customer.update({
      where: { id: params.customerId },
      data: { reviewCreditCents: { increment: claim!.rewardCents } },
    });
    await tx.analyticsEvent.create({
      data: {
        salonId: params.salonId,
        customerId: params.customerId,
        appointmentId: claim!.appointmentId,
        type: 'review_incentive_claimed',
        payload: { token: claim!.token, rewardCents: claim!.rewardCents },
      },
    });
    credited = true;
  });

  if (!credited) {
    return { ok: true, rewardCents: claim.rewardCents, alreadyClaimed: true };
  }

  return { ok: true, rewardCents: claim.rewardCents, alreadyClaimed: false };
}

export async function applyReviewCreditTx(
  tx: Prisma.TransactionClient,
  params: {
    customerId: string;
    servicePriceCents: number;
    atVisitOnly?: boolean;
  },
): Promise<{ appliedCents: number; note: string | null }> {
  const customer = await tx.customer.findUnique({
    where: { id: params.customerId },
    select: { reviewCreditCents: true },
  });
  if (!customer || customer.reviewCreditCents <= 0) {
    return { appliedCents: 0, note: null };
  }

  const price = Math.max(0, Math.round(params.servicePriceCents));
  const applied = Math.min(customer.reviewCreditCents, price);
  if (applied <= 0) {
    return { appliedCents: 0, note: null };
  }

  const decremented = await tx.customer.updateMany({
    where: { id: params.customerId, reviewCreditCents: { gte: applied } },
    data: { reviewCreditCents: { decrement: applied } },
  });
  if (decremented.count === 0) {
    return { appliedCents: 0, note: null };
  }

  const reward = formatReviewReward(applied);
  const note = params.atVisitOnly
    ? `🎁 ${reward} review reward saved — comes off your service total at your visit!`
    : `🎁 ${reward} review reward applied to this booking!`;

  return { appliedCents: applied, note };
}

export async function getPublicReviewClaimInfo(token: string) {
  const normalized = normalizeReviewToken(token);
  if (!normalized) {
    return { status: 'invalid' as const };
  }

  const claim = await prisma.reviewIncentiveClaim.findUnique({
    where: { token: normalized },
    include: {
      salon: {
        select: {
          name: true,
          tradingName: true,
          twilioWhatsAppNumber: true,
          deletedAt: true,
          status: true,
        },
      },
      customer: { select: { deletedAt: true } },
    },
  });

  if (!claim || claim.salon.deletedAt || claim.customer.deletedAt) {
    return { status: 'invalid' as const };
  }

  const salonName = (claim.salon.tradingName ?? claim.salon.name).replace(/[<>&]/g, '');
  const rewardLabel = formatReviewReward(claim.rewardCents);
  const now = new Date();

  if (claim.claimedAt) {
    return {
      status: 'claimed' as const,
      salonName,
      rewardLabel,
      token: claim.token,
    };
  }
  if (claim.expiresAt <= now) {
    return {
      status: 'expired' as const,
      salonName,
      rewardLabel,
      token: claim.token,
    };
  }

  return {
    status: 'pending' as const,
    salonName,
    rewardLabel,
    token: claim.token,
    whatsAppDeepLink: buildWhatsAppClaimDeepLink({
      twilioWhatsAppNumber: claim.salon.twilioWhatsAppNumber,
      token: claim.token,
    }),
  };
}

export async function prepareGoogleReviewFollowUp(params: {
  salonId: string;
  customerId: string;
  appointmentId: string | null;
  googleReviewUrl: string;
  incentiveEnabled: boolean;
  incentiveCents: number;
}): Promise<{ body: string; claimUrl?: string }> {
  const url = params.googleReviewUrl.trim();
  let claimUrl: string | undefined;

  if (params.incentiveEnabled && params.incentiveCents > 0) {
    const claim = await getOrCreateReviewClaim({
      salonId: params.salonId,
      customerId: params.customerId,
      appointmentId: params.appointmentId,
      rewardCents: params.incentiveCents,
    });
    claimUrl = claim.claimUrl;
  }

  const body = buildGoogleReviewFollowUpMessage({
    googleReviewUrl: url,
    incentiveEnabled: params.incentiveEnabled,
    incentiveCents: params.incentiveCents,
    claimUrl,
  });

  return { body, claimUrl };
}

export async function sendGoogleReviewFollowUp(params: {
  salonId: string;
  customerId: string;
  appointmentId: string | null;
  googleReviewUrl: string;
  googleReviewEnabled: boolean;
  incentiveEnabled: boolean;
  incentiveCents: number;
  marketingConsentStatus?: string | null;
  reviewRequestSentAt?: Date | null;
  reply: (body: string) => Promise<void>;
}): Promise<boolean> {
  if (
    !shouldSendGoogleReviewFollowUp({
      googleReviewUrl: params.googleReviewUrl,
      googleReviewEnabled: params.googleReviewEnabled,
      marketingConsentStatus: params.marketingConsentStatus,
      reviewRequestSentAt: params.reviewRequestSentAt,
    })
  ) {
    return false;
  }

  try {
    const { body } = await prepareGoogleReviewFollowUp({
      salonId: params.salonId,
      customerId: params.customerId,
      appointmentId: params.appointmentId,
      googleReviewUrl: params.googleReviewUrl.trim(),
      incentiveEnabled: params.incentiveEnabled,
      incentiveCents: params.incentiveCents,
    });

    await params.reply(body);

    if (params.appointmentId) {
      await getTenantDb().appointment.updateMany({
        where: { id: params.appointmentId, reviewRequestSentAt: null },
        data: { reviewRequestSentAt: new Date() },
      });
    }

    await getTenantDb().analyticsEvent.create({
      data: {
        salonId: params.salonId,
        customerId: params.customerId,
        appointmentId: params.appointmentId,
        type: 'google_review_follow_up_sent',
        payload: { source: 'csat' },
      },
    });

    return true;
  } catch (err) {
    logger.warn({ err, salonId: params.salonId, customerId: params.customerId }, 'review_follow_up_failed');
    return false;
  }
}

export function reviewedClaimErrorMessage(
  reason: Extract<ClaimReviewResult, { ok: false }>['reason'],
): string {
  switch (reason) {
    case 'invalid_token':
      return 'That reward code format is invalid. Use the full link we sent you.';
    case 'not_found':
      return 'That reward link is invalid. Check the link we sent you and try again.';
    case 'wrong_customer':
      return 'That reward link belongs to another customer.';
    case 'expired':
      return 'That review reward has expired. Reply 0 if you need help.';
    case 'no_pending':
      return 'We could not find a pending review reward for you. Leave a review using the link we sent, then try again.';
  }
}

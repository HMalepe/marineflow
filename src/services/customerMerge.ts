import type { Conversation, Customer, Prisma } from '@prisma/client';
import type { PrismaTx } from '../lib/db/tenantSession.js';

type CustomerRow = Pick<
  Customer,
  | 'id'
  | 'salonId'
  | 'waId'
  | 'firstName'
  | 'lastName'
  | 'displayName'
  | 'email'
  | 'noShowCount'
  | 'bookingCount'
  | 'reviewCreditCents'
  | 'loyaltyStampsCached'
  | 'marketingConsent'
  | 'marketingConsentStatus'
  | 'marketingConsentAt'
  | 'tags'
  | 'notes'
  | 'preferredStaffId'
  | 'dateOfBirth'
  | 'lastInteractionAt'
>;

function normalizeWaId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed.startsWith('+') ? trimmed : `+${trimmed}`;
}

function pickNewer(a: Date | null | undefined, b: Date | null | undefined): Date | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return a > b ? a : b;
}

function pickMarketingStatus(
  a: Customer['marketingConsentStatus'],
  b: Customer['marketingConsentStatus'],
): Customer['marketingConsentStatus'] {
  const rank: Record<Customer['marketingConsentStatus'], number> = {
    ACCEPTED: 3,
    PENDING: 2,
    DECLINED: 1,
  };
  return rank[a] >= rank[b] ? a : b;
}

function pickConversationStep(
  primary: Conversation,
  secondary: Conversation,
): Conversation['step'] {
  if (primary.step === 'HANDOFF' || secondary.step === 'HANDOFF') return 'HANDOFF';
  const primaryAt = primary.lastMessageAt?.getTime() ?? 0;
  const secondaryAt = secondary.lastMessageAt?.getTime() ?? 0;
  return secondaryAt > primaryAt ? secondary.step : primary.step;
}

function pickConversationContext(primary: Conversation, secondary: Conversation): Prisma.InputJsonValue {
  const primaryAt = primary.lastMessageAt?.getTime() ?? 0;
  const secondaryAt = secondary.lastMessageAt?.getTime() ?? 0;
  const winner = secondaryAt > primaryAt ? secondary.context : primary.context;
  return (winner ?? {}) as Prisma.InputJsonValue;
}

async function mergeConversations(
  db: PrismaTx,
  salonId: string,
  primaryId: string,
  secondaryId: string,
): Promise<void> {
  const [primaryConv, secondaryConv] = await Promise.all([
    db.conversation.findUnique({
      where: { salonId_customerId: { salonId, customerId: primaryId } },
    }),
    db.conversation.findUnique({
      where: { salonId_customerId: { salonId, customerId: secondaryId } },
    }),
  ]);

  if (!secondaryConv) {
    await db.message.updateMany({
      where: { customerId: secondaryId },
      data: { customerId: primaryId },
    });
    return;
  }

  if (!primaryConv) {
    await db.conversation.update({
      where: { id: secondaryConv.id },
      data: { customerId: primaryId },
    });
    await db.message.updateMany({
      where: { customerId: secondaryId },
      data: { customerId: primaryId },
    });
    return;
  }

  await db.message.updateMany({
    where: { conversationId: secondaryConv.id },
    data: { conversationId: primaryConv.id, customerId: primaryId },
  });
  await db.message.updateMany({
    where: { customerId: secondaryId },
    data: { customerId: primaryId },
  });

  await db.conversation.update({
    where: { id: primaryConv.id },
    data: {
      step: pickConversationStep(primaryConv, secondaryConv),
      context: pickConversationContext(primaryConv, secondaryConv),
      lastMessageAt: pickNewer(primaryConv.lastMessageAt, secondaryConv.lastMessageAt),
      lastCustomerMessageAt: pickNewer(
        primaryConv.lastCustomerMessageAt,
        secondaryConv.lastCustomerMessageAt,
      ),
      resolvedAt: pickNewer(primaryConv.resolvedAt, secondaryConv.resolvedAt),
      endedAt: pickNewer(primaryConv.endedAt, secondaryConv.endedAt),
      handoffReason: primaryConv.handoffReason ?? secondaryConv.handoffReason,
      messageCount: primaryConv.messageCount + secondaryConv.messageCount,
    },
  });

  await db.conversation.delete({ where: { id: secondaryConv.id } });
}

async function reassignWithoutConflict(
  db: PrismaTx,
  table: 'campaignRecipient' | 'pushToken',
  primaryId: string,
  secondaryId: string,
): Promise<void> {
  if (table === 'campaignRecipient') {
    const rows = await db.campaignRecipient.findMany({ where: { customerId: secondaryId } });
    for (const row of rows) {
      const existing = await db.campaignRecipient.findUnique({
        where: { campaignId_customerId: { campaignId: row.campaignId, customerId: primaryId } },
      });
      if (existing) {
        await db.campaignRecipient.delete({ where: { id: row.id } });
      } else {
        await db.campaignRecipient.update({
          where: { id: row.id },
          data: { customerId: primaryId },
        });
      }
    }
    return;
  }

  const rows = await db.pushToken.findMany({ where: { customerId: secondaryId } });
  for (const row of rows) {
    const existing = await db.pushToken.findUnique({
      where: { customerId_token: { customerId: primaryId, token: row.token } },
    });
    if (existing) {
      await db.pushToken.delete({ where: { id: row.id } });
    } else {
      await db.pushToken.update({
        where: { id: row.id },
        data: { customerId: primaryId },
      });
    }
  }
}

/** Merge `secondary` into `primary` (same salon). Soft-deletes secondary. */
export async function mergeCustomers(
  db: PrismaTx,
  primary: CustomerRow,
  secondary: CustomerRow,
): Promise<{ primaryId: string }> {
  if (primary.id === secondary.id) {
    throw new Error('Cannot merge a customer with itself.');
  }
  if (primary.salonId !== secondary.salonId) {
    throw new Error('Customers belong to different businesses.');
  }

  const salonId = primary.salonId;
  const primaryId = primary.id;
  const secondaryId = secondary.id;

  await mergeConversations(db, salonId, primaryId, secondaryId);

  await db.appointment.updateMany({ where: { customerId: secondaryId }, data: { customerId: primaryId } });
  await db.ticket.updateMany({ where: { customerId: secondaryId }, data: { customerId: primaryId } });
  await db.payment.updateMany({ where: { customerId: secondaryId }, data: { customerId: primaryId } });
  await db.invoice.updateMany({ where: { customerId: secondaryId }, data: { customerId: primaryId } });
  await db.loyaltyLedger.updateMany({ where: { customerId: secondaryId }, data: { customerId: primaryId } });
  await db.analyticsEvent.updateMany({ where: { customerId: secondaryId }, data: { customerId: primaryId } });
  await db.consentRecord.updateMany({ where: { customerId: secondaryId }, data: { customerId: primaryId } });
  await db.waitlistEntry.updateMany({ where: { customerId: secondaryId }, data: { customerId: primaryId } });
  await db.referralCode.updateMany({ where: { customerId: secondaryId }, data: { customerId: primaryId } });
  await db.reviewIncentiveClaim.updateMany({
    where: { customerId: secondaryId },
    data: { customerId: primaryId },
  });
  await db.customerMembership.updateMany({
    where: { customerId: secondaryId },
    data: { customerId: primaryId },
  });

  await reassignWithoutConflict(db, 'campaignRecipient', primaryId, secondaryId);
  await reassignWithoutConflict(db, 'pushToken', primaryId, secondaryId);

  const mergedWaId = normalizeWaId(primary.waId) ?? normalizeWaId(secondary.waId);
  const mergedTags = [...new Set([...(primary.tags ?? []), ...(secondary.tags ?? [])])];
  const mergedNotes = [primary.notes, secondary.notes].filter(Boolean).join('\n---\n') || null;

  // Free unique waId slot before updating the kept profile.
  await db.customer.update({
    where: { id: secondaryId },
    data: {
      waId: `merged_${secondaryId.slice(0, 12)}`,
      deletedAt: new Date(),
    },
  });

  await db.customer.update({
    where: { id: primaryId },
    data: {
      firstName: primary.firstName || secondary.firstName || null,
      lastName: primary.lastName || secondary.lastName || null,
      displayName: primary.displayName || secondary.displayName || null,
      email: primary.email || secondary.email || null,
      dateOfBirth: primary.dateOfBirth ?? secondary.dateOfBirth ?? null,
      preferredStaffId: primary.preferredStaffId ?? secondary.preferredStaffId ?? null,
      waId: mergedWaId ?? primary.waId,
      noShowCount: primary.noShowCount + secondary.noShowCount,
      bookingCount: primary.bookingCount + secondary.bookingCount,
      reviewCreditCents: (primary.reviewCreditCents ?? 0) + (secondary.reviewCreditCents ?? 0),
      loyaltyStampsCached:
        primary.loyaltyStampsCached != null || secondary.loyaltyStampsCached != null
          ? (primary.loyaltyStampsCached ?? 0) + (secondary.loyaltyStampsCached ?? 0)
          : null,
      marketingConsent: primary.marketingConsent || secondary.marketingConsent,
      marketingConsentStatus: pickMarketingStatus(
        primary.marketingConsentStatus,
        secondary.marketingConsentStatus,
      ),
      marketingConsentAt: pickNewer(primary.marketingConsentAt, secondary.marketingConsentAt),
      lastInteractionAt: pickNewer(primary.lastInteractionAt, secondary.lastInteractionAt),
      tags: mergedTags,
      notes: mergedNotes,
    },
  });

  return { primaryId };
}

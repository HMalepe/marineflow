import type { PrismaTx } from '../lib/db/tenantSession.js';
import { getTenantDb, withTenantContext } from '../lib/db/tenantSession.js';
import { prisma } from '../lib/prisma.js';
import { env, isTwilioAccountConfigured } from '../config.js';
import { logger } from '../lib/logger.js';
import { sendWhatsAppReplyWithStatusCallback } from '../lib/twilio.js';
import { normalizeTwilioWhatsAppFrom } from '../lib/salonDefaults.js';
import { sendWithFallback } from './channelRouter.js';
import type { CampaignMediaType } from './campaigns.js';

const BOOKING_WINDOW_MS = 24 * 60 * 60 * 1000;
const REPLY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export type CampaignSendStats = {
  sentAt: string;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  repliedCount: number;
  bookedCount: number;
};

function twilioStatusCallbackUrl(): string | null {
  const base = env.TWILIO_WEBHOOK_BASE_URL?.trim();
  if (!base) return null;
  return `${base.replace(/\/$/, '')}/webhooks/twilio/status`;
}

export async function createCampaignSend(
  db: PrismaTx,
  params: { campaignId: string; salonId: string; sentAt: Date; sentCount: number },
): Promise<string> {
  const row = await db.campaignSend.create({
    data: {
      campaignId: params.campaignId,
      salonId: params.salonId,
      sentAt: params.sentAt,
      sentCount: params.sentCount,
    },
  });
  return row.id;
}

export async function sendCampaignOutbound(params: {
  salonId: string;
  campaignId: string;
  campaignSendId: string;
  customerId: string;
  to: string;
  body: string;
  mediaUrl?: string;
  mediaType?: CampaignMediaType;
}): Promise<{ sent: boolean; usesStatusCallback: boolean }> {
  const db = getTenantDb();
  const salon = await db.salon.findUniqueOrThrow({
    where: { id: params.salonId },
    select: { twilioWhatsAppFrom: true },
  });

  const twilioFrom =
    normalizeTwilioWhatsAppFrom(salon.twilioWhatsAppFrom?.trim() || env.TWILIO_WHATSAPP_FROM?.trim() || '') ||
    null;
  const statusCallback = twilioStatusCallbackUrl();

  let providerSid: string | null = null;
  let sent = false;
  let usesStatusCallback = false;

  if (isTwilioAccountConfigured() && twilioFrom && statusCallback) {
    providerSid = await sendWhatsAppReplyWithStatusCallback({
      toWaId: params.to,
      body: params.body,
      mediaUrl: params.mediaUrl,
      twilioFrom,
      statusCallback,
    });
    sent = Boolean(providerSid);
    usesStatusCallback = sent;
  }

  if (!sent) {
    const { result } = await sendWithFallback({
      salonId: params.salonId,
      to: params.to,
      body: params.body,
      mediaUrl: params.mediaUrl,
      mediaType: params.mediaType,
    });
    providerSid = result.providerMessageId;
    sent = Boolean(providerSid);
  }

  const recipient = await db.campaignRecipient.create({
    data: {
      campaignSendId: params.campaignSendId,
      campaignId: params.campaignId,
      salonId: params.salonId,
      customerId: params.customerId,
      providerSid,
      delivered: sent && !usesStatusCallback,
    },
  });

  if (sent && !usesStatusCallback) {
    await db.campaignSend.update({
      where: { id: params.campaignSendId },
      data: { deliveredCount: { increment: 1 } },
    });
  }

  if (!sent) {
    logger.warn({ recipientId: recipient.id, campaignId: params.campaignId }, 'campaign_recipient_send_failed');
  }

  return { sent, usesStatusCallback };
}

export async function applyTwilioCampaignStatus(
  providerSid: string,
  messageStatus: string,
): Promise<void> {
  const status = messageStatus.toLowerCase();
  if (status !== 'delivered' && status !== 'read') return;

  const recipient = await prisma.campaignRecipient.findUnique({
    where: { providerSid },
    select: { id: true, campaignSendId: true, delivered: true, read: true, salonId: true },
  });
  if (!recipient) return;

  await withTenantContext(recipient.salonId, async () => {
    const db = getTenantDb();
    const fresh = await db.campaignRecipient.findUniqueOrThrow({
      where: { id: recipient.id },
      select: { delivered: true, read: true, campaignSendId: true },
    });

    if (status === 'delivered' && !fresh.delivered) {
      await db.campaignRecipient.update({
        where: { id: recipient.id },
        data: { delivered: true },
      });
      await db.campaignSend.update({
        where: { id: fresh.campaignSendId },
        data: { deliveredCount: { increment: 1 } },
      });
      return;
    }

    if (status === 'read' && !fresh.read) {
      await db.campaignRecipient.update({
        where: { id: recipient.id },
        data: { read: true, delivered: true },
      });
      await db.campaignSend.update({
        where: { id: fresh.campaignSendId },
        data: { readCount: { increment: 1 } },
      });
      if (!fresh.delivered) {
        await db.campaignSend.update({
          where: { id: fresh.campaignSendId },
          data: { deliveredCount: { increment: 1 } },
        });
      }
    }
  });
}

export async function recordCampaignReply(salonId: string, customerId: string): Promise<void> {
  const since = new Date(Date.now() - REPLY_WINDOW_MS);
  const db = getTenantDb();

  const recipient = await db.campaignRecipient.findFirst({
    where: {
      salonId,
      customerId,
      replied: false,
      campaignSend: { sentAt: { gte: since } },
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, campaignSendId: true },
  });
  if (!recipient) return;

  await db.campaignRecipient.update({
    where: { id: recipient.id },
    data: { replied: true },
  });
  await db.campaignSend.update({
    where: { id: recipient.campaignSendId },
    data: { repliedCount: { increment: 1 } },
  });
}

export async function refreshCampaignBookedCount(campaignSendId: string): Promise<number> {
  const db = getTenantDb();
  const send = await db.campaignSend.findUniqueOrThrow({
    where: { id: campaignSendId },
    select: { id: true, salonId: true, sentAt: true },
  });

  const windowEnd = new Date(send.sentAt.getTime() + BOOKING_WINDOW_MS);
  const recipients = await db.campaignRecipient.findMany({
    where: { campaignSendId: send.id, booked: false },
    select: { id: true, customerId: true },
  });
  if (recipients.length === 0) {
    const current = await db.campaignSend.findUniqueOrThrow({
      where: { id: send.id },
      select: { bookedCount: true },
    });
    return current.bookedCount;
  }

  const customerIds = recipients.map((r) => r.customerId);
  const bookedRows = await db.appointment.findMany({
    where: {
      salonId: send.salonId,
      customerId: { in: customerIds },
      createdAt: { gte: send.sentAt, lte: windowEnd },
      status: { notIn: ['CANCELLED'] },
    },
    distinct: ['customerId'],
    select: { customerId: true },
  });

  const bookedSet = new Set(bookedRows.map((r) => r.customerId));
  let newlyBooked = 0;

  for (const recipient of recipients) {
    if (!bookedSet.has(recipient.customerId)) continue;
    await db.campaignRecipient.update({
      where: { id: recipient.id },
      data: { booked: true },
    });
    newlyBooked++;
  }

  if (newlyBooked > 0) {
    await db.campaignSend.update({
      where: { id: send.id },
      data: { bookedCount: { increment: newlyBooked } },
    });
  }

  const updated = await db.campaignSend.findUniqueOrThrow({
    where: { id: send.id },
    select: { bookedCount: true },
  });
  return updated.bookedCount;
}

export function serializeCampaignSendStats(
  send: {
    sentAt: Date;
    sentCount: number;
    deliveredCount: number;
    readCount: number;
    repliedCount: number;
    bookedCount: number;
  } | null | undefined,
): CampaignSendStats | null {
  if (!send) return null;
  return {
    sentAt: send.sentAt.toISOString(),
    sentCount: send.sentCount,
    deliveredCount: send.deliveredCount,
    readCount: send.readCount,
    repliedCount: send.repliedCount,
    bookedCount: send.bookedCount,
  };
}

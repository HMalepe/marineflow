import { getTenantDb } from '../lib/db/tenantSession.js';
import { sendWithFallback } from './channelRouter.js';
import { logger } from '../lib/logger.js';
import type { CampaignStatus } from '@prisma/client';

interface AudienceFilter {
  tags?: string[];
  lastVisitBefore?: string;
  lastVisitAfter?: string;
  consentMarketing?: boolean;
}

/**
 * Create a campaign in DRAFT status.
 */
export async function createCampaign(params: {
  salonId: string;
  name: string;
  templateName: string;
  templateLang?: string;
  audienceFilter?: AudienceFilter;
  scheduledAt?: Date;
  createdBy?: string;
}) {
  const db = getTenantDb();
  const status: CampaignStatus = params.scheduledAt ? 'SCHEDULED' : 'DRAFT';

  return db.campaign.create({
    data: {
      salonId: params.salonId,
      name: params.name,
      templateName: params.templateName,
      templateLang: params.templateLang ?? 'en',
      audienceFilter: (params.audienceFilter ?? {}) as object,
      status,
      scheduledAt: params.scheduledAt,
      createdBy: params.createdBy,
    },
  });
}

/**
 * Build the audience list based on filters. Respects marketing consent.
 */
export async function buildAudience(salonId: string, filter: AudienceFilter) {
  const db = getTenantDb();

  const where: Record<string, unknown> = {
    salonId,
    marketingConsent: true,
    deletedAt: null,
    waId: { not: null },
  };

  if (filter.tags?.length) {
    where.tags = { hasSome: filter.tags };
  }

  if (filter.lastVisitBefore) {
    where.appointments = {
      none: { start: { gte: new Date(filter.lastVisitBefore) } },
    };
  }

  return db.customer.findMany({
    where,
    select: { id: true, waId: true, firstName: true, displayName: true },
  });
}

/**
 * Execute a campaign: send template messages to the audience.
 * Rate-limited to 50 messages per second (Meta WhatsApp limit).
 */
export async function executeCampaign(campaignId: string) {
  const db = getTenantDb();
  const campaign = await db.campaign.findUniqueOrThrow({
    where: { id: campaignId },
  });

  if (campaign.status !== 'DRAFT' && campaign.status !== 'SCHEDULED') {
    throw new Error(`Campaign ${campaignId} is in ${campaign.status} state`);
  }

  const filter = campaign.audienceFilter as AudienceFilter;
  const audience = await buildAudience(campaign.salonId, filter);

  await db.campaign.update({
    where: { id: campaignId },
    data: { status: 'SENDING', totalRecipients: audience.length, sentAt: new Date() },
  });

  let delivered = 0;
  let failed = 0;

  for (const customer of audience) {
    if (!customer.waId) continue;

    try {
      const { result } = await sendWithFallback({
        salonId: campaign.salonId,
        to: customer.waId,
        body: `Hi ${customer.firstName ?? customer.displayName ?? 'there'}! ${campaign.templateName}`,
      });

      if (result.providerMessageId) {
        delivered++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }

    // Rate limit: 50/sec → 20ms between sends
    await new Promise((r) => setTimeout(r, 20));
  }

  await db.campaign.update({
    where: { id: campaignId },
    data: { status: 'COMPLETED', delivered, failed },
  });

  logger.info({ campaignId, delivered, failed, total: audience.length }, 'campaign_completed');
  return { delivered, failed, total: audience.length };
}

/**
 * Get campaigns for dashboard display.
 */
export async function listCampaigns() {
  const db = getTenantDb();
  return db.campaign.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

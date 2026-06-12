import type { Campaign, CampaignStatus } from '@prisma/client';
import { getTenantDb } from '../lib/db/tenantSession.js';
import { inngest } from '../lib/inngest/client.js';
import { sendWithFallback } from './channelRouter.js';
import { logger } from '../lib/logger.js';

export type AudienceFilterType = 'all' | 'tags' | 'inactive';

export interface AudienceFilter {
  type?: AudienceFilterType;
  tags?: string[];
  /** Customers with no visit in the last N days */
  inactiveDays?: number;
  /** @deprecated legacy shape */
  lastVisitBefore?: string;
  lastVisitAfter?: string;
  consentMarketing?: boolean;
}

export type CampaignMediaType = 'image' | 'video';

export interface CampaignApiShape {
  id: string;
  name: string;
  message: string;
  mediaUrl: string | null;
  mediaType: CampaignMediaType | null;
  status: CampaignStatus;
  audienceFilter: AudienceFilter;
  scheduledAt: string | null;
  sentAt: string | null;
  totalRecipients: number;
  delivered: number;
  failed: number;
  createdAt: string;
  updatedAt: string;
}

function normalizeAudienceFilter(raw: AudienceFilter): AudienceFilter {
  const filter: AudienceFilter = { ...raw };
  if (!filter.type) {
    if (filter.tags?.length) filter.type = 'tags';
    else if (filter.inactiveDays || filter.lastVisitBefore) filter.type = 'inactive';
    else filter.type = 'all';
  }
  return filter;
}

function resolveLastVisitBefore(filter: AudienceFilter): Date | undefined {
  if (filter.inactiveDays && filter.inactiveDays > 0) {
    return new Date(Date.now() - filter.inactiveDays * 86_400_000);
  }
  if (filter.lastVisitBefore) return new Date(filter.lastVisitBefore);
  return undefined;
}

export function serializeCampaign(c: Campaign): CampaignApiShape {
  const mediaType =
    c.mediaType === 'image' || c.mediaType === 'video' ? c.mediaType : null;
  return {
    id: c.id,
    name: c.name,
    message: c.templateName,
    mediaUrl: c.mediaUrl ?? null,
    mediaType,
    status: c.status,
    audienceFilter: normalizeAudienceFilter((c.audienceFilter ?? {}) as AudienceFilter),
    scheduledAt: c.scheduledAt?.toISOString() ?? null,
    sentAt: c.sentAt?.toISOString() ?? null,
    totalRecipients: c.totalRecipients,
    delivered: c.delivered,
    failed: c.failed,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

export function parseCampaignMediaType(value: unknown): CampaignMediaType | null {
  if (value === 'image' || value === 'video') return value;
  return null;
}

/** WhatsApp requires a publicly reachable HTTPS URL for media attachments. */
export function validateCampaignMediaUrl(url: string): string | null {
  if (url.startsWith('data:image/') || url.startsWith('data:video/')) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return 'Media URL must use HTTPS.';
    if (!parsed.hostname) return 'Media URL is invalid.';
    return null;
  } catch {
    return 'Media URL is invalid.';
  }
}

export function validateCampaignMedia(
  mediaUrl: string | null | undefined,
  mediaType: CampaignMediaType | null | undefined,
): string | null {
  if (!mediaUrl && !mediaType) return null;
  if (mediaUrl && !mediaType) return 'Choose image or video for the attachment.';
  if (mediaType && !mediaUrl) return 'Upload media or remove the attachment type.';
  if (mediaUrl) return validateCampaignMediaUrl(mediaUrl);
  return null;
}

/** Recipients must exist before send-now or scheduled delivery — not for drafts. */
export function campaignRequiresAudience(params: {
  sendNow?: boolean;
  scheduledAt?: Date | null;
}): boolean {
  if (params.sendNow) return true;
  return params.scheduledAt != null;
}

/** Effective schedule after PATCH (undefined patch field = keep existing). */
export function resolveCampaignScheduleAfterPatch(
  existingScheduledAt: Date | null,
  scheduledAtPatch: Date | null | undefined,
): Date | null {
  if (scheduledAtPatch !== undefined) return scheduledAtPatch;
  return existingScheduledAt;
}

/**
 * Create a campaign in DRAFT or SCHEDULED status.
 */
export async function createCampaign(params: {
  salonId: string;
  name: string;
  message: string;
  templateLang?: string;
  mediaUrl?: string | null;
  mediaType?: CampaignMediaType | null;
  audienceFilter?: AudienceFilter;
  scheduledAt?: Date | null;
  createdBy?: string;
}) {
  const db = getTenantDb();
  const status: CampaignStatus = params.scheduledAt ? 'SCHEDULED' : 'DRAFT';

  return db.campaign.create({
    data: {
      salonId: params.salonId,
      name: params.name,
      templateName: params.message,
      templateLang: params.templateLang ?? 'en',
      mediaUrl: params.mediaUrl ?? undefined,
      mediaType: params.mediaType ?? undefined,
      audienceFilter: normalizeAudienceFilter(params.audienceFilter ?? { type: 'all' }) as object,
      status,
      scheduledAt: params.scheduledAt ?? undefined,
      createdBy: params.createdBy,
    },
  });
}

export async function updateCampaign(
  campaignId: string,
  params: {
    name?: string;
    message?: string;
    mediaUrl?: string | null;
    mediaType?: CampaignMediaType | null;
    audienceFilter?: AudienceFilter;
    scheduledAt?: Date | null;
  },
) {
  const db = getTenantDb();
  const existing = await db.campaign.findUniqueOrThrow({ where: { id: campaignId } });
  if (existing.status !== 'DRAFT' && existing.status !== 'SCHEDULED') {
    throw new Error('campaign_not_editable');
  }

  const data: Record<string, unknown> = {};
  if (params.name !== undefined) data.name = params.name;
  if (params.message !== undefined) data.templateName = params.message;
  if (params.mediaUrl !== undefined) data.mediaUrl = params.mediaUrl;
  if (params.mediaType !== undefined) data.mediaType = params.mediaType;
  if (params.audienceFilter !== undefined) {
    data.audienceFilter = normalizeAudienceFilter(params.audienceFilter) as object;
  }
  if (params.scheduledAt !== undefined) {
    data.scheduledAt = params.scheduledAt;
    data.status = params.scheduledAt ? 'SCHEDULED' : 'DRAFT';
  }

  return db.campaign.update({ where: { id: campaignId }, data });
}

export async function cancelCampaign(campaignId: string) {
  const db = getTenantDb();
  const existing = await db.campaign.findUniqueOrThrow({ where: { id: campaignId } });
  if (existing.status !== 'DRAFT' && existing.status !== 'SCHEDULED') {
    throw new Error('campaign_not_cancellable');
  }
  return db.campaign.update({
    where: { id: campaignId },
    data: { status: 'CANCELLED', scheduledAt: null },
  });
}

export async function queueCampaignSend(campaignId: string, salonId: string) {
  const db = getTenantDb();
  const existing = await db.campaign.findUniqueOrThrow({ where: { id: campaignId } });
  if (existing.status !== 'DRAFT' && existing.status !== 'SCHEDULED') {
    throw new Error('campaign_not_sendable');
  }

  await inngest.send({
    name: 'campaign/scheduled',
    data: { campaignId, salonId },
  });

  return { queued: true };
}

/**
 * Build the audience list based on filters. Respects marketing consent.
 */
export async function buildAudience(salonId: string, rawFilter: AudienceFilter) {
  const db = getTenantDb();
  const filter = normalizeAudienceFilter(rawFilter);

  const where: Record<string, unknown> = {
    salonId,
    marketingConsentStatus: 'ACCEPTED',
    deletedAt: null,
  };

  if (filter.type === 'tags' && filter.tags?.length) {
    where.tags = { hasSome: filter.tags };
  }

  const lastVisitBefore = filter.type === 'inactive' ? resolveLastVisitBefore(filter) : undefined;
  if (lastVisitBefore) {
    where.appointments = {
      none: { start: { gte: lastVisitBefore } },
    };
  }

  return db.customer.findMany({
    where,
    select: { id: true, waId: true, firstName: true, displayName: true },
  });
}

export async function countAudience(salonId: string, filter: AudienceFilter) {
  const audience = await buildAudience(salonId, filter);
  return audience.length;
}

export async function listCustomerTags(salonId: string): Promise<string[]> {
  const db = getTenantDb();
  const rows = await db.customer.findMany({
    where: { salonId, deletedAt: null },
    select: { tags: true },
  });
  const tags = new Set<string>();
  for (const row of rows) {
    for (const tag of row.tags) tags.add(tag);
  }
  return [...tags].sort((a, b) => a.localeCompare(b));
}

export async function countOptedInCustomers(salonId: string): Promise<number> {
  const db = getTenantDb();
  return db.customer.count({
    where: {
      salonId,
      marketingConsentStatus: 'ACCEPTED',
      deletedAt: null,
    },
  });
}

/**
 * Execute a campaign: send template messages to the audience.
 * Rate-limited to ~50 messages per second (Meta WhatsApp limit).
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
      const greeting = customer.firstName ?? customer.displayName ?? 'there';
      const personal = campaign.templateName.trim();
      const body = personal.includes(greeting)
        ? personal
        : personal
          ? `Hi ${greeting}! ${personal}`
          : `Hi ${greeting}!`;

      const mediaType = parseCampaignMediaType(campaign.mediaType) ?? undefined;

      const { result } = await sendWithFallback({
        salonId: campaign.salonId,
        to: customer.waId,
        body,
        mediaUrl: campaign.mediaUrl ?? undefined,
        mediaType,
      });

      if (result.providerMessageId) {
        delivered++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }

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
    take: 100,
  });
}

export async function getCampaign(campaignId: string) {
  const db = getTenantDb();
  return db.campaign.findFirst({ where: { id: campaignId } });
}

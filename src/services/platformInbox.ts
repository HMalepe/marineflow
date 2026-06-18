import type { PlatformAlertKind, PlatformAlertStatus, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { getIndustryTemplate } from '../lib/industryTemplates.js';

const BOT_ERROR_DEDUPE_MS = 5 * 60 * 1000;

export async function recordBotPlatformAlert(input: {
  salonId: string;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const since = new Date(Date.now() - BOT_ERROR_DEDUPE_MS);
  const duplicate = await prisma.platformAlert.findFirst({
    where: {
      salonId: input.salonId,
      kind: 'BOT_ERROR',
      title: input.title,
      createdAt: { gte: since },
    },
    select: { id: true },
  });
  if (duplicate) return;

  await prisma.platformAlert.create({
    data: {
      salonId: input.salonId,
      kind: 'BOT_ERROR',
      title: input.title.slice(0, 200),
      body: input.body.slice(0, 8000),
      metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
    },
  });
}

export async function createOwnerPlatformMessage(input: {
  salonId: string;
  staffUserId: string;
  subject: string;
  body: string;
}) {
  return prisma.platformAlert.create({
    data: {
      salonId: input.salonId,
      kind: 'OWNER_MESSAGE',
      title: input.subject.trim().slice(0, 200),
      body: input.body.trim().slice(0, 8000),
      createdByStaffUserId: input.staffUserId,
    },
    select: {
      id: true,
      title: true,
      createdAt: true,
    },
  });
}

export async function getPlatformInboxUnreadCount(): Promise<number> {
  return prisma.platformAlert.count({ where: { status: 'UNREAD' } });
}

export async function listPlatformInboxAlerts(input: {
  status?: PlatformAlertStatus;
  salonId?: string;
  limit?: number;
  offset?: number;
}) {
  const limit = Math.min(input.limit ?? 50, 100);
  const offset = input.offset ?? 0;
  const where = {
    ...(input.status && { status: input.status }),
    ...(input.salonId && { salonId: input.salonId }),
  };

  const [alerts, total] = await Promise.all([
    prisma.platformAlert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        salon: {
          select: {
            id: true,
            name: true,
            slug: true,
            industryTemplate: true,
            status: true,
          },
        },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.platformAlert.count({ where }),
  ]);

  return {
    alerts: alerts.map((a) => ({
      id: a.id,
      kind: a.kind,
      status: a.status,
      title: a.title,
      body: a.body,
      metadata: a.metadata,
      createdAt: a.createdAt.toISOString(),
      readAt: a.readAt?.toISOString() ?? null,
      business: {
        id: a.salon.id,
        name: a.salon.name,
        slug: a.salon.slug,
        industryTemplate: a.salon.industryTemplate,
        industryLabel: getIndustryTemplate(a.salon.industryTemplate).label,
        status: a.salon.status,
      },
      from: a.createdBy
        ? { name: a.createdBy.name, email: a.createdBy.email }
        : null,
    })),
    total,
  };
}

export async function listPlatformInboxByCategory() {
  const rows = await prisma.platformAlert.groupBy({
    by: ['salonId'],
    where: { status: 'UNREAD' },
    _count: { _all: true },
    _max: { createdAt: true },
  });

  if (rows.length === 0) {
    return { categories: [], totalUnread: 0 };
  }

  const salonIds = rows.map((r) => r.salonId);
  const salons = await prisma.salon.findMany({
    where: { id: { in: salonIds }, deletedAt: null },
    select: { id: true, name: true, slug: true, industryTemplate: true, status: true },
  });
  const countBySalon = new Map(rows.map((r) => [r.salonId, r._count._all]));
  const latestBySalon = new Map(rows.map((r) => [r.salonId, r._max.createdAt]));

  type BusinessSummary = {
    id: string;
    name: string;
    slug: string;
    status: string;
    unreadCount: number;
    latestAt: string | null;
  };

  const byIndustry = new Map<string, { label: string; businesses: BusinessSummary[] }>();

  for (const salon of salons) {
    const template = getIndustryTemplate(salon.industryTemplate);
    const entry = byIndustry.get(salon.industryTemplate) ?? {
      label: template.label,
      businesses: [],
    };
    entry.businesses.push({
      id: salon.id,
      name: salon.name,
      slug: salon.slug,
      status: salon.status,
      unreadCount: countBySalon.get(salon.id) ?? 0,
      latestAt: latestBySalon.get(salon.id)?.toISOString() ?? null,
    });
    byIndustry.set(salon.industryTemplate, entry);
  }

  const categories = [...byIndustry.entries()]
    .map(([industryTemplate, group]) => ({
      industryTemplate,
      label: group.label,
      businesses: group.businesses.sort((a, b) => b.unreadCount - a.unreadCount),
      unreadCount: group.businesses.reduce((sum, b) => sum + b.unreadCount, 0),
    }))
    .sort((a, b) => b.unreadCount - a.unreadCount);

  return {
    categories,
    totalUnread: rows.reduce((sum, r) => sum + r._count._all, 0),
  };
}

export async function updatePlatformAlertStatus(
  id: string,
  status: PlatformAlertStatus,
) {
  return prisma.platformAlert.update({
    where: { id },
    data: {
      status,
      readAt: status === 'READ' ? new Date() : undefined,
    },
  });
}

export async function listOwnerPlatformMessages(salonId: string) {
  const alerts = await prisma.platformAlert.findMany({
    where: { salonId, kind: 'OWNER_MESSAGE' },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      id: true,
      title: true,
      body: true,
      status: true,
      createdAt: true,
    },
  });
  return alerts.map((a) => ({
    ...a,
    createdAt: a.createdAt.toISOString(),
  }));
}

export type PlatformAlertKindExport = PlatformAlertKind;

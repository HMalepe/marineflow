import type { BusinessType } from '@prisma/client';
import { prisma } from '../../../lib/prisma.js';

export type TenantHealthStatus = 'HEALTHY' | 'AT_RISK' | 'CHURNING';

export type TenantHealthRow = {
  id: string;
  name: string;
  slug: string;
  botName: string;
  industryTemplate: string;
  businessType: BusinessType;
  tenantStatus: string;
  tier: string;
  plan: string;
  lastBotActivity: string | null;
  appointmentsLast30d: number;
  customerCount: number;
  staffUserCount: number;
  healthStatus: TenantHealthStatus;
};

export type AdminTenantHealthSummary = {
  tenants: TenantHealthRow[];
  atRiskCount: number;
  churningCount: number;
};

const MS_DAY = 24 * 60 * 60 * 1000;

export function computeTenantHealthStatus(input: {
  appointmentsLast30d: number;
  appointmentsLast14d: number;
  lastBotActivity: Date | null;
  now?: Date;
}): TenantHealthStatus {
  const now = input.now ?? new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * MS_DAY);

  if (input.appointmentsLast30d === 0) return 'CHURNING';
  if (input.appointmentsLast14d === 0) return 'AT_RISK';

  const botActiveRecently =
    input.lastBotActivity !== null && input.lastBotActivity >= sevenDaysAgo;

  if (input.appointmentsLast30d > 0 && botActiveRecently) return 'HEALTHY';
  return 'AT_RISK';
}

/** Per-tenant health — Salon + Appointment + MessageLog + subscription plan. */
export async function getAdminTenantHealth(): Promise<AdminTenantHealthSummary> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * MS_DAY);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * MS_DAY);

  const [salons, appts30Rows, appts14Rows, lastBotRows] = await Promise.all([
    prisma.salon.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        botName: true,
        industryTemplate: true,
        status: true,
        tier: true,
        businessType: true,
        subscription: { select: { plan: { select: { name: true } } } },
        _count: { select: { customers: true, staffUsers: true } },
      },
    }),
    prisma.appointment.groupBy({
      by: ['salonId'],
      where: { createdAt: { gte: thirtyDaysAgo } },
      _count: { id: true },
    }),
    prisma.appointment.groupBy({
      by: ['salonId'],
      where: { createdAt: { gte: fourteenDaysAgo } },
      _count: { id: true },
    }),
    prisma.$queryRaw<{ salonId: string; last_at: Date }[]>`
      SELECT "salonId", MAX("createdAt") AS last_at
      FROM "MessageLog"
      WHERE "salonId" IS NOT NULL
      GROUP BY "salonId"
    `,
  ]);

  const appts30 = new Map(appts30Rows.map((r) => [r.salonId, r._count.id]));
  const appts14 = new Map(appts14Rows.map((r) => [r.salonId, r._count.id]));
  const lastBot = new Map(lastBotRows.map((r) => [r.salonId, r.last_at]));

  let atRiskCount = 0;
  let churningCount = 0;

  const tenants: TenantHealthRow[] = salons.map((s) => {
    const appointmentsLast30d = appts30.get(s.id) ?? 0;
    const appointmentsLast14d = appts14.get(s.id) ?? 0;
    const lastBotActivity = lastBot.get(s.id) ?? null;
    const healthStatus = computeTenantHealthStatus({
      appointmentsLast30d,
      appointmentsLast14d,
      lastBotActivity,
      now,
    });

    if (healthStatus === 'AT_RISK') atRiskCount += 1;
    if (healthStatus === 'CHURNING') churningCount += 1;

    const plan =
      s.subscription?.plan?.name ??
      (s.tier ? s.tier.charAt(0).toUpperCase() + s.tier.slice(1) : 'Starter');

    return {
      id: s.id,
      name: s.name,
      slug: s.slug,
      botName: s.botName,
      industryTemplate: s.industryTemplate,
      businessType: s.businessType,
      tenantStatus: s.status,
      tier: s.tier,
      plan,
      lastBotActivity: lastBotActivity?.toISOString() ?? null,
      appointmentsLast30d,
      customerCount: s._count.customers,
      staffUserCount: s._count.staffUsers,
      healthStatus,
    };
  });

  return { tenants, atRiskCount, churningCount };
}

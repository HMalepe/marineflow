import { getTenantDb } from '../lib/db/tenantSession.js';
import { parseAutomationsFromMetadata } from '../lib/automationSettings.js';

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

export async function subscribeCustomerToPlan(params: {
  salonId: string;
  customerId: string;
  planId: string;
}) {
  const db = getTenantDb();
  const plan = await db.membershipPlan.findFirst({
    where: { id: params.planId, salonId: params.salonId, active: true },
  });
  if (!plan) return { error: 'plan_not_found' as const };

  const automations = parseAutomationsFromMetadata(
    (await db.salon.findUnique({ where: { id: params.salonId }, select: { metadata: true } }))
      ?.metadata,
  );
  if (!automations.membership.enabled) return { error: 'membership_disabled' as const };

  await db.customerMembership.updateMany({
    where: { salonId: params.salonId, customerId: params.customerId, active: true },
    data: { active: false },
  });

  const renewsAt = new Date();
  renewsAt.setMonth(renewsAt.getMonth() + 1);

  const membership = await db.customerMembership.create({
    data: {
      salonId: params.salonId,
      customerId: params.customerId,
      planId: plan.id,
      visitsRemaining: plan.visitsPerMonth,
      renewsAt,
    },
    include: { plan: true },
  });

  return { membership };
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
    const savings = p.savingsCents > 0 ? ` — save R${(p.savingsCents / 100).toFixed(0)}` : '';
    return `${i + 1}. ${p.name} — R${price}/mo (${p.visitsPerMonth} visits max)${savings}`;
  });
  return ['VIP Membership Plans:', ...lines, '', 'Reply with a number to join, or BACK.'].join('\n');
}

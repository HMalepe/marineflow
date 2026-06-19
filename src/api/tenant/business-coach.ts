import { DateTime } from 'luxon';
import type { PrismaTx } from '../../lib/db/tenantSession.js';
import { claudeJson, isAnthropicConfigured } from '../../lib/integrations/ai/claude.js';
import { getTenantOverviewKpis } from './overview-kpis.js';

export type CoachActionType =
  | 'draft_campaign'
  | 'open_roster'
  | 'open_services'
  | 'open_appointments'
  | 'open_customers';

export type CoachInsight = {
  id: string;
  headline: string;
  body: string;
  priority: 'high' | 'medium' | 'low';
  actionLabel: string;
  action: {
    type: CoachActionType;
    payload?: Record<string, unknown>;
  };
};

export type BusinessCoachResponse = {
  generatedAt: string;
  insights: CoachInsight[];
  aiPowered: boolean;
  cached: boolean;
};

type CoachCache = {
  date: string;
  insights: CoachInsight[];
};

const DOW_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function coachCacheFromMetadata(metadata: unknown): CoachCache | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const raw = (metadata as { businessCoach?: CoachCache }).businessCoach;
  if (!raw?.date || !Array.isArray(raw.insights)) return null;
  return raw;
}

async function gatherSignals(db: PrismaTx, salonId: string, timezone: string) {
  const now = DateTime.now().setZone(timezone);
  const todayStart = now.startOf('day');
  const ninetyDaysAgo = todayStart.minus({ days: 90 });
  const sixtyDaysAgo = todayStart.minus({ days: 60 });

  const [salon, kpis, appointments90d, staffToday, lapsedCount, serviceStaffRows, recentCampaigns] =
    await Promise.all([
      db.salon.findUniqueOrThrow({
        where: { id: salonId },
        select: { name: true, metadata: true },
      }),
      getTenantOverviewKpis(db, salonId, timezone),
      db.appointment.findMany({
        where: {
          salonId,
          start: { gte: ninetyDaysAgo.toJSDate() },
          status: { notIn: ['CANCELLED', 'RESCHEDULED'] },
        },
        select: {
          start: true,
          service: { select: { id: true, name: true, priceCents: true } },
          staff: { select: { id: true, name: true } },
        },
      }),
      db.appointment.findMany({
        where: {
          salonId,
          start: { gte: todayStart.toJSDate(), lt: todayStart.plus({ days: 1 }).toJSDate() },
          status: { notIn: ['CANCELLED', 'RESCHEDULED'] },
        },
        select: { staff: { select: { id: true, name: true } } },
      }),
      db.customer.count({
        where: {
          salonId,
          deletedAt: null,
          OR: [
            { lastInteractionAt: { lt: sixtyDaysAgo.toJSDate() } },
            { lastInteractionAt: null, createdAt: { lt: sixtyDaysAgo.toJSDate() } },
          ],
        },
      }),
      db.staff.findMany({
        where: { salonId, deletedAt: null, active: true, isBookable: true },
        select: {
          id: true,
          name: true,
          services: { select: { serviceId: true, service: { select: { name: true } } } },
        },
      }),
      db.campaign.findMany({
        where: { salonId, status: 'COMPLETED', sentAt: { gte: ninetyDaysAgo.toJSDate() } },
        orderBy: { sentAt: 'desc' },
        take: 5,
        include: { send: { select: { bookedCount: true, sentAt: true } } },
      }),
    ]);

  const bookingsByDow: Record<string, number> = {};
  for (const name of DOW_NAMES) bookingsByDow[name] = 0;
  for (const appt of appointments90d) {
    const dow = DateTime.fromJSDate(appt.start).setZone(timezone).weekday % 7;
    const label = DOW_NAMES[dow]!;
    bookingsByDow[label] = (bookingsByDow[label] ?? 0) + 1;
  }

  const quietestDow =
    DOW_NAMES.reduce((min, d) => (bookingsByDow[d]! < bookingsByDow[min]! ? d : min), DOW_NAMES[0]!) ??
    'Tuesday';

  const staffBookingCounts = new Map<string, { name: string; count: number }>();
  for (const row of staffToday) {
    const id = row.staff.id;
    const cur = staffBookingCounts.get(id) ?? { name: row.staff.name, count: 0 };
    cur.count++;
    staffBookingCounts.set(id, cur);
  }

  const idleStaffToday = serviceStaffRows
    .filter((s) => !staffBookingCounts.has(s.id))
    .map((s) => s.name);

  const serviceStats = new Map<
    string,
    { name: string; bookings: number; priceCents: number; staffIds: Set<string> }
  >();
  for (const appt of appointments90d) {
    const id = appt.service.id;
    const cur = serviceStats.get(id) ?? {
      name: appt.service.name,
      bookings: 0,
      priceCents: appt.service.priceCents,
      staffIds: new Set<string>(),
    };
    cur.bookings++;
    cur.staffIds.add(appt.staff.id);
    serviceStats.set(id, cur);
  }

  const topServices = [...serviceStats.values()]
    .sort((a, b) => b.bookings - a.bookings)
    .slice(0, 5)
    .map((s) => {
      const staffWhoCanDo = serviceStaffRows.filter((st) =>
        st.services.some((link) => link.service.name === s.name),
      ).length;
      const avgPerMonth = s.bookings / 3;
      const extraCapacity = Math.max(0, Math.ceil(avgPerMonth * 0.3));
      return {
        name: s.name,
        bookings90d: s.bookings,
        staffCount: Math.max(s.staffIds.size, staffWhoCanDo),
        missedRevenueCents: extraCapacity * s.priceCents,
      };
    });

  const todayDow = DOW_NAMES[now.weekday % 7]!;

  return {
    salonName: salon.name,
    metadata: salon.metadata,
    kpis,
    todayDow,
    quietestDow,
    bookingsByDow,
    idleStaffToday,
    staffBookingCounts: [...staffBookingCounts.values()],
    topServices,
    lapsedCount,
    recentCampaigns: recentCampaigns.map((c) => ({
      name: c.name,
      sentAt: c.sentAt?.toISOString() ?? null,
      bookedCount: c.send?.bookedCount ?? 0,
    })),
  };
}

function ruleBasedInsights(signals: Awaited<ReturnType<typeof gatherSignals>>): CoachInsight[] {
  const insights: CoachInsight[] = [];
  const todayIsQuiet =
    signals.bookingsByDow[signals.todayDow]! <= signals.bookingsByDow[signals.quietestDow]! + 1;

  if (todayIsQuiet && signals.lapsedCount > 0) {
    const idleName = signals.idleStaffToday[0] ?? 'your team';
    insights.push({
      id: 'quiet-day-campaign',
      headline: `${signals.todayDow} is one of your quieter days`,
      body: `${idleName} has light bookings today. You have ${signals.lapsedCount} lapsed customer${signals.lapsedCount === 1 ? '' : 's'} who haven't visited in 60+ days — a flash deal could fill gaps.`,
      priority: 'high',
      actionLabel: 'Draft flash deal campaign',
      action: {
        type: 'draft_campaign',
        payload: {
          name: `${signals.todayDow} flash deal`,
          message: `Hi! Mid-week special at ${signals.salonName} — reply BOOK to grab a spot before slots fill up.`,
          audienceFilter: { type: 'inactive', inactiveDays: 60 },
        },
      },
    });
  }

  const bottleneck = signals.topServices.find((s) => s.bookings90d >= 5 && s.staffCount <= 1);
  if (bottleneck && bottleneck.missedRevenueCents > 0) {
    const rands = Math.round(bottleneck.missedRevenueCents / 100);
    insights.push({
      id: 'service-capacity',
      headline: `${bottleneck.name} is in high demand`,
      body: `${bottleneck.name} is your most booked service but only 1 staff member offers it. You could be turning away ~R${rands.toLocaleString('en-ZA')}/month in potential bookings. Consider cross-training.`,
      priority: 'high',
      actionLabel: 'Review staff services',
      action: { type: 'open_roster' },
    });
  }

  if (signals.kpis.pendingPayments > 0) {
    insights.push({
      id: 'pending-payments',
      headline: `${signals.kpis.pendingPayments} booking${signals.kpis.pendingPayments === 1 ? '' : 's'} awaiting payment`,
      body: 'Payment links are still open — follow up before slots expire or customers drop off.',
      priority: 'medium',
      actionLabel: 'View appointments',
      action: { type: 'open_appointments', payload: { status: 'PENDING_PAYMENT' } },
    });
  }

  if (signals.kpis.openTickets > 0) {
    insights.push({
      id: 'open-tickets',
      headline: `${signals.kpis.openTickets} support ticket${signals.kpis.openTickets === 1 ? '' : 's'} need attention`,
      body: 'Unresolved tickets can hurt retention — clear the queue while you have a quiet moment.',
      priority: 'medium',
      actionLabel: 'View tickets',
      action: { type: 'open_customers' },
    });
  }

  if (insights.length === 0) {
    insights.push({
      id: 'steady',
      headline: 'Looking good today',
      body: `Bookings are on track with R${Math.round(signals.kpis.revenueTodayCents / 100).toLocaleString('en-ZA')} revenue so far. Keep momentum with a win-back campaign when you have a quiet afternoon.`,
      priority: 'low',
      actionLabel: 'Plan a newsletter',
      action: {
        type: 'draft_campaign',
        payload: {
          name: 'Customer win-back',
          message: `We miss you at ${signals.salonName}! Reply BOOK to schedule your next visit.`,
          audienceFilter: { type: 'inactive', inactiveDays: 90 },
        },
      },
    });
  }

  return insights.slice(0, 3);
}

async function aiInsights(signals: Awaited<ReturnType<typeof gatherSignals>>): Promise<CoachInsight[] | null> {
  const payload = {
    salonName: signals.salonName,
    todayDow: signals.todayDow,
    quietestDow: signals.quietestDow,
    bookingsByDow: signals.bookingsByDow,
    idleStaffToday: signals.idleStaffToday,
    staffBookingsToday: signals.staffBookingCounts,
    topServices: signals.topServices,
    lapsedCustomerCount: signals.lapsedCount,
    recentCampaigns: signals.recentCampaigns,
    kpis: {
      bookingsToday: signals.kpis.bookingsToday,
      revenueTodayRands: Math.round(signals.kpis.revenueTodayCents / 100),
      pendingPayments: signals.kpis.pendingPayments,
      openTickets: signals.kpis.openTickets,
    },
  };

  return claudeJson<{ insights: CoachInsight[] }>({
    system: `You are a proactive salon business coach for MarineFlow (South Africa, ZAR).
Return JSON only: { "insights": [ { "id": "kebab-case", "headline": "...", "body": "conversational 1-2 sentences with specific numbers", "priority": "high|medium|low", "actionLabel": "short CTA", "action": { "type": "draft_campaign|open_roster|open_services|open_appointments|open_customers", "payload": {} } } ] }
Rules:
- Exactly 1-3 insights, most actionable first.
- Use provided data only; never invent customer names.
- draft_campaign payload must include name, message, audienceFilter ({ type: "inactive", inactiveDays: number } or { type: "all" }).
- Tone: direct, friendly, like a trusted manager — not a report.
- Reference ZAR as R prefix.`,
    user: JSON.stringify(payload),
    maxTokens: 1200,
  }).then((r) => {
    if (!r?.insights?.length) return null;
    return r.insights.slice(0, 3).map((ins, i) => ({
      ...ins,
      id: ins.id || `ai-${i}`,
      priority: ins.priority ?? 'medium',
    }));
  });
}

export async function getBusinessCoachInsights(
  db: PrismaTx,
  salonId: string,
  options?: { forceRefresh?: boolean },
): Promise<BusinessCoachResponse> {
  const salon = await db.salon.findUniqueOrThrow({
    where: { id: salonId },
    select: { timezone: true, metadata: true },
  });
  const timezone = salon.timezone || 'Africa/Johannesburg';
  const todayKey = DateTime.now().setZone(timezone).toISODate()!;

  const cached = coachCacheFromMetadata(salon.metadata);
  if (!options?.forceRefresh && cached?.date === todayKey && cached.insights.length > 0) {
    return {
      generatedAt: new Date().toISOString(),
      insights: cached.insights,
      aiPowered: isAnthropicConfigured(),
      cached: true,
    };
  }

  const signals = await gatherSignals(db, salonId, timezone);
  let insights = isAnthropicConfigured() ? await aiInsights(signals) : null;
  if (!insights?.length) insights = ruleBasedInsights(signals);

  const cachePayload: CoachCache = { date: todayKey, insights };
  const existingMeta =
    signals.metadata && typeof signals.metadata === 'object'
      ? (signals.metadata as Record<string, unknown>)
      : {};
  await db.salon.update({
    where: { id: salonId },
    data: {
      metadata: { ...existingMeta, businessCoach: cachePayload } as object,
    },
  });

  return {
    generatedAt: new Date().toISOString(),
    insights,
    aiPowered: isAnthropicConfigured(),
    cached: false,
  };
}

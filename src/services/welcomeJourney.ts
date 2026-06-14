import { getTenantDb } from '../lib/db/tenantSession.js';
import { parseAutomationsFromMetadata } from '../lib/automationSettings.js';
import { marketingConsentGatePending } from './marketingConsent.js';

export async function sendWelcomeJourneyIfNeeded(params: {
  salonId: string;
  customerId: string;
  isFirstInteraction: boolean;
  send: (body: string) => Promise<void>;
}): Promise<boolean> {
  if (!params.isFirstInteraction) return false;

  const db = getTenantDb();

  const alreadySent = await db.analyticsEvent.findFirst({
    where: {
      salonId: params.salonId,
      customerId: params.customerId,
      type: 'welcome_journey_sent',
    },
  });
  if (alreadySent) return false;

  const salon = await db.salon.findUnique({
    where: { id: params.salonId },
    select: {
      metadata: true,
      name: true,
      tradingName: true,
      welcomeMessage: true,
      botAskMarketingConsent: true,
    },
  });
  if (!salon) return false;

  const customer = await db.customer.findUnique({
    where: { id: params.customerId },
    select: { marketingConsentStatus: true },
  });
  if (!customer) return false;

  const automations = parseAutomationsFromMetadata(salon.metadata);
  if (!automations.welcomeJourney.enabled) return false;

  const salonName = salon.tradingName ?? salon.name;
  const parts: string[] = [
    `Welcome to ${salonName}! 👋`,
    automations.welcomeJourney.introMessage,
  ];

  if (automations.welcomeJourney.showPopularServices) {
    const popular = await db.service.findMany({
      where: { salonId: params.salonId, active: true, deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      take: 4,
      select: { name: true, priceCents: true },
    });
    if (popular.length) {
      parts.push('', 'Popular services:');
      for (const s of popular) {
        parts.push(`• ${s.name} — R${(s.priceCents / 100).toFixed(0)}`);
      }
    }
  }

  if (marketingConsentGatePending(salon, customer.marketingConsentStatus)) {
    parts.push(
      '',
      'Reply *MENU* to get started. We\'ll ask once about marketing messages (promos & offers) — reply *ACCEPT* or *DECLINE*. Booking updates are always sent.',
    );
  } else {
    parts.push('', 'Reply *MENU* to book, browse services, or get help.');
  }

  await params.send(parts.join('\n'));

  await db.analyticsEvent.create({
    data: {
      salonId: params.salonId,
      customerId: params.customerId,
      type: 'welcome_journey_sent',
    },
  });

  return true;
}

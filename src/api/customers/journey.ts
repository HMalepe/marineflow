import type { PrismaTx } from '../../lib/db/tenantSession.js';

export type JourneyEventType =
  | 'whatsapp_in'
  | 'whatsapp_out'
  | 'booking'
  | 'completed'
  | 'payment'
  | 'payment_pending'
  | 'rating'
  | 'campaign'
  | 'loyalty'
  | 'ticket'
  | 'support'
  | 'milestone';

export type JourneyEvent = {
  id: string;
  at: string;
  type: JourneyEventType;
  title: string;
  detail?: string;
  meta?: Record<string, string | number | null>;
};

const STEP_LABELS: Record<string, string> = {
  GREETING: 'Greeting',
  MENU: 'Main menu',
  PICK_SERVICE: 'Choosing service',
  PICK_STAFF: 'Choosing stylist',
  PICK_DATE: 'Choosing date',
  PICK_SLOT: 'Choosing time',
  CONFIRM_BOOKING: 'Confirming booking',
  FAQ: 'FAQ',
  HANDOFF: 'Speaking to team',
  MARKETING_CONSENT: 'POPIA consent',
};

export async function getCustomerJourney(
  db: PrismaTx,
  salonId: string,
  customerId: string,
): Promise<JourneyEvent[] | null> {
  const customer = await db.customer.findFirst({
    where: { id: customerId, salonId, deletedAt: null },
    select: { id: true, createdAt: true },
  });
  if (!customer) return null;

  const [messages, appointments, payments, loyalty, tickets, analytics, conversation, campaignRecipients] =
    await Promise.all([
      db.message.findMany({
        where: { customerId },
        orderBy: { createdAt: 'asc' },
        take: 200,
        select: { id: true, direction: true, body: true, createdAt: true },
      }),
      db.appointment.findMany({
        where: { customerId, salonId },
        orderBy: { start: 'asc' },
        take: 100,
        include: {
          service: { select: { name: true, priceCents: true } },
          staff: { select: { name: true } },
          payments: { where: { status: 'SUCCEEDED' }, select: { amountCents: true, createdAt: true } },
        },
      }),
      db.payment.findMany({
        where: { customerId, salonId, status: 'SUCCEEDED' },
        orderBy: { createdAt: 'asc' },
        select: { id: true, amountCents: true, createdAt: true },
      }),
      db.loyaltyLedger.findMany({
        where: { customerId },
        orderBy: { createdAt: 'asc' },
        take: 50,
        select: { id: true, delta: true, reason: true, createdAt: true },
      }),
      db.ticket.findMany({
        where: { customerId, salonId },
        orderBy: { createdAt: 'asc' },
        take: 30,
        select: { id: true, subject: true, status: true, createdAt: true },
      }),
      db.analyticsEvent.findMany({
        where: { customerId, salonId },
        orderBy: { createdAt: 'asc' },
        take: 50,
        select: { id: true, type: true, createdAt: true },
      }),
      db.conversation.findFirst({
        where: { customerId, salonId },
        select: { step: true },
      }),
      db.campaignRecipient.findMany({
        where: { customerId, salonId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { campaign: { select: { name: true } } },
      }),
    ]);

  const events: JourneyEvent[] = [];

  if (messages[0]) {
    events.push({
      id: `msg-first-${messages[0].id}`,
      at: messages[0].createdAt.toISOString(),
      type: 'milestone',
      title: 'First WhatsApp message',
      detail: STEP_LABELS[conversation?.step ?? 'GREETING'] ?? 'Greeting',
    });
  }

  for (const msg of messages.slice(1)) {
    const preview = msg.body.replace(/\s+/g, ' ').trim().slice(0, 80);
    events.push({
      id: `msg-${msg.id}`,
      at: msg.createdAt.toISOString(),
      type: msg.direction === 'INBOUND' ? 'whatsapp_in' : 'whatsapp_out',
      title: msg.direction === 'INBOUND' ? 'Customer replied' : 'Bot / team sent',
      detail: preview + (msg.body.length > 80 ? '…' : ''),
    });
  }

  for (const appt of appointments) {
    events.push({
      id: `appt-book-${appt.id}`,
      at: appt.createdAt.toISOString(),
      type: 'booking',
      title: `Booked ${appt.service.name}`,
      detail: `with ${appt.staff.name}`,
      meta: { appointmentId: appt.id },
    });

    if (appt.status === 'PENDING_PAYMENT' || appt.paymentLinkSentAt) {
      events.push({
        id: `appt-pay-pending-${appt.id}`,
        at: (appt.paymentLinkSentAt ?? appt.createdAt).toISOString(),
        type: 'payment_pending',
        title: 'Payment link sent · Pending',
        detail: appt.service.name,
      });
    }

    if (['COMPLETED', 'CONFIRMED', 'CONFIRMED_PAID'].includes(appt.status)) {
      events.push({
        id: `appt-done-${appt.id}`,
        at: appt.start.toISOString(),
        type: 'completed',
        title: `Appointment ${appt.status === 'COMPLETED' ? 'completed' : 'confirmed'}`,
        detail: `${appt.service.name} · R${Math.round(appt.service.priceCents / 100)}`,
      });
    }

    const pay = appt.payments[0];
    if (pay) {
      events.push({
        id: `pay-appt-${appt.id}`,
        at: pay.createdAt.toISOString(),
        type: 'payment',
        title: `Paid R${Math.round(pay.amountCents / 100)}`,
        detail: appt.service.name,
      });
    }

    if (appt.csatScore != null) {
      events.push({
        id: `rating-${appt.id}`,
        at: (appt.csatSentAt ?? appt.start).toISOString(),
        type: 'rating',
        title: `Left ${appt.csatScore}★ rating`,
        detail: appt.service.name,
      });
    }
  }

  for (const p of payments) {
    if (events.some((e) => e.id === `pay-standalone-${p.id}`)) continue;
    events.push({
      id: `pay-standalone-${p.id}`,
      at: p.createdAt.toISOString(),
      type: 'payment',
      title: `Paid R${Math.round(p.amountCents / 100)}`,
    });
  }

  for (const row of loyalty) {
    events.push({
      id: `loyalty-${row.id}`,
      at: row.createdAt.toISOString(),
      type: 'loyalty',
      title:
        row.delta > 0
          ? `Earned ${row.delta} stamp${row.delta === 1 ? '' : 's'}`
          : `Redeemed ${Math.abs(row.delta)} stamp(s)`,
      detail: row.reason ?? undefined,
    });
  }

  for (const t of tickets) {
    events.push({
      id: `ticket-${t.id}`,
      at: t.createdAt.toISOString(),
      type: 'ticket',
      title: t.subject || 'Support ticket opened',
      detail: t.status,
    });
  }

  for (const ev of analytics) {
    events.push({
      id: `analytics-${ev.id}`,
      at: ev.createdAt.toISOString(),
      type: ev.type === 'welcome_journey_sent' ? 'milestone' : 'support',
      title: ev.type.replace(/_/g, ' '),
    });
  }

  for (const cr of campaignRecipients) {
    events.push({
      id: `campaign-${cr.id}`,
      at: cr.createdAt.toISOString(),
      type: 'campaign',
      title: 'Campaign received',
      detail: cr.campaign.name,
    });
    if (cr.read && !cr.replied) {
      events.push({
        id: `campaign-read-${cr.id}`,
        at: cr.createdAt.toISOString(),
        type: 'campaign',
        title: 'Opened campaign',
        detail: "Didn't book yet — drop-off point",
      });
    }
    if (cr.replied) {
      events.push({
        id: `campaign-reply-${cr.id}`,
        at: cr.createdAt.toISOString(),
        type: 'whatsapp_in',
        title: 'Replied to campaign',
        detail: cr.campaign.name,
      });
    }
  }

  events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const seen = new Set<string>();
  return events.filter((e) => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });
}

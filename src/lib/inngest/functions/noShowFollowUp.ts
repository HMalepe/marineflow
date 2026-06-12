// Sends a "we missed you — want to rebook?" message 30 minutes after a no-show is recorded.
// Fires only when the customer has ACCEPTED marketing consent and a valid WhatsApp number.
// Event is scheduled with a 30-min delay from the no-show endpoint.

import { inngest } from '../client.js';
import { prisma } from '../../prisma.js';
import { sendWithFallback } from '../../../services/channelRouter.js';
import { ConversationStep } from '@prisma/client';

async function withJobTenant<T>(salonId: string, fn: () => Promise<T>): Promise<T> {
  await prisma.$executeRawUnsafe(`SELECT set_config('app.current_tenant', $1, true)`, salonId);
  return fn();
}

export const noShowFollowUp = inngest.createFunction(
  {
    id: 'no-show-followup',
    retries: 2,
    triggers: [{ event: 'appointment/no_show.followup' }],
  },
  async ({ event }) => {
    const { appointmentId, salonId, customerId, customerWaId } = event.data as {
      appointmentId: string;
      salonId: string;
      customerId: string;
      customerWaId: string;
    };

    const data = await withJobTenant(salonId, () =>
      prisma.appointment.findUnique({
        where: { id: appointmentId },
        include: {
          customer: {
            select: {
              id: true,
              waId: true,
              firstName: true,
              displayName: true,
              marketingConsentStatus: true,
            },
          },
          service: { select: { name: true } },
          staff: { select: { name: true, displayName: true } },
          salon: {
            select: {
              name: true,
              tradingName: true,
              timezone: true,
              botWinbackEnabled: true,
            },
          },
        },
      }),
    );

    if (!data) return { skipped: true, reason: 'appointment_not_found' };
    if (data.status !== 'NO_SHOW') return { skipped: true, reason: 'status_changed' };

    const { customer, service, staff, salon } = data;

    // Re-check consent — may have changed since the event was fired
    if (customer.marketingConsentStatus !== 'ACCEPTED') {
      return { skipped: true, reason: 'consent_not_accepted' };
    }
    if (!customer.waId || customer.waId.startsWith('erased_')) {
      return { skipped: true, reason: 'no_wa_id' };
    }

    // Guard against dedup — don't send if we already sent a winback recently
    const recentWinback = await withJobTenant(salonId, () =>
      prisma.analyticsEvent.findFirst({
        where: {
          salonId,
          customerId,
          type: 'no_show_followup_sent',
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
    );
    if (recentWinback) return { skipped: true, reason: 'recent_followup_sent' };

    const name = customer.displayName ?? customer.firstName ?? 'there';
    const salonName = salon.tradingName ?? salon.name;
    const staffName = staff.displayName ?? staff.name;

    const body = [
      `Hi ${name} 💛 We missed you today!`,
      '',
      `Your ${service.name} with ${staffName} at ${salonName} wasn't attended.`,
      '',
      `Whenever you're ready, we'd love to welcome you back. Reply BOOK to schedule your next visit.`,
    ].join('\n');

    const { result } = await sendWithFallback({
      salonId,
      to: customer.waId,
      body,
    });

    // Log the send regardless of delivery outcome — analytics should show attempts
    await withJobTenant(salonId, () =>
      prisma.analyticsEvent.create({
        data: {
          salonId,
          customerId,
          appointmentId,
          type: 'no_show_followup_sent',
          payload: { delivered: result === 'sent' || result === 'delivered', channel: 'whatsapp' },
        },
      }),
    );

    // Reset conversation to MENU so "BOOK" deep-link reply works naturally
    await withJobTenant(salonId, () =>
      prisma.conversation.updateMany({
        where: { salonId, customerId, endedAt: null },
        data: { step: ConversationStep.MENU },
      }),
    );

    return { sent: true, appointmentId, customerId };
  },
);

// Fires after every appointment is marked COMPLETED.
// Waits 4 hours, then sends a WhatsApp rating request IF:
//   - No csatSentAt already set (prevent double-send)
//   - Appointment is still COMPLETED (not cancelled/rescheduled after)
//   - Customer has a waId
// Sets csatSentAt on the appointment.
// Also sets conversation step to CSAT with csatAppointmentId in context.

import { ConversationStep, MessageDirection } from '@prisma/client';
import { inngest } from '../client.js';
import { prisma } from '../../prisma.js';
import { sendWithFallback } from '../../../services/channelRouter.js';

export type AppointmentCompletedEvent = {
  data: {
    appointmentId: string;
    salonId: string;
    customerId: string;
    customerWaId: string;
  };
};

async function withJobTenant<T>(salonId: string, fn: () => Promise<T>): Promise<T> {
  await prisma.$executeRawUnsafe(`SELECT set_config('app.current_tenant', $1, true)`, salonId);
  return fn();
}

export const appointmentRating = inngest.createFunction(
  { id: 'appointment-rating' },
  { event: 'whatsapp/appointment.completed' },
  async ({ event, step }) => {
    const { appointmentId, salonId, customerId, customerWaId } =
      event.data as AppointmentCompletedEvent['data'];

    // Wait 4 hours before sending the rating request
    await step.sleep('wait-4h', '4h');

    await step.run('send-rating-request', async () =>
      withJobTenant(salonId, async () => {
        // Load appointment — check csatSentAt and status
        const appt = await prisma.appointment.findUnique({
          where: { id: appointmentId },
          select: {
            id: true,
            salonId: true,
            customerId: true,
            status: true,
            csatSentAt: true,
          },
        });

        if (!appt) return;
        if (appt.csatSentAt !== null) return; // already sent
        if (appt.status !== 'COMPLETED') return; // cancelled / rescheduled since

        if (!customerWaId) return;

        // Load customer first name + salon name
        const [customer, salon] = await Promise.all([
          prisma.customer.findUnique({
            where: { id: customerId },
            select: { firstName: true },
          }),
          prisma.salon.findUnique({
            where: { id: salonId },
            select: { name: true, tradingName: true },
          }),
        ]);

        const firstName = customer?.firstName ?? 'there';
        const salonName = salon?.tradingName ?? salon?.name ?? 'us';

        const body =
          `Hi ${firstName}! We hope you enjoyed your visit to ${salonName} 😊\n\n` +
          `How would you rate your experience?\n\n` +
          `⭐ 1 – Poor\n` +
          `⭐⭐ 2 – Below average\n` +
          `⭐⭐⭐ 3 – Good\n` +
          `⭐⭐⭐⭐ 4 – Great\n` +
          `⭐⭐⭐⭐⭐ 5 – Excellent\n\n` +
          `Just reply with a number 1–5.`;

        await sendWithFallback({ salonId, to: customerWaId, body });

        // Mark csatSentAt on the appointment
        await prisma.appointment.update({
          where: { id: appointmentId },
          data: { csatSentAt: new Date() },
        });

        // Find the open conversation for this customer+salon and set step to CSAT
        const conv = await prisma.conversation.findUnique({
          where: { salonId_customerId: { salonId, customerId } },
          select: { id: true, customerId: true, context: true },
        });

        if (conv) {
          const existingCtx =
            typeof conv.context === 'object' && conv.context !== null ? conv.context : {};
          await prisma.conversation.update({
            where: { id: conv.id },
            data: {
              step: ConversationStep.CSAT,
              context: { ...(existingCtx as Record<string, unknown>), csatAppointmentId: appointmentId },
              lastMessageAt: new Date(),
            },
          });

          // Record outbound message
          await prisma.message.create({
            data: {
              conversationId: conv.id,
              customerId,
              direction: MessageDirection.OUTBOUND,
              body,
            },
          });
        }
      }),
    );
  },
);

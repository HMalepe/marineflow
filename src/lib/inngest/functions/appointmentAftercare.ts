// Sends service-specific aftercare instructions ~10 minutes after a completed appointment.

import { inngest } from '../client.js';
import { prisma } from '../../prisma.js';
import { sendWithFallback } from '../../../services/channelRouter.js';
import { resolveAftercareNote } from '../../../services/aftercare.js';
import type { AppointmentCompletedEvent } from './appointmentRating.js';

async function withJobTenant<T>(salonId: string, fn: () => Promise<T>): Promise<T> {
  await prisma.$executeRawUnsafe(`SELECT set_config('app.current_tenant', $1, true)`, salonId);
  return fn();
}

export const appointmentAftercare = inngest.createFunction(
  {
    id: 'appointment-aftercare',
    retries: 2,
    triggers: [{ event: 'whatsapp/appointment.completed' }],
  },
  async ({ event, step }) => {
    const { appointmentId, salonId, customerId, customerWaId } =
      event.data as AppointmentCompletedEvent['data'];

    await step.sleep('wait-10m', '10m');

    await step.run('send-aftercare', async () =>
      withJobTenant(salonId, async () => {
        const appt = await prisma.appointment.findUnique({
          where: { id: appointmentId },
          select: {
            status: true,
            aftercareSentAt: true,
            service: { select: { name: true, aftercareNote: true } },
          },
        });
        if (!appt) return;
        if (appt.aftercareSentAt !== null) return;
        if (appt.status !== 'COMPLETED') return;
        if (!customerWaId) return;

        const note = resolveAftercareNote({
          serviceName: appt.service.name,
          customAftercareNote: appt.service.aftercareNote,
        });
        if (!note) return;

        const customer = await prisma.customer.findUnique({
          where: { id: customerId },
          select: { firstName: true, deletedAt: true },
        });
        if (!customer || customer.deletedAt) return;

        const body =
          `Hi ${customer.firstName ?? 'there'}! A quick aftercare tip for your ${appt.service.name}:\n\n` +
          `${note}`;

        await sendWithFallback({ salonId, to: customerWaId, body });

        await prisma.appointment.updateMany({
          where: { id: appointmentId, aftercareSentAt: null },
          data: { aftercareSentAt: new Date() },
        });
      }),
    );
  },
);

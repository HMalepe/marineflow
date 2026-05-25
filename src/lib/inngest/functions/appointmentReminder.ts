import { inngest } from '../client.js';
import { prisma } from '../../prisma.js';
import { messaging } from '../../integrations/messaging/index.js';

async function withJobTenant<T>(salonId: string, fn: () => Promise<T>): Promise<T> {
  await prisma.$executeRawUnsafe(`SELECT set_config('app.current_tenant', $1, true)`, salonId);
  return fn();
}

export const appointmentReminder = inngest.createFunction(
  {
    id: 'appointment-reminder',
    retries: 2,
    triggers: [{ event: 'appointment/reminder.send' }],
  },
  async ({ event, step }) => {
    const { appointmentId, salonId, hoursBeforeLabel } = event.data as {
      appointmentId: string;
      salonId: string;
      hoursBeforeLabel: string;
    };

    const appt = await step.run('load-appointment', async () => {
      return withJobTenant(salonId, () =>
        prisma.appointment.findUnique({
          where: { id: appointmentId },
          include: { customer: true, service: true, staff: true, salon: true },
        }),
      );
    });

    if (!appt || appt.status === 'CANCELLED' || appt.status === 'RESCHEDULED') {
      return { skipped: true, reason: 'cancelled_or_missing' };
    }

    if (appt.reminderSentAt && hoursBeforeLabel === '24h') {
      return { skipped: true, reason: 'already_sent' };
    }

    await step.run('send-reminder', async () => {
      const startDate = new Date(appt.start as unknown as string);
      const startFormatted = startDate.toLocaleString('en-ZA', {
        timeZone: appt.salon.timezone,
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      const body = [
        `Hi ${appt.customer.displayName ?? 'there'}! Reminder:`,
        `${appt.service.name} with ${appt.staff.name}`,
        `${startFormatted}`,
        '',
        'Reply CANCEL to cancel or RESCHEDULE to change time.',
      ].join('\n');

      await messaging.sendText({
        to: appt.customer.waId,
        body,
        phoneNumberId: appt.salon.whatsappPhoneId ?? undefined,
      });
    });

    await step.run('mark-reminder-sent', async () => {
      await withJobTenant(salonId, () =>
        prisma.appointment.update({
          where: { id: appointmentId },
          data: { reminderSentAt: new Date() },
        }),
      );
    });

    return { sent: true, appointmentId, hoursBeforeLabel };
  },
);

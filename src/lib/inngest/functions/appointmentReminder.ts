import { inngest } from '../client.js';
import { prisma } from '../../prisma.js';
import { messaging } from '../../integrations/messaging/index.js';
import { reminderField } from '../../../services/appointmentReminders.js';
import { parseAutomationsFromMetadata } from '../../automationSettings.js';

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
    const { appointmentId, salonId, hoursBefore, hoursBeforeLabel } = event.data as {
      appointmentId: string;
      salonId: string;
      hoursBefore?: number;
      hoursBeforeLabel?: string;
    };

    const appt = await step.run('load-appointment', async () => {
      return withJobTenant(salonId, () =>
        prisma.appointment.findUnique({
          where: { id: appointmentId },
          include: { customer: true, service: true, staff: true, salon: true },
        }),
      );
    });

    if (!appt || appt.status === 'CANCELLED' || appt.status === 'RESCHEDULED' || appt.status === 'NO_SHOW') {
      return { skipped: true, reason: 'cancelled_or_missing' };
    }

    if (new Date(appt.start).getTime() <= Date.now()) {
      return { skipped: true, reason: 'appointment_past' };
    }

    if (!appt.customer.waId || appt.customer.waId.startsWith('erased_')) {
      return { skipped: true, reason: 'no_wa_id' };
    }

    if (!['CONFIRMED', 'CONFIRMED_PAID'].includes(appt.status)) {
      return { skipped: true, reason: 'not_confirmed' };
    }

    const automations = parseAutomationsFromMetadata(appt.salon.metadata);
    if (!automations.reminders.enabled) {
      return { skipped: true, reason: 'reminders_disabled' };
    }

    const hours = hoursBefore ?? (hoursBeforeLabel === '2h' ? 2 : 24);
    const field = reminderField(hours);
    if (field && appt[field]) {
      return { skipped: true, reason: 'already_sent' };
    }

    // Legacy single-field dedup for 24h
    if (!field && hours >= 24 && appt.reminderSentAt) {
      return { skipped: true, reason: 'already_sent' };
    }

    const sendResult = await step.run('send-reminder', async () => {
      const startDate = new Date(appt.start as unknown as string);
      const startFormatted = startDate.toLocaleString('en-ZA', {
        timeZone: appt.salon.timezone,
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      const timeLabel =
        hours >= 24
          ? `in ${Math.round(hours / 24)} day${hours >= 48 ? 's' : ''}`
          : `in ${hours} hours`;

      const body = [
        `Hi ${appt.customer.displayName ?? appt.customer.firstName ?? 'there'}! Reminder:`,
        `${appt.service.name} with ${appt.staff.name}`,
        `${startFormatted} (${timeLabel})`,
        '',
        'Reply CANCEL or RESCHEDULE to manage your booking.',
      ].join('\n');

      try {
        await messaging.sendText({
          to: appt.customer.waId,
          body,
          phoneNumberId: appt.salon.whatsappPhoneId ?? undefined,
        });
        return { ok: true };
      } catch (err) {
        // Record failure immediately so the dashboard shows failed state even before retries exhaust.
        // On a successful retry the mark-reminder-sent step will clear the failure flag.
        const failField = field === 'reminder24hSentAt' ? 'reminder24hFailed'
          : field === 'reminder2hSentAt' ? 'reminder2hFailed' : null;
        if (failField) {
          await withJobTenant(salonId, () =>
            prisma.appointment.update({ where: { id: appointmentId }, data: { [failField]: true } }),
          );
        }
        throw err; // re-throw so Inngest retries
      }
    });

    await step.run('mark-reminder-sent', async () => {
      await withJobTenant(salonId, () => {
        const data: Record<string, Date | boolean> = { reminderSentAt: new Date() };
        if (field) {
          data[field] = new Date();
          // Clear failure flag on success (may have been set on a previous retry attempt)
          const failField = field === 'reminder24hSentAt' ? 'reminder24hFailed' : 'reminder2hFailed';
          data[failField] = false;
        }
        return prisma.appointment.update({ where: { id: appointmentId }, data });
      });
    });

    return { sent: true, appointmentId, hoursBefore: hours, hoursBeforeLabel };
  },
);

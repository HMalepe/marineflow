import { DateTime } from 'luxon';
import { inngest } from '../lib/inngest/client.js';
import { parseAutomationsFromMetadata } from '../lib/automationSettings.js';
import { logger } from '../lib/logger.js';
import type { Appointment, Salon } from '@prisma/client';

type ApptForReminders = Pick<Appointment, 'id' | 'salonId' | 'start' | 'status'> & {
  salon: Pick<Salon, 'metadata' | 'timezone'>;
};

function reminderLabel(hours: number): string {
  if (hours >= 24 && hours % 24 === 0) return `${hours / 24}h`;
  return `${hours}h`;
}

function reminderField(hours: number): 'reminder24hSentAt' | 'reminder2hSentAt' | null {
  if (hours === 24) return 'reminder24hSentAt';
  if (hours === 2) return 'reminder2hSentAt';
  return null;
}

/**
 * Schedule Inngest reminder events for each configured interval before appointment start.
 * Skips if appointment is not in a confirmed state or start is in the past.
 */
export async function scheduleAppointmentReminders(appt: ApptForReminders): Promise<void> {
  const confirmed = ['CONFIRMED', 'CONFIRMED_PAID'].includes(appt.status);
  if (!confirmed) return;

  const automations = parseAutomationsFromMetadata(appt.salon.metadata);
  if (!automations.reminders.enabled) return;

  const start = DateTime.fromJSDate(appt.start).setZone(appt.salon.timezone);
  const now = DateTime.now().setZone(appt.salon.timezone);

  for (const hours of automations.reminders.hoursBefore) {
    const fireAt = start.minus({ hours });
    if (fireAt <= now) continue;

    const label = reminderLabel(hours);
    try {
      await inngest.send({
        name: 'appointment/reminder.send',
        data: {
          appointmentId: appt.id,
          salonId: appt.salonId,
          hoursBefore: hours,
          hoursBeforeLabel: label,
        },
        ts: fireAt.toMillis(),
      });
    } catch (err) {
      logger.warn({ err, appointmentId: appt.id, hours }, 'reminder_schedule_failed');
    }
  }
}

export { reminderField };

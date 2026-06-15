import { DateTime } from 'luxon';
import type { Appointment, Salon } from '@prisma/client';
import { parseAutomationsFromMetadata, type SalonAutomations } from '../lib/automationSettings.js';

export type CancellationAction = 'cancel' | 'reschedule';

export interface CancellationCheckResult {
  allowed: boolean;
  reason?: 'self_service_disabled' | 'too_late' | 'penalty_applies';
  hoursUntil: number;
  penaltyApplies: boolean;
  message: string;
}

function hoursUntilStart(
  start: Date,
  timezone: string,
): number {
  const now = DateTime.now().setZone(timezone);
  const apptStart = DateTime.fromJSDate(start).setZone(timezone);
  return apptStart.diff(now, 'hours').hours;
}

export function getCancellationRules(salon: Pick<Salon, 'metadata'>): SalonAutomations['cancellation'] {
  return parseAutomationsFromMetadata(salon.metadata).cancellation;
}

export function checkCancellationAllowed(params: {
  salon: Pick<Salon, 'metadata' | 'timezone'>;
  appointment: Pick<Appointment, 'start' | 'penaltyWaivedAt' | 'cancellationPenaltyApplied'>;
  action: CancellationAction;
}): CancellationCheckResult {
  const rules = getCancellationRules(params.salon);
  const hoursUntil = hoursUntilStart(params.appointment.start, params.salon.timezone);

  if (params.action === 'reschedule' && !rules.allowSelfServiceReschedule) {
    return {
      allowed: false,
      reason: 'self_service_disabled',
      hoursUntil,
      penaltyApplies: false,
      message:
        'Self-service rescheduling is not available. Please contact us and we will help you find a new time.',
    };
  }

  const threshold =
    params.action === 'cancel' ? rules.cancelHoursBefore : rules.rescheduleHoursBefore;

  if (hoursUntil < threshold) {
    // Emergency override: owner waived penalty — allow late cancel/reschedule.
    if (params.appointment.penaltyWaivedAt && (params.action === 'cancel' || params.action === 'reschedule')) {
      return {
        allowed: true,
        hoursUntil,
        penaltyApplies: false,
        message: '',
      };
    }

    const penaltyApplies =
      rules.forfeitPaymentOnLateCancel &&
      !params.appointment.penaltyWaivedAt &&
      params.action === 'cancel';

    return {
      allowed: false,
      reason: penaltyApplies ? 'penalty_applies' : 'too_late',
      hoursUntil,
      penaltyApplies,
      message: penaltyApplies
        ? `Cancellations within ${threshold} hours of your appointment forfeit any payment already made. Contact us if you need help.`
        : `${params.action === 'cancel' ? 'Cancellation' : 'Reschedule'} must be at least ${threshold} hours before your appointment. Please contact us directly.`,
    };
  }

  return {
    allowed: true,
    hoursUntil,
    penaltyApplies: false,
    message: '',
  };
}

export function formatHoursUntil(hours: number): string {
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? '' : 's'}`;
  }
  const h = Math.max(1, Math.round(hours));
  return `${h} hour${h === 1 ? '' : 's'}`;
}

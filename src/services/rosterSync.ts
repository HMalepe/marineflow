import {
  invalidateBusinessHoursCache,
  invalidateServicesCache,
  invalidateStaffCache,
} from './cachedQueries.js';
import {
  emitAppointmentCreated,
  emitAppointmentUpdated,
  publishEvent,
} from '../lib/eventBus.js';
import { invalidatePattern } from '../lib/cache.js';
import { logger } from '../lib/logger.js';

export type RosterSyncScope = 'services' | 'staff' | 'availability' | 'all';

/**
 * Invalidate caches + fan out SSE so dashboard and bot consumers see roster changes immediately.
 * Fire-and-forget safe — callers should void + catch if needed.
 */
export async function syncSalonRoster(
  salonId: string,
  scope: RosterSyncScope,
  payload: Record<string, unknown> = {},
): Promise<void> {
  const tasks: Promise<void>[] = [];

  if (scope === 'services' || scope === 'all') {
    tasks.push(invalidateServicesCache(salonId));
    tasks.push(
      publishEvent({
        type: 'service.catalog_changed',
        salonId,
        payload,
        timestamp: new Date().toISOString(),
      }),
    );
  }

  if (scope === 'staff' || scope === 'all') {
    tasks.push(invalidateStaffCache(salonId));
    tasks.push(invalidateBusinessHoursCache(salonId));
    tasks.push(
      publishEvent({
        type: 'staff.roster_changed',
        salonId,
        payload,
        timestamp: new Date().toISOString(),
      }),
    );
  }

  if (scope === 'availability' || scope === 'all') {
    tasks.push(invalidatePattern(`cache:slots:${salonId}:*`));
    tasks.push(
      publishEvent({
        type: 'appointment.updated',
        salonId,
        payload: { reason: 'availability_changed', ...payload },
        timestamp: new Date().toISOString(),
      }),
    );
  }

  await Promise.all(tasks);
}

export function syncSalonRosterLater(
  salonId: string,
  scope: RosterSyncScope,
  payload: Record<string, unknown> = {},
): void {
  void syncSalonRoster(salonId, scope, payload).catch((err) =>
    logger.warn({ err, salonId, scope }, 'roster_sync_failed'),
  );
}

export async function notifyAppointmentBooked(
  salonId: string,
  appointmentId: string,
  summary: Record<string, unknown>,
): Promise<void> {
  await invalidatePattern(`cache:slots:${salonId}:*`);
  await emitAppointmentCreated(salonId, appointmentId, summary);
}

export function notifyAppointmentBookedLater(
  salonId: string,
  appointmentId: string,
  summary: Record<string, unknown>,
): void {
  void notifyAppointmentBooked(salonId, appointmentId, summary).catch((err) =>
    logger.warn({ err, salonId, appointmentId }, 'appointment_booked_notify_failed'),
  );
}

export async function notifyAppointmentChanged(
  salonId: string,
  appointmentId: string,
  changes: Record<string, unknown>,
): Promise<void> {
  await invalidatePattern(`cache:slots:${salonId}:*`);
  await emitAppointmentUpdated(salonId, appointmentId, changes);
}

export function notifyAppointmentChangedLater(
  salonId: string,
  appointmentId: string,
  changes: Record<string, unknown>,
): void {
  void notifyAppointmentChanged(salonId, appointmentId, changes).catch((err) =>
    logger.warn({ err, salonId, appointmentId }, 'appointment_changed_notify_failed'),
  );
}

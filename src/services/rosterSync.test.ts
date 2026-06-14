import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  invalidateServicesCache: vi.fn().mockResolvedValue(undefined),
  invalidateStaffCache: vi.fn().mockResolvedValue(undefined),
  invalidateBusinessHoursCache: vi.fn().mockResolvedValue(undefined),
  publishEvent: vi.fn().mockResolvedValue(undefined),
  invalidatePattern: vi.fn().mockResolvedValue(undefined),
  emitAppointmentCreated: vi.fn().mockResolvedValue(undefined),
  emitAppointmentUpdated: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./cachedQueries.js', () => ({
  invalidateServicesCache: mocks.invalidateServicesCache,
  invalidateStaffCache: mocks.invalidateStaffCache,
  invalidateBusinessHoursCache: mocks.invalidateBusinessHoursCache,
}));

vi.mock('../lib/eventBus.js', () => ({
  publishEvent: mocks.publishEvent,
  emitAppointmentCreated: mocks.emitAppointmentCreated,
  emitAppointmentUpdated: mocks.emitAppointmentUpdated,
}));

vi.mock('../lib/cache.js', () => ({
  invalidatePattern: mocks.invalidatePattern,
}));

import {
  syncSalonRoster,
  notifyAppointmentBooked,
  notifyAppointmentChanged,
} from './rosterSync.js';

describe('rosterSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('syncSalonRoster services scope invalidates cache and publishes', async () => {
    await syncSalonRoster('salon-1', 'services', { action: 'update' });

    expect(mocks.invalidateServicesCache).toHaveBeenCalledWith('salon-1');
    expect(mocks.publishEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'service.catalog_changed', salonId: 'salon-1' }),
    );
  });

  it('notifyAppointmentBooked clears slots and emits created', async () => {
    await notifyAppointmentBooked('salon-1', 'appt-1', { status: 'HELD' });

    expect(mocks.invalidatePattern).toHaveBeenCalledWith('cache:slots:salon-1:*');
    expect(mocks.emitAppointmentCreated).toHaveBeenCalledWith(
      'salon-1',
      'appt-1',
      expect.objectContaining({ status: 'HELD' }),
    );
  });

  it('notifyAppointmentChanged clears slots and emits updated', async () => {
    await notifyAppointmentChanged('salon-1', 'appt-1', { status: 'CANCELLED' });

    expect(mocks.invalidatePattern).toHaveBeenCalledWith('cache:slots:salon-1:*');
    expect(mocks.emitAppointmentUpdated).toHaveBeenCalledWith(
      'salon-1',
      'appt-1',
      expect.objectContaining({ status: 'CANCELLED' }),
    );
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  getTenantDb: vi.fn(),
  syncSalonRosterLater: vi.fn(),
}));

vi.mock('../lib/db/tenantSession.js', () => ({
  getTenantDb: mocks.getTenantDb,
}));

vi.mock('./rosterSync.js', () => ({
  syncSalonRosterLater: mocks.syncSalonRosterLater,
}));

import { removeServiceFromCatalog } from './serviceCatalog.js';

describe('removeServiceFromCatalog', () => {
  const user = { sub: 'user-1', salonId: 'salon-1' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('soft-deletes service and emits roster sync', async () => {
    const update = vi.fn().mockResolvedValue({});
    const db = {
      service: {
        findFirst: vi.fn().mockResolvedValue({ id: 'svc-1', salonId: 'salon-1' }),
        update,
      },
      appointment: { count: vi.fn().mockResolvedValue(2) },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    };
    mocks.getTenantDb.mockReturnValue(db);

    const result = await removeServiceFromCatalog(db as never, user, 'svc-1');

    expect(result).toEqual({ ok: true, hadAppointments: true });
    expect(update).toHaveBeenCalledWith({
      where: { id: 'svc-1' },
      data: expect.objectContaining({ active: false, deletedAt: expect.any(Date) }),
    });
    expect(mocks.syncSalonRosterLater).toHaveBeenCalledWith(
      'salon-1',
      'services',
      expect.objectContaining({ serviceId: 'svc-1' }),
    );
  });

  it('throws not_found when service missing', async () => {
    const db = {
      service: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    mocks.getTenantDb.mockReturnValue(db);

    await expect(removeServiceFromCatalog(db as never, user, 'missing')).rejects.toMatchObject({
      message: 'not_found',
      statusCode: 404,
    });
  });
});

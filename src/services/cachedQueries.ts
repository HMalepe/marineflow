import { getTenantDb } from '../lib/db/tenantSession.js';
import { cached, salonServicesKey, salonStaffKey, salonBusinessHoursKey, invalidateCache } from '../lib/cache.js';

/**
 * Cached service list for a salon. TTL 5 minutes.
 * Invalidated on service CRUD.
 */
export async function getCachedServices(salonId: string) {
  return cached(
    salonServicesKey(salonId),
    () =>
      getTenantDb().service.findMany({
        where: { salonId, active: true },
        orderBy: { sortOrder: 'asc' },
        include: { category: true },
      }),
    300,
  );
}

/**
 * Cached staff list for a salon. TTL 5 minutes.
 */
export async function getCachedStaff(salonId: string) {
  return cached(
    salonStaffKey(salonId),
    () =>
      getTenantDb().staff.findMany({
        where: { salonId, active: true, deletedAt: null },
        orderBy: { sortOrder: 'asc' },
      }),
    300,
  );
}

/**
 * Cached business hours for a salon. TTL 30 minutes.
 */
export async function getCachedBusinessHours(salonId: string) {
  return cached(
    salonBusinessHoursKey(salonId),
    () =>
      getTenantDb().businessHour.findMany({
        where: { salonId },
        orderBy: { dayOfWeek: 'asc' },
      }),
    1800,
  );
}

// ─── Invalidation helpers (call on write operations) ──────────────────

export async function invalidateServicesCache(salonId: string) {
  await invalidateCache(salonServicesKey(salonId));
}

export async function invalidateStaffCache(salonId: string) {
  await invalidateCache(salonStaffKey(salonId));
}

export async function invalidateBusinessHoursCache(salonId: string) {
  await invalidateCache(salonBusinessHoursKey(salonId));
}

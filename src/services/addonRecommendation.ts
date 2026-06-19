import type { AppointmentStatus } from '@prisma/client';
import { getTenantDb } from '../lib/db/tenantSession.js';

const COMPLETED_STATUSES: AppointmentStatus[] = ['CONFIRMED', 'CONFIRMED_PAID', 'COMPLETED'];
const MIN_COOCCURRENCES = 2;
const HISTORY_LIMIT = 100;

/**
 * Looks at a customer's past bookings to find a service they frequently book
 * alongside (same calendar day as) the service they just picked — e.g. a
 * customer who usually books Nails together with Hair. Used to nudge a
 * same-visit add-on suggestion without requiring admin-curated pairings.
 */
export async function getFrequentCoBookedService(params: {
  salonId: string;
  customerId: string;
  serviceId: string;
}): Promise<{ id: string; name: string; priceCents: number } | null> {
  const db = getTenantDb();
  const appointments = await db.appointment.findMany({
    where: {
      salonId: params.salonId,
      customerId: params.customerId,
      status: { in: COMPLETED_STATUSES },
    },
    select: { start: true, serviceId: true },
    orderBy: { start: 'desc' },
    take: HISTORY_LIMIT,
  });
  if (appointments.length < 2) return null;

  const servicesByDay = new Map<string, Set<string>>();
  for (const appt of appointments) {
    const day = appt.start.toISOString().slice(0, 10);
    const set = servicesByDay.get(day) ?? new Set<string>();
    set.add(appt.serviceId);
    servicesByDay.set(day, set);
  }

  const coOccurrenceCounts = new Map<string, number>();
  for (const sameDayServices of servicesByDay.values()) {
    if (!sameDayServices.has(params.serviceId) || sameDayServices.size < 2) continue;
    for (const serviceId of sameDayServices) {
      if (serviceId === params.serviceId) continue;
      coOccurrenceCounts.set(serviceId, (coOccurrenceCounts.get(serviceId) ?? 0) + 1);
    }
  }

  let bestServiceId: string | null = null;
  let bestCount = 0;
  for (const [serviceId, count] of coOccurrenceCounts) {
    if (count > bestCount) {
      bestServiceId = serviceId;
      bestCount = count;
    }
  }
  if (!bestServiceId || bestCount < MIN_COOCCURRENCES) return null;

  return db.service.findFirst({
    where: { id: bestServiceId, salonId: params.salonId, active: true, deletedAt: null },
    select: { id: true, name: true, priceCents: true },
  });
}

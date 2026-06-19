import type { PrismaTx } from '../../lib/db/tenantSession.js';

export type ServiceBookingStats = Record<string, { bookings30d: number }>;

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/** Appointment counts per service for the last 30 days (excludes cancelled/rescheduled). */
export async function getServiceBookingStats(
  db: PrismaTx,
  salonId: string,
): Promise<ServiceBookingStats> {
  const since = new Date(Date.now() - THIRTY_DAYS_MS);

  const rows = await db.appointment.groupBy({
    by: ['serviceId'],
    where: {
      salonId,
      createdAt: { gte: since },
      status: { notIn: ['CANCELLED', 'RESCHEDULED'] },
    },
    _count: { _all: true },
  });

  const stats: ServiceBookingStats = {};
  for (const row of rows) {
    stats[row.serviceId] = { bookings30d: row._count._all };
  }
  return stats;
}

import { getTenantDb } from '../lib/db/tenantSession.js';

export type NoShowRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

/** Statuses where staff should see a pre-visit confirmation risk cue. */
export const ACTIONABLE_APPOINTMENT_STATUSES = new Set([
  'CONFIRMED',
  'CONFIRMED_PAID',
  'HELD',
  'PENDING_PAYMENT',
]);

type DbClient = Pick<ReturnType<typeof getTenantDb>, 'customer'>;

export function normalizeNoShowRisk(value: string | null | undefined): NoShowRiskLevel {
  if (value === 'HIGH' || value === 'MEDIUM') return value;
  return 'LOW';
}

/** Pure risk calculation — exported for unit tests. */
export function computeNoShowRisk(noShowCount: number, bookingCount: number): NoShowRiskLevel {
  const shows = Math.max(0, noShowCount);
  const bookings = Math.max(0, bookingCount);
  if (bookings < 3) return 'LOW';
  // Clamp rate — data drift (noShowCount > bookingCount) must not produce NaN or under-score
  const rate = Math.min(shows / bookings, 1);
  if (rate >= 0.5) return 'HIGH';
  if (rate >= 0.25) return 'MEDIUM';
  return 'LOW';
}

export function formatNoShowRiskSummary(noShowCount: number, bookingCount: number): string {
  const shows = Math.max(0, noShowCount);
  const bookings = Math.max(0, bookingCount);
  return `Based on ${shows} no-show${shows === 1 ? '' : 's'} from ${bookings} booking${bookings === 1 ? '' : 's'}`;
}

export function shouldShowNoShowRiskBadge(
  risk: string | null | undefined,
  appointmentStatus: string,
): boolean {
  const level = normalizeNoShowRisk(risk);
  return (
    (level === 'MEDIUM' || level === 'HIGH') &&
    ACTIONABLE_APPOINTMENT_STATUSES.has(appointmentStatus)
  );
}

export async function recalculateNoShowRisk(
  customerId: string,
  db: DbClient = getTenantDb(),
): Promise<NoShowRiskLevel> {
  const customer = await db.customer.findUniqueOrThrow({
    where: { id: customerId },
    select: { noShowCount: true, bookingCount: true },
  });
  const risk = computeNoShowRisk(customer.noShowCount, customer.bookingCount);
  await db.customer.update({
    where: { id: customerId },
    data: { noShowRisk: risk },
  });
  return risk;
}

/** Increment no-show tally and refresh risk score (idempotent callers must guard). */
export async function recordCustomerNoShow(
  customerId: string,
  db: DbClient = getTenantDb(),
): Promise<NoShowRiskLevel> {
  await db.customer.update({
    where: { id: customerId },
    data: { noShowCount: { increment: 1 } },
  });
  return recalculateNoShowRisk(customerId, db);
}

/** Increment booking tally when a new appointment is committed. */
export async function incrementCustomerBookingCount(
  customerId: string,
  db: DbClient = getTenantDb(),
): Promise<NoShowRiskLevel> {
  await db.customer.update({
    where: { id: customerId },
    data: { bookingCount: { increment: 1 } },
  });
  return recalculateNoShowRisk(customerId, db);
}

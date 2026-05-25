import { DateTime } from 'luxon';
import { getTenantDb } from '../lib/db/tenantSession.js';
import type { Service, Staff, TimeOff, Appointment } from '@prisma/client';

const SLOT_STEP_MIN = 15;

export type Slot = { start: Date; end: Date };

function hasTimeOffConflict(staffId: string, start: Date, end: Date, timeOffs: TimeOff[]): boolean {
  return timeOffs.some((t) => t.staffId === staffId && t.start < end && t.end > start);
}

function hasAppointmentConflict(
  staffId: string,
  start: Date,
  end: Date,
  busy: Pick<Appointment, 'staffId' | 'start' | 'end'>[],
): boolean {
  return busy.some((b) => b.staffId === staffId && b.start < end && b.end > start);
}

/**
 * Build candidate slots for a calendar day (YYYY-MM-DD) in the salon's timezone.
 */
export async function getAvailableSlots(input: {
  salonId: string;
  service: Service;
  staff: Staff;
  localDateStr: string;
}): Promise<Slot[]> {
  const salon = await getTenantDb().salon.findUniqueOrThrow({
    where: { id: input.salonId },
    include: { businessHours: true },
  });
  const tz = salon.timezone;

  const dayStart = DateTime.fromISO(input.localDateStr, { zone: tz }).startOf('day');
  if (!dayStart.isValid) return [];

  /** 0=Sunday .. 6=Saturday (match Prisma BusinessHour.dayOfWeek) */
  const daySun0 = dayStart.weekday === 7 ? 0 : dayStart.weekday;

  const row = salon.businessHours.find((h) => h.dayOfWeek === daySun0);
  if (!row) return [];

  const open = dayStart.set({ hour: Math.floor(row.openMin / 60), minute: row.openMin % 60, second: 0 });
  const close = dayStart.set({
    hour: Math.floor(row.closeMin / 60),
    minute: row.closeMin % 60,
    second: 0,
  });

  const duration =
    input.service.durationMin + input.service.bufferMin + input.staff.breakMin;

  const openUtc = open.toUTC();
  const closeUtc = close.toUTC();

  const [timeOffs, appts] = await Promise.all([
    getTenantDb().timeOff.findMany({
      where: {
        staffId: input.staff.id,
        start: { lt: closeUtc.toJSDate() },
        end: { gt: openUtc.toJSDate() },
      },
    }),
    getTenantDb().appointment.findMany({
      where: {
        salonId: input.salonId,
        staffId: input.staff.id,
        start: { lt: closeUtc.toJSDate() },
        end: { gt: openUtc.toJSDate() },
        status: { notIn: ['CANCELLED'] },
      },
    }),
  ]);

  const slots: Slot[] = [];
  let cursor = openUtc;
  const closeJs = closeUtc.toJSDate();
  while (cursor.toMillis() <= DateTime.fromJSDate(closeJs).minus({ minutes: duration }).toMillis()) {
    const start = cursor.toJSDate();
    const end = cursor.plus({ minutes: duration }).toJSDate();
    if (end > closeJs) break;
    if (
      !hasTimeOffConflict(input.staff.id, start, end, timeOffs) &&
      !hasAppointmentConflict(input.staff.id, start, end, appts)
    ) {
      slots.push({ start, end });
    }
    cursor = cursor.plus({ minutes: SLOT_STEP_MIN });
  }
  return slots;
}

/** Next N calendar dates (YYYY-MM-DD) in salon TZ that have at least one slot possible (has business hours row). */
export async function suggestBookingDates(salonId: string, days = 14): Promise<string[]> {
  const salon = await getTenantDb().salon.findUniqueOrThrow({
    where: { id: salonId },
    include: { businessHours: true },
  });
  const tz = salon.timezone;
  const out: string[] = [];
  let d = DateTime.now().setZone(tz).startOf('day');
  for (let i = 0; i < days; i++) {
    const sun0 = d.weekday === 7 ? 0 : d.weekday;
    if (salon.businessHours.some((h) => h.dayOfWeek === sun0)) {
      out.push(d.toISODate()!);
    }
    d = d.plus({ days: 1 });
  }
  return out;
}

export async function getStaffForService(salonId: string, serviceId: string): Promise<Staff[]> {
  return getTenantDb().staff.findMany({
    where: {
      salonId,
      active: true,
      services: { some: { serviceId } },
    },
    orderBy: { name: 'asc' },
  });
}

import { DateTime } from 'luxon';
import { getTenantDb } from '../lib/db/tenantSession.js';
import type { Service, Staff, TimeOff, Appointment } from '@prisma/client';
import { parseAutomationsFromMetadata } from '../lib/automationSettings.js';

const SLOT_STEP_MIN = 15;

export type Slot = { start: Date; end: Date };

/** Returned by getAvailableSlots. `tooLong` is true when the service + buffers
 *  exceed the length of the business day — no amount of date-picking will help. */
export type AvailableSlotsResult = { slots: Slot[]; tooLong: boolean };

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
 * Returns { slots, tooLong } where tooLong = true means the service duration
 * exceeds the business-day length — no slots will ever be available on any day.
 */
export async function getAvailableSlots(input: {
  salonId: string;
  service: Service;
  staff: Staff;
  localDateStr: string;
}): Promise<AvailableSlotsResult> {
  const salon = await getTenantDb().salon.findUniqueOrThrow({
    where: { id: input.salonId },
    include: { businessHours: true },
  });
  const tz = salon.timezone;
  const automations = parseAutomationsFromMetadata(salon.metadata);
  const slotStep = automations.booking.slotIntervalMin;

  const dayStart = DateTime.fromISO(input.localDateStr, { zone: tz }).startOf('day');
  if (!dayStart.isValid) return { slots: [], tooLong: false };

  /** 0=Sunday .. 6=Saturday (match Prisma BusinessHour.dayOfWeek) */
  const daySun0 = dayStart.weekday === 7 ? 0 : dayStart.weekday;

  const row = salon.businessHours.find((h) => h.dayOfWeek === daySun0);
  if (!row) return { slots: [], tooLong: false };

  const duration = input.service.durationMin + input.service.bufferMin + input.staff.breakMin;

  // EC-11: if the total duration exceeds the business day, no slot can ever fit
  const businessDayMinutes = row.closeMin - row.openMin;
  if (duration > businessDayMinutes) {
    return { slots: [], tooLong: true };
  }

  const open = dayStart.set({ hour: Math.floor(row.openMin / 60), minute: row.openMin % 60, second: 0 });
  const close = dayStart.set({
    hour: Math.floor(row.closeMin / 60),
    minute: row.closeMin % 60,
    second: 0,
  });

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
        status: { notIn: ['CANCELLED', 'RESCHEDULED', 'NO_SHOW'] },
      },
    }),
  ]);

  const slots: Slot[] = [];
  const nowMs = Date.now();
  let cursor = openUtc;
  const closeJs = closeUtc.toJSDate();
  while (cursor.toMillis() <= DateTime.fromJSDate(closeJs).minus({ minutes: duration }).toMillis()) {
    const start = cursor.toJSDate();
    const end = cursor.plus({ minutes: duration }).toJSDate();
    if (end > closeJs) break;
    if (
      start.getTime() > nowMs &&
      !hasTimeOffConflict(input.staff.id, start, end, timeOffs) &&
      !hasAppointmentConflict(input.staff.id, start, end, appts)
    ) {
      slots.push({ start, end });
    }
    cursor = cursor.plus({ minutes: slotStep });
  }
  return { slots, tooLong: false };
}

/** Next N calendar dates (YYYY-MM-DD) in salon TZ that have at least one slot possible (has business hours row).
 *  Starts from tomorrow to avoid showing today when remaining slots may already be exhausted. */
export async function suggestBookingDates(salonId: string, days = 14): Promise<string[]> {
  const salon = await getTenantDb().salon.findUniqueOrThrow({
    where: { id: salonId },
    include: { businessHours: true },
  });
  const tz = salon.timezone;
  const out: string[] = [];
  // Start from tomorrow so we never offer today with potentially no remaining slots
  let d = DateTime.now().setZone(tz).startOf('day').plus({ days: 1 });
  for (let i = 0; i < days; i++) {
    const sun0 = d.weekday === 7 ? 0 : d.weekday;
    if (salon.businessHours.some((h) => h.dayOfWeek === sun0)) {
      out.push(d.toISODate()!);
    }
    d = d.plus({ days: 1 });
  }
  return out;
}

export async function getStaffForService(
  salonId: string,
  serviceId: string,
  branchId?: string,
): Promise<Staff[]> {
  return getTenantDb().staff.findMany({
    where: {
      salonId,
      active: true,
      isBookable: true,
      deletedAt: null,
      services: { some: { serviceId } },
      ...(branchId && { branchId }),
    },
    orderBy: { sortOrder: 'asc' },
  });
}

/**
 * Verify a slot is still available (no overlap) before final booking.
 * Returns true if the slot is free for the given staff member.
 */
export async function validateSlotAvailable(input: {
  salonId: string;
  staffId: string;
  start: Date;
  end: Date;
  excludeAppointmentId?: string;
}): Promise<boolean> {
  const conflict = await getTenantDb().appointment.findFirst({
    where: {
      salonId: input.salonId,
      staffId: input.staffId,
      id: input.excludeAppointmentId ? { not: input.excludeAppointmentId } : undefined,
      start: { lt: input.end },
      end: { gt: input.start },
      status: { notIn: ['CANCELLED', 'RESCHEDULED', 'NO_SHOW'] },
    },
  });
  return conflict === null;
}

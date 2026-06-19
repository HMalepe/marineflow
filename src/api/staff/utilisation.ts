import { DateTime } from 'luxon';
import type { PrismaTx } from '../../lib/db/tenantSession.js';

export type StaffUtilisationEntry = {
  staffId: string;
  bookedSlots: number;
  totalSlots: number;
  isIdle: boolean;
  isWorkingToday: boolean;
};

export type StaffUtilisationToday = {
  date: string;
  staff: StaffUtilisationEntry[];
};

function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function averageDurationMin(durations: number[], fallback: number): number {
  if (durations.length === 0) return fallback;
  return Math.max(1, Math.round(durations.reduce((a, b) => a + b, 0) / durations.length));
}

/** Today's booked vs available slot estimate per staff member. */
export async function getStaffUtilisationToday(
  db: PrismaTx,
  input: { salonId: string; branchId?: string },
): Promise<StaffUtilisationToday> {
  const salon = await db.salon.findUniqueOrThrow({
    where: { id: input.salonId },
    select: { timezone: true },
  });
  const tz = salon.timezone || 'Africa/Johannesburg';
  const todayLocal = DateTime.now().setZone(tz).startOf('day');
  const todayStr = todayLocal.toISODate()!;
  const weekday = todayLocal.weekday === 7 ? 0 : todayLocal.weekday;
  const dayStartUtc = todayLocal.toUTC().toJSDate();
  const dayEndUtc = todayLocal.endOf('day').toUTC().toJSDate();

  const [staffRows, salonServices, appointmentCounts] = await Promise.all([
    db.staff.findMany({
      where: {
        salonId: input.salonId,
        deletedAt: null,
        active: true,
        ...(input.branchId ? { branchId: input.branchId } : {}),
      },
      include: {
        workingHours: true,
        timeOff: {
          where: { start: { lte: dayEndUtc }, end: { gte: dayStartUtc } },
        },
        services: {
          include: {
            service: {
              select: { durationMin: true, bufferMin: true, active: true, deletedAt: true },
            },
          },
        },
      },
      orderBy: { sortOrder: 'asc' },
    }),
    db.service.findMany({
      where: { salonId: input.salonId, deletedAt: null, active: true },
      select: { durationMin: true, bufferMin: true },
    }),
    db.appointment.groupBy({
      by: ['staffId'],
      where: {
        salonId: input.salonId,
        start: { gte: dayStartUtc, lte: dayEndUtc },
        status: { notIn: ['CANCELLED', 'RESCHEDULED'] },
      },
      _count: { _all: true },
    }),
  ]);

  const bookedByStaff = new Map(appointmentCounts.map((r) => [r.staffId, r._count._all]));
  const salonAvgDuration = averageDurationMin(
    salonServices.map((s) => s.durationMin + s.bufferMin),
    60,
  );

  const staff: StaffUtilisationEntry[] = staffRows.map((s) => {
    const onTimeOff = s.timeOff.some(
      (t) => todayStr >= t.start.toISOString().slice(0, 10) && todayStr <= t.end.toISOString().slice(0, 10),
    );
    const wh = s.workingHours.find((w) => w.weekday === weekday);
    const workingMinutes =
      wh && !onTimeOff ? parseTimeToMinutes(wh.endTime) - parseTimeToMinutes(wh.startTime) : 0;

    const linkedDurations = s.services
      .filter((link) => link.service.active && !link.service.deletedAt)
      .map((link) => link.service.durationMin + link.service.bufferMin);
    const slotDuration = averageDurationMin(linkedDurations, salonAvgDuration);

    const totalSlots = workingMinutes > 0 ? Math.floor(workingMinutes / slotDuration) : 0;
    const bookedSlots = bookedByStaff.get(s.id) ?? 0;
    const isWorkingToday = totalSlots > 0;

    return {
      staffId: s.id,
      bookedSlots,
      totalSlots,
      isIdle: isWorkingToday && bookedSlots === 0,
      isWorkingToday,
    };
  });

  return { date: todayStr, staff };
}

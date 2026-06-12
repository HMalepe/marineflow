import { getTenantDb } from '../lib/db/tenantSession.js';
import type { Prisma } from '@prisma/client';
import { DEFAULT_BUSINESS_HOURS } from '../lib/salonDefaults.js';
import {
  businessRowsToStaffHours,
  businessRowsToWeeklySettings,
  parseHourOverrides,
  weeklyPayloadToBusinessRows,
  type WeeklyHoursSettings,
} from '../lib/businessHours.js';

export async function loadWeeklyHoursSettings(salonId: string): Promise<WeeklyHoursSettings> {
  const db = getTenantDb();
  const salon = await db.salon.findUniqueOrThrow({
    where: { id: salonId },
    select: {
      openTime: true,
      closeTime: true,
      timezone: true,
      metadata: true,
      businessHours: { orderBy: { dayOfWeek: 'asc' } },
    },
  });

  const metadata =
    salon.metadata && typeof salon.metadata === 'object' && !Array.isArray(salon.metadata)
      ? (salon.metadata as Record<string, unknown>)
      : {};
  const holidayOverrides = parseHourOverrides(metadata.hourOverrides);

  const rows =
    salon.businessHours.length > 0
      ? salon.businessHours.map((h) => ({
          dayOfWeek: h.dayOfWeek,
          openMin: h.openMin,
          closeMin: h.closeMin,
        }))
      : DEFAULT_BUSINESS_HOURS.map((h) => ({ ...h }));

  return businessRowsToWeeklySettings(
    rows,
    {
      openTime: salon.openTime ?? '09:00',
      closeTime: salon.closeTime ?? '17:00',
      timezone: salon.timezone,
    },
    holidayOverrides,
  );
}

export async function saveWeeklyHoursSettings(
  salonId: string,
  settings: WeeklyHoursSettings,
  options: { syncRoster?: boolean } = {},
): Promise<WeeklyHoursSettings> {
  const db = getTenantDb();
  const rows = weeklyPayloadToBusinessRows(settings);

  const salon = await db.salon.findUniqueOrThrow({
    where: { id: salonId },
    select: { metadata: true },
  });
  const existingMeta =
    salon.metadata && typeof salon.metadata === 'object' && !Array.isArray(salon.metadata)
      ? (salon.metadata as Record<string, unknown>)
      : {};

  await db.businessHour.deleteMany({ where: { salonId } });
  if (rows.length > 0) {
    await db.businessHour.createMany({
      data: rows.map((r) => ({
        salonId,
        dayOfWeek: r.dayOfWeek,
        openMin: r.openMin,
        closeMin: r.closeMin,
      })),
    });
  }

  await db.salon.update({
    where: { id: salonId },
    data: {
      openTime: settings.weekdayOpen,
      closeTime: settings.weekdayClose,
      timezone: settings.timezone,
      metadata: {
        ...existingMeta,
        hourOverrides: settings.holidayOverrides,
      } as Prisma.InputJsonValue,
    },
  });

  if (options.syncRoster !== false) {
    await syncAllStaffWorkingHours(salonId, rows);
  }

  return settings;
}

export async function syncAllStaffWorkingHours(
  salonId: string,
  rows?: { dayOfWeek: number; openMin: number; closeMin: number }[],
): Promise<void> {
  const db = getTenantDb();
  let businessRows = rows;
  if (!businessRows) {
    const loaded = await db.businessHour.findMany({
      where: { salonId },
      orderBy: { dayOfWeek: 'asc' },
    });
    businessRows = loaded.map((h) => ({
      dayOfWeek: h.dayOfWeek,
      openMin: h.openMin,
      closeMin: h.closeMin,
    }));
  }

  const staffHours = businessRowsToStaffHours(businessRows);
  const staff = await db.staff.findMany({
    where: { salonId, deletedAt: null },
    select: { id: true },
  });

  for (const member of staff) {
    await db.workingHour.deleteMany({ where: { staffId: member.id } });
    if (staffHours.length > 0) {
      await db.workingHour.createMany({
        data: staffHours.map((h) => ({
          salonId,
          staffId: member.id,
          weekday: h.weekday,
          startTime: h.startTime,
          endTime: h.endTime,
        })),
      });
    }
  }
}

export async function seedStaffWorkingHoursFromBusiness(
  salonId: string,
  staffId: string,
): Promise<void> {
  const db = getTenantDb();
  const rows = await db.businessHour.findMany({
    where: { salonId },
    orderBy: { dayOfWeek: 'asc' },
  });
  if (rows.length === 0) return;

  const staffHours = businessRowsToStaffHours(
    rows.map((h) => ({ dayOfWeek: h.dayOfWeek, openMin: h.openMin, closeMin: h.closeMin })),
  );
  await db.workingHour.createMany({
    data: staffHours.map((h) => ({
      salonId,
      staffId,
      weekday: h.weekday,
      startTime: h.startTime,
      endTime: h.endTime,
    })),
  });
}

/** Shared salon business-hours helpers (weekly grid + holiday overrides). */

export type HourOverrideKey = 'publicHoliday' | 'christmas' | 'newYearsEve' | 'newYearsDay';

export interface HourOverride {
  closed: boolean;
  open?: string;
  close?: string;
}

export type HourOverrides = Partial<Record<HourOverrideKey, HourOverride>>;

export interface BusinessHourRow {
  dayOfWeek: number;
  openMin: number;
  closeMin: number;
}

export interface WeeklyHoursSettings {
  weekdayOpen: string;
  weekdayClose: string;
  saturday: { closed: boolean; open: string; close: string };
  sunday: { closed: boolean; open: string; close: string };
  timezone: string;
  holidayOverrides: HourOverrides;
}

export const HOUR_OVERRIDE_LABELS: Record<HourOverrideKey, string> = {
  publicHoliday: 'Public holidays',
  christmas: 'Christmas Day (25 Dec)',
  newYearsEve: "New Year's Eve (31 Dec)",
  newYearsDay: "New Year's Day (1 Jan)",
};

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function minutesToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function isValidTime(time: string): boolean {
  return TIME_RE.test(time);
}

export function parseHourOverrides(raw: unknown): HourOverrides {
  if (!raw || typeof raw !== 'object') return {};
  const out: HourOverrides = {};
  for (const key of Object.keys(HOUR_OVERRIDE_LABELS) as HourOverrideKey[]) {
    const v = (raw as Record<string, unknown>)[key];
    if (!v || typeof v !== 'object') continue;
    const closed = Boolean((v as HourOverride).closed);
    const open = typeof (v as HourOverride).open === 'string' ? (v as HourOverride).open : undefined;
    const close = typeof (v as HourOverride).close === 'string' ? (v as HourOverride).close : undefined;
    out[key] = { closed, open, close };
  }
  return out;
}

export function weeklyPayloadToBusinessRows(settings: WeeklyHoursSettings): BusinessHourRow[] {
  const rows: BusinessHourRow[] = [];
  for (let day = 1; day <= 5; day++) {
    rows.push({
      dayOfWeek: day,
      openMin: timeToMinutes(settings.weekdayOpen),
      closeMin: timeToMinutes(settings.weekdayClose),
    });
  }
  if (!settings.saturday.closed) {
    rows.push({
      dayOfWeek: 6,
      openMin: timeToMinutes(settings.saturday.open),
      closeMin: timeToMinutes(settings.saturday.close),
    });
  }
  if (!settings.sunday.closed) {
    rows.push({
      dayOfWeek: 0,
      openMin: timeToMinutes(settings.sunday.open),
      closeMin: timeToMinutes(settings.sunday.close),
    });
  }
  return rows;
}

export function businessRowsToWeeklySettings(
  rows: BusinessHourRow[],
  fallback: { openTime: string; closeTime: string; timezone: string },
  holidayOverrides: HourOverrides = {},
): WeeklyHoursSettings {
  const byDay = new Map(rows.map((r) => [r.dayOfWeek, r]));
  const weekday = byDay.get(1);
  const sat = byDay.get(6);
  const sun = byDay.get(0);

  return {
    weekdayOpen: weekday ? minutesToTime(weekday.openMin) : fallback.openTime,
    weekdayClose: weekday ? minutesToTime(weekday.closeMin) : fallback.closeTime,
    saturday: sat
      ? {
          closed: false,
          open: minutesToTime(sat.openMin),
          close: minutesToTime(sat.closeMin),
        }
      : { closed: true, open: fallback.openTime, close: fallback.closeTime },
    sunday: sun
      ? {
          closed: false,
          open: minutesToTime(sun.openMin),
          close: minutesToTime(sun.closeMin),
        }
      : { closed: true, open: fallback.openTime, close: fallback.closeTime },
    timezone: fallback.timezone,
    holidayOverrides,
  };
}

export function businessRowsToStaffHours(rows: BusinessHourRow[]): {
  weekday: number;
  startTime: string;
  endTime: string;
}[] {
  return rows.map((r) => ({
    weekday: r.dayOfWeek,
    startTime: minutesToTime(r.openMin),
    endTime: minutesToTime(r.closeMin),
  }));
}

export function businessRowsToScheduleDefaults(rows: BusinessHourRow[]): {
  weekday: number;
  enabled: boolean;
  startTime: string;
  endTime: string;
}[] {
  const byDay = new Map(rows.map((r) => [r.dayOfWeek, r]));
  return [0, 1, 2, 3, 4, 5, 6].map((weekday) => {
    const row = byDay.get(weekday);
    return row
      ? {
          weekday,
          enabled: true,
          startTime: minutesToTime(row.openMin),
          endTime: minutesToTime(row.closeMin),
        }
      : { weekday, enabled: false, startTime: '09:00', endTime: '17:00' };
  });
}

export function validateWeeklyHoursSettings(settings: WeeklyHoursSettings): string | null {
  if (!isValidTime(settings.weekdayOpen) || !isValidTime(settings.weekdayClose)) {
    return 'Use HH:MM for weekday hours.';
  }
  if (settings.weekdayOpen >= settings.weekdayClose) {
    return 'Weekday close time must be after open time.';
  }
  if (!settings.saturday.closed) {
    if (!isValidTime(settings.saturday.open) || !isValidTime(settings.saturday.close)) {
      return 'Use HH:MM for Saturday hours.';
    }
    if (settings.saturday.open >= settings.saturday.close) {
      return 'Saturday close time must be after open time.';
    }
  }
  if (!settings.sunday.closed) {
    if (!isValidTime(settings.sunday.open) || !isValidTime(settings.sunday.close)) {
      return 'Use HH:MM for Sunday hours.';
    }
    if (settings.sunday.open >= settings.sunday.close) {
      return 'Sunday close time must be after open time.';
    }
  }
  for (const key of Object.keys(HOUR_OVERRIDE_LABELS) as HourOverrideKey[]) {
    const o = settings.holidayOverrides[key];
    if (!o || o.closed) continue;
    if (!o.open || !o.close || !isValidTime(o.open) || !isValidTime(o.close)) {
      return `${HOUR_OVERRIDE_LABELS[key]}: use HH:MM or mark closed.`;
    }
    if (o.open >= o.close) {
      return `${HOUR_OVERRIDE_LABELS[key]}: close must be after open.`;
    }
  }
  return null;
}

export const DEFAULT_WEEKLY_HOURS: WeeklyHoursSettings = {
  weekdayOpen: '09:00',
  weekdayClose: '17:00',
  saturday: { closed: false, open: '09:00', close: '17:00' },
  sunday: { closed: true, open: '09:00', close: '17:00' },
  timezone: 'Africa/Johannesburg',
  holidayOverrides: {
    publicHoliday: { closed: true },
    christmas: { closed: true },
    newYearsEve: { closed: true },
    newYearsDay: { closed: true },
  },
};

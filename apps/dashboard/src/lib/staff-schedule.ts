/** Shared staff schedule types and helpers (roster + team views). */

export interface WorkingHour {
  id: string;
  weekday: number; // 0=Sun … 6=Sat
  startTime: string;
  endTime: string;
}

export interface TimeOffBlock {
  id: string;
  start: string;
  end: string;
  reason: string | null;
}

export interface StaffMember {
  id: string;
  name: string;
  displayName: string | null;
  bio?: string | null;
  avatarUrl: string | null;
  active: boolean;
  isBookable: boolean;
  specialties?: string[];
  workingHours: WorkingHour[];
  timeOff: TimeOffBlock[];
}

export interface ScheduleDay {
  weekday: number;
  enabled: boolean;
  startTime: string;
  endTime: string;
}

export type ShiftClipboard = {
  enabled: boolean;
  startTime: string;
  endTime: string;
};

export const DAY_LABELS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DAY_LABELS_MON = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
/** JS getDay() for each Mon-first column */
export const DAY_JS_MON = [1, 2, 3, 4, 5, 6, 0];

export const SHIFT_PRESETS: { label: string; start: string; end: string }[] = [
  { label: '8–6', start: '08:00', end: '18:00' },
  { label: '9–5', start: '09:00', end: '17:00' },
  { label: '10–4', start: '10:00', end: '16:00' },
];

export const DEFAULT_SCHEDULE: ScheduleDay[] = [
  { weekday: 0, enabled: false, startTime: '09:00', endTime: '17:00' },
  { weekday: 1, enabled: true, startTime: '09:00', endTime: '17:00' },
  { weekday: 2, enabled: true, startTime: '09:00', endTime: '17:00' },
  { weekday: 3, enabled: true, startTime: '09:00', endTime: '17:00' },
  { weekday: 4, enabled: true, startTime: '09:00', endTime: '17:00' },
  { weekday: 5, enabled: true, startTime: '09:00', endTime: '17:00' },
  { weekday: 6, enabled: false, startTime: '09:00', endTime: '17:00' },
];

/** Local timezone YYYY-MM-DD */
export function toIso(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

export function getMonday(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
}

export function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

export function inRange(dateStr: string, start: string, end: string): boolean {
  return dateStr >= start && dateStr <= end;
}

export function workingHoursToSchedule(hours: WorkingHour[]): ScheduleDay[] {
  return DEFAULT_SCHEDULE.map((d) => {
    const match = hours.find((h) => h.weekday === d.weekday);
    return match
      ? { weekday: d.weekday, enabled: true, startTime: match.startTime, endTime: match.endTime }
      : { ...d, enabled: false };
  });
}

export function scheduleToPayload(schedule: ScheduleDay[]) {
  return schedule
    .filter((d) => d.enabled)
    .map(({ weekday, startTime, endTime }) => ({ weekday, startTime, endTime }));
}

/** Apply a shift to selected weekdays in a schedule copy. */
export function applyShiftToWeekdays(
  schedule: ScheduleDay[],
  weekdays: number[],
  shift: ShiftClipboard,
): ScheduleDay[] {
  const set = new Set(weekdays);
  return schedule.map((d) =>
    set.has(d.weekday)
      ? {
          weekday: d.weekday,
          enabled: shift.enabled,
          startTime: shift.startTime,
          endTime: shift.endTime,
        }
      : d,
  );
}

export function weekdaysMonFri(): number[] {
  return [1, 2, 3, 4, 5];
}

export function weekdaysRestOfWeekFrom(weekday: number): number[] {
  const out: number[] = [];
  for (let w = weekday; w <= 6; w++) out.push(w);
  return out;
}

export function allWeekdays(): number[] {
  return [0, 1, 2, 3, 4, 5, 6];
}

export function fmtShort(d: Date): string {
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

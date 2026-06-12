import { describe, expect, it } from 'vitest';
import {
  applyShiftToWeekdays,
  DEFAULT_SCHEDULE,
  getMonday,
  inRange,
  scheduleToPayload,
  toIso,
  weekdaysMonFri,
  workingHoursToSchedule,
  type WorkingHour,
} from './staff-schedule.js';

describe('staff roster scheduling (user edge cases)', () => {
  it('opens the current week when the owner views roster on Sunday', () => {
    // User opens dashboard on Sunday 7 Jun 2026 — should show Mon 1 Jun, not next Mon 8 Jun
    const sunday = new Date(2026, 5, 7);
    sunday.setHours(0, 0, 0, 0);
    const monday = getMonday(sunday);
    expect(toIso(monday)).toBe('2026-06-01');
  });

  it('shows leave on Fri–Mon when staff booked Thu–Mon off', () => {
    const leave = { start: '2026-06-04', end: '2026-06-07' }; // Thu–Sun block
    expect(inRange('2026-06-03', leave.start, leave.end)).toBe(false); // Wed — still working
    expect(inRange('2026-06-04', leave.start, leave.end)).toBe(true); // Thu — first leave day
    expect(inRange('2026-06-07', leave.start, leave.end)).toBe(true); // Sun — last leave day
    expect(inRange('2026-06-08', leave.start, leave.end)).toBe(false); // Mon after — back
  });

  it('clears Mon–Fri only when manager pastes a day-off shift', () => {
    const base = workingHoursToSchedule([
      { id: '1', weekday: 1, startTime: '09:00', endTime: '17:00' },
      { id: '2', weekday: 2, startTime: '09:00', endTime: '17:00' },
      { id: '3', weekday: 6, startTime: '10:00', endTime: '14:00' }, // Sat half-day
    ]);
    const next = applyShiftToWeekdays(base, weekdaysMonFri(), {
      enabled: false,
      startTime: '09:00',
      endTime: '17:00',
    });
    const payload = scheduleToPayload(next);
    expect(payload).toEqual([{ weekday: 6, startTime: '10:00', endTime: '14:00' }]);
    expect(next.find((d) => d.weekday === 1)?.enabled).toBe(false);
  });

  it('keeps other weekdays unchanged when editing only Tuesday hours', () => {
    const hours: WorkingHour[] = [
      { id: '1', weekday: 1, startTime: '08:00', endTime: '18:00' },
      { id: '2', weekday: 2, startTime: '09:00', endTime: '17:00' },
    ];
    const base = workingHoursToSchedule(hours);
    const next = applyShiftToWeekdays(base, [2], { enabled: true, startTime: '10:00', endTime: '16:00' });
    expect(next.find((d) => d.weekday === 1)).toMatchObject({ enabled: true, startTime: '08:00', endTime: '18:00' });
    expect(next.find((d) => d.weekday === 2)).toMatchObject({ enabled: true, startTime: '10:00', endTime: '16:00' });
    expect(next.find((d) => d.weekday === 0)?.enabled).toBe(false);
  });

  it('shows all days off for brand-new staff with no saved hours', () => {
    const schedule = workingHoursToSchedule([]);
    expect(schedule.every((d) => !d.enabled)).toBe(true);
    expect(scheduleToPayload(schedule)).toEqual([]);
    expect(schedule).toHaveLength(DEFAULT_SCHEDULE.length);
  });
});

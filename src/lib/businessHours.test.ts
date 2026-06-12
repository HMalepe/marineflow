import { describe, expect, it } from 'vitest';
import {
  businessRowsToStaffHours,
  businessRowsToWeeklySettings,
  validateWeeklyHoursSettings,
  weeklyPayloadToBusinessRows,
  DEFAULT_WEEKLY_HOURS,
} from './businessHours.js';

describe('weeklyPayloadToBusinessRows', () => {
  it('maps Mon–Fri, open Saturday, closed Sunday', () => {
    const rows = weeklyPayloadToBusinessRows({
      ...DEFAULT_WEEKLY_HOURS,
      weekdayOpen: '08:00',
      weekdayClose: '18:00',
      saturday: { closed: false, open: '09:00', close: '14:00' },
      sunday: { closed: true, open: '09:00', close: '17:00' },
    });
    expect(rows).toHaveLength(6);
    expect(rows.filter((r) => r.dayOfWeek >= 1 && r.dayOfWeek <= 5).every((r) => r.openMin === 8 * 60)).toBe(true);
    expect(rows.find((r) => r.dayOfWeek === 6)?.closeMin).toBe(14 * 60);
    expect(rows.some((r) => r.dayOfWeek === 0)).toBe(false);
  });
});

describe('businessRowsToStaffHours', () => {
  it('converts rows to roster HH:MM shifts', () => {
    const hours = businessRowsToStaffHours([{ dayOfWeek: 1, openMin: 540, closeMin: 1020 }]);
    expect(hours).toEqual([{ weekday: 1, startTime: '09:00', endTime: '17:00' }]);
  });
});

describe('validateWeeklyHoursSettings', () => {
  it('rejects weekday close before open', () => {
    expect(
      validateWeeklyHoursSettings({
        ...DEFAULT_WEEKLY_HOURS,
        weekdayOpen: '18:00',
        weekdayClose: '08:00',
      }),
    ).toMatch(/Weekday close/);
  });

  it('allows draft-style closed Sunday', () => {
    expect(validateWeeklyHoursSettings(DEFAULT_WEEKLY_HOURS)).toBeNull();
  });
});

describe('businessRowsToWeeklySettings round-trip', () => {
  it('preserves Saturday hours', () => {
    const rows = weeklyPayloadToBusinessRows(DEFAULT_WEEKLY_HOURS);
    const restored = businessRowsToWeeklySettings(rows, {
      openTime: '09:00',
      closeTime: '17:00',
      timezone: 'Africa/Johannesburg',
    });
    expect(restored.saturday.closed).toBe(false);
    expect(restored.sunday.closed).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import {
  formatMinutesAsHm,
  localDayOfWeekSun0,
  localMinutesNow,
} from './businessHoursStatus.js';

describe('businessHoursStatus helpers', () => {
  it('formats minutes as HH:MM', () => {
    expect(formatMinutesAsHm(9 * 60)).toBe('09:00');
    expect(formatMinutesAsHm(17 * 60 + 30)).toBe('17:30');
  });

  it('maps Johannesburg weekday correctly', () => {
    // Monday 2026-07-20 10:00 SAST
    const mon = new Date('2026-07-20T08:00:00.000Z');
    expect(localDayOfWeekSun0(mon, 'Africa/Johannesburg')).toBe(1);
    expect(localMinutesNow(mon, 'Africa/Johannesburg')).toBe(10 * 60);
  });
});

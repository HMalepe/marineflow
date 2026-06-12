import { describe, expect, it } from 'vitest';
import { DateTime } from 'luxon';
import {
  BIRTHDAY_TREAT_WINDOW_DAYS,
  birthdayPartsForTimezone,
  buildBirthdayBody,
  buildWinbackBody,
  isOutboundDelivered,
  isWithinBirthdayWindow,
} from './outboundCampaigns.js';

const TZ = 'Africa/Johannesburg';

/** DOB stored as midnight UTC of the calendar date (matches bot profile save). */
function dobUtc(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d));
}

describe('isOutboundDelivered', () => {
  it('returns true only when providerMessageId is set', () => {
    expect(isOutboundDelivered({ providerMessageId: 'SM123' })).toBe(true);
    expect(isOutboundDelivered({ providerMessageId: null })).toBe(false);
    expect(isOutboundDelivered({ providerMessageId: '' })).toBe(false);
  });
});

describe('buildWinbackBody', () => {
  it('personalises name and includes booking + STOP instructions', () => {
    const body = buildWinbackBody('Thandi', 'Glow Salon');
    expect(body).toContain('Hey Thandi!');
    expect(body).toContain('Glow Salon');
    expect(body).toContain('reply 1');
    expect(body).toContain('STOP');
  });

  it('falls back to "there" when firstName is null', () => {
    expect(buildWinbackBody(null, 'Glow Salon')).toContain('Hey there!');
  });
});

describe('buildBirthdayBody', () => {
  it('includes BIRTHDAY treat keyword', () => {
    expect(buildBirthdayBody('Sam', 'Glow Salon')).toContain('reply BIRTHDAY');
  });
});

describe('isWithinBirthdayWindow', () => {
  it('accepts on the exact birthday', () => {
    const dob = dobUtc(1990, 6, 15);
    const now = DateTime.fromObject({ year: 2026, month: 6, day: 15 }, { zone: TZ });
    expect(isWithinBirthdayWindow(dob, TZ, BIRTHDAY_TREAT_WINDOW_DAYS, now)).toBe(true);
  });

  it('accepts 7 days before and after', () => {
    const dob = dobUtc(1985, 3, 10);
    const before = DateTime.fromObject({ year: 2026, month: 3, day: 3 }, { zone: TZ });
    const after = DateTime.fromObject({ year: 2026, month: 3, day: 17 }, { zone: TZ });
    expect(isWithinBirthdayWindow(dob, TZ, 7, before)).toBe(true);
    expect(isWithinBirthdayWindow(dob, TZ, 7, after)).toBe(true);
  });

  it('rejects 8+ days away', () => {
    const dob = dobUtc(1992, 7, 20);
    const tooEarly = DateTime.fromObject({ year: 2026, month: 7, day: 12 }, { zone: TZ });
    const tooLate = DateTime.fromObject({ year: 2026, month: 7, day: 28 }, { zone: TZ });
    expect(isWithinBirthdayWindow(dob, TZ, 7, tooEarly)).toBe(false);
    expect(isWithinBirthdayWindow(dob, TZ, 7, tooLate)).toBe(false);
  });

  it('handles year boundary (Dec 30 for Jan 2 birthday)', () => {
    const dob = dobUtc(2000, 1, 2);
    const dec30 = DateTime.fromObject({ year: 2025, month: 12, day: 30 }, { zone: TZ });
    expect(isWithinBirthdayWindow(dob, TZ, 7, dec30)).toBe(true);
  });

  it('celebrates 29 Feb birthdays on 28 Feb in non-leap years', () => {
    const dob = dobUtc(2000, 2, 29);
    const feb28 = DateTime.fromObject({ year: 2025, month: 2, day: 28 }, { zone: TZ });
    expect(isWithinBirthdayWindow(dob, TZ, 7, feb28)).toBe(true);
  });

  it('accepts 29 Feb on leap years', () => {
    const dob = dobUtc(2000, 2, 29);
    const feb29 = DateTime.fromObject({ year: 2024, month: 2, day: 29 }, { zone: TZ });
    expect(isWithinBirthdayWindow(dob, TZ, 7, feb29)).toBe(true);
  });
});

describe('birthdayPartsForTimezone', () => {
  it('flags leap-day inclusion on 28 Feb non-leap year', () => {
    const feb28 = DateTime.fromObject({ year: 2025, month: 2, day: 28 }, { zone: TZ });
    expect(birthdayPartsForTimezone(TZ, feb28)).toEqual({
      month: 2,
      day: 28,
      includeLeapDay: true,
    });
  });

  it('does not include leap-day on 28 Feb leap year', () => {
    const feb28 = DateTime.fromObject({ year: 2024, month: 2, day: 28 }, { zone: TZ });
    expect(birthdayPartsForTimezone(TZ, feb28).includeLeapDay).toBe(false);
  });
});

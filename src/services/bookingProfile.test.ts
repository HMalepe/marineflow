import { describe, expect, it } from 'vitest';

const PROFILE_NAME_REGEX = /^[a-zA-Z\s'-]{1,80}$/;
const PROFILE_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseDOB(text: string): Date | null {
  const t = text.trim();
  const slash = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    const d = parseInt(slash[1]!), m = parseInt(slash[2]!), y = parseInt(slash[3]!);
    const date = new Date(y, m - 1, d);
    if (date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d) return date;
  }
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const y = parseInt(iso[1]!), m = parseInt(iso[2]!), d = parseInt(iso[3]!);
    const date = new Date(y, m - 1, d);
    if (date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d) return date;
  }
  return null;
}

function validateDOBAge(dob: Date): string | null {
  const now = new Date();
  if (dob > now) return 'Date of birth cannot be in the future. Please try again.';
  const age =
    now.getFullYear() -
    dob.getFullYear() -
    (now.getMonth() < dob.getMonth() ||
    (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate())
      ? 1
      : 0);
  if (age > 120) return 'Please enter a valid date of birth.';
  return null;
}

describe('booking profile name validation', () => {
  it('accepts valid names', () => {
    expect(PROFILE_NAME_REGEX.test('John')).toBe(true);
    expect(PROFILE_NAME_REGEX.test("O'Brien")).toBe(true);
    expect(PROFILE_NAME_REGEX.test('Mary-Jane')).toBe(true);
    expect(PROFILE_NAME_REGEX.test('Van Der Berg')).toBe(true);
  });

  it('rejects invalid names', () => {
    expect(PROFILE_NAME_REGEX.test('John3')).toBe(false);
    expect(PROFILE_NAME_REGEX.test('')).toBe(false);
    expect(PROFILE_NAME_REGEX.test('@lex')).toBe(false);
    expect(PROFILE_NAME_REGEX.test('1234')).toBe(false);
  });
});

describe('booking profile email validation', () => {
  it('accepts valid emails', () => {
    expect(PROFILE_EMAIL_REGEX.test('user@example.com')).toBe(true);
    expect(PROFILE_EMAIL_REGEX.test('user+tag@sub.domain.co.za')).toBe(true);
  });

  it('rejects invalid emails', () => {
    expect(PROFILE_EMAIL_REGEX.test('not-an-email')).toBe(false);
    expect(PROFILE_EMAIL_REGEX.test('@missing.com')).toBe(false);
    expect(PROFILE_EMAIL_REGEX.test('no-at-sign')).toBe(false);
  });
});

describe('date of birth parsing', () => {
  it('parses DD/MM/YYYY', () => {
    const d = parseDOB('15/06/1990');
    expect(d).not.toBeNull();
    expect(d?.getFullYear()).toBe(1990);
    expect(d?.getMonth()).toBe(5);
    expect(d?.getDate()).toBe(15);
  });

  it('parses YYYY-MM-DD', () => {
    const d = parseDOB('1990-06-15');
    expect(d).not.toBeNull();
    expect(d?.getFullYear()).toBe(1990);
  });

  it('rejects impossible dates', () => {
    expect(parseDOB('31/02/1990')).toBeNull();
    expect(parseDOB('00/13/1990')).toBeNull();
    expect(parseDOB('not a date')).toBeNull();
  });

  it('trims whitespace before parsing', () => {
    expect(parseDOB('  15/06/1990  ')).not.toBeNull();
  });
});

describe('date of birth age validation', () => {
  it('rejects future dates', () => {
    const future = new Date(Date.now() + 86400 * 1000);
    expect(validateDOBAge(future)).toMatch(/future/i);
  });

  it('rejects ages over 120', () => {
    expect(validateDOBAge(new Date('1850-01-01'))).toMatch(/valid/i);
  });

  it('accepts a normal adult dob', () => {
    expect(validateDOBAge(new Date('1990-06-15'))).toBeNull();
  });

  it('accepts a newborn (age 0)', () => {
    const today = new Date();
    expect(validateDOBAge(today)).toBeNull();
  });
});

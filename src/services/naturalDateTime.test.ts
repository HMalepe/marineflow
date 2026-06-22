import { describe, expect, it } from 'vitest';
import { isDateMenuNumber, parseNaturalDateTime } from './naturalDateTime.js';

describe('isDateMenuNumber', () => {
  it('accepts pure menu numbers only', () => {
    expect(isDateMenuNumber('3', 10)).toBe(3);
    expect(isDateMenuNumber('Saturday', 10)).toBeNull();
    expect(isDateMenuNumber('30/08', 10)).toBeNull();
    expect(isDateMenuNumber('15 July', 10)).toBeNull();
  });
});

describe('parseNaturalDateTime — deterministic', () => {
  const tz = 'Africa/Johannesburg';

  it('parses tomorrow with time', async () => {
    const result = await parseNaturalDateTime('tomorrow at 3pm', tz);
    expect(result?.localDateStr).toBeTruthy();
    expect(result?.hour).toBe(15);
  });

  it('parses DD/MM without year', async () => {
    const result = await parseNaturalDateTime('25/12', tz);
    expect(result?.localDateStr).toMatch(/^\d{4}-12-25$/);
  });

  it('parses weekday with time', async () => {
    const result = await parseNaturalDateTime('Saturday 15:00', tz);
    expect(result?.localDateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result?.hour).toBe(15);
  });

  it('does not collapse "Saturday in October" to the nearest Saturday', async () => {
    // Regression: the weekday regex used to ignore the month name and return
    // the nearest upcoming Saturday, silently dropping "in October" entirely.
    // No ANTHROPIC_API_KEY in the test env, so this must fall through to null
    // rather than guess — never a confidently wrong date.
    const result = await parseNaturalDateTime('first weekend on Saturday in October', tz);
    expect(result).toBeNull();
  });
});

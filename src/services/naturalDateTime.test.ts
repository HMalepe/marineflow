import { describe, expect, it } from 'vitest';
import { isDateMenuNumber, parseNaturalDateTime, parsePartyCount } from './naturalDateTime.js';

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
});

describe('parsePartyCount', () => {
  it('detects "myself and my X" as 2', () => {
    expect(parsePartyCount('High top fade next Friday at 3pm for myself and my 9 year old')).toBe(2);
    expect(parsePartyCount('me and my son want a cut')).toBe(2);
  });

  it('counts extra "and" clauses for 3+ people', () => {
    expect(parsePartyCount('myself and my son and my wife')).toBe(3);
  });

  it('parses explicit headcount phrases', () => {
    expect(parsePartyCount('book a table for 4 people')).toBe(4);
    expect(parsePartyCount('for 3 of us please')).toBe(3);
  });

  it('never fires on a bare "me" or a service conjunction', () => {
    expect(parsePartyCount('remind me tomorrow at 3pm')).toBe(1);
    expect(parsePartyCount('cut and colour please')).toBe(1);
    expect(parsePartyCount('high top fade and a beard trim')).toBe(1);
  });
});

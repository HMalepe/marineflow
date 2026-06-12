import { describe, expect, it } from 'vitest';
import { clampRosterEnd, parseRosterDate, ROSTER_MAX_DAYS } from './rosterRange.js';

describe('roster API date range (user edge cases)', () => {
  it('falls back when owner bookmarks a broken ?from= query string', () => {
    const fallback = new Date('2026-06-01T12:00:00.000Z');
    expect(parseRosterDate('not-a-date', fallback).toISOString()).toBe(fallback.toISOString());
    expect(parseRosterDate(undefined, fallback).toISOString()).toBe(fallback.toISOString());
  });

  it('caps a 26-week scroll request to 31 days so the calendar stays responsive', () => {
    const from = new Date('2026-01-01T00:00:00.000Z');
    const farTo = new Date('2026-07-01T00:00:00.000Z');
    const clamped = clampRosterEnd(from, farTo);
    const diffDays = Math.round((clamped.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
    expect(diffDays).toBe(ROSTER_MAX_DAYS - 1);
    expect(clamped < farTo).toBe(true);
  });
});

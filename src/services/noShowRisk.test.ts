import { describe, expect, it } from 'vitest';
import {
  computeNoShowRisk,
  formatNoShowRiskSummary,
  normalizeNoShowRisk,
  shouldShowNoShowRiskBadge,
} from './noShowRisk.js';

describe('computeNoShowRisk', () => {
  it('returns LOW when fewer than 3 bookings (insufficient data)', () => {
    expect(computeNoShowRisk(2, 2)).toBe('LOW');
    expect(computeNoShowRisk(0, 0)).toBe('LOW');
    expect(computeNoShowRisk(1, 2)).toBe('LOW');
    expect(computeNoShowRisk(5, 2)).toBe('LOW'); // high no-shows but not enough bookings
  });

  it('returns LOW below 25% no-show rate', () => {
    expect(computeNoShowRisk(0, 10)).toBe('LOW');
    expect(computeNoShowRisk(2, 10)).toBe('LOW'); // 20%
  });

  it('returns MEDIUM at 25%–49% no-show rate', () => {
    expect(computeNoShowRisk(1, 4)).toBe('MEDIUM'); // 25%
    expect(computeNoShowRisk(2, 5)).toBe('MEDIUM'); // 40%
    expect(computeNoShowRisk(4, 9)).toBe('MEDIUM'); // 44.4%
    expect(computeNoShowRisk(1, 3)).toBe('MEDIUM'); // 33.3% — first eligible booking count
  });

  it('returns HIGH at 50% or above', () => {
    expect(computeNoShowRisk(1, 2)).toBe('LOW'); // only 2 bookings — not enough data
    expect(computeNoShowRisk(2, 4)).toBe('HIGH'); // 50%
    expect(computeNoShowRisk(3, 4)).toBe('HIGH'); // 75%
    expect(computeNoShowRisk(5, 5)).toBe('HIGH'); // 100%
    expect(computeNoShowRisk(3, 3)).toBe('HIGH'); // 100% at minimum sample
  });

  it('handles negative inputs and count drift without throwing', () => {
    expect(computeNoShowRisk(-1, 5)).toBe('LOW');
    expect(computeNoShowRisk(5, -2)).toBe('LOW');
    // noShowCount > bookingCount (legacy drift) — clamped to 100% → HIGH
    expect(computeNoShowRisk(7, 4)).toBe('HIGH');
  });

  it('exact boundary: 3 bookings with 0 no-shows stays LOW', () => {
    expect(computeNoShowRisk(0, 3)).toBe('LOW');
  });
});

describe('normalizeNoShowRisk', () => {
  it('passes through valid levels and defaults garbage to LOW', () => {
    expect(normalizeNoShowRisk('HIGH')).toBe('HIGH');
    expect(normalizeNoShowRisk('MEDIUM')).toBe('MEDIUM');
    expect(normalizeNoShowRisk('LOW')).toBe('LOW');
    expect(normalizeNoShowRisk('UNKNOWN')).toBe('LOW');
    expect(normalizeNoShowRisk(null)).toBe('LOW');
  });
});

describe('formatNoShowRiskSummary', () => {
  it('pluralises correctly', () => {
    expect(formatNoShowRiskSummary(1, 1)).toBe('Based on 1 no-show from 1 booking');
    expect(formatNoShowRiskSummary(2, 5)).toBe('Based on 2 no-shows from 5 bookings');
    expect(formatNoShowRiskSummary(0, 0)).toBe('Based on 0 no-shows from 0 bookings');
  });
});

describe('shouldShowNoShowRiskBadge', () => {
  it('shows only for MEDIUM/HIGH on actionable upcoming statuses', () => {
    expect(shouldShowNoShowRiskBadge('HIGH', 'CONFIRMED')).toBe(true);
    expect(shouldShowNoShowRiskBadge('MEDIUM', 'HELD')).toBe(true);
    expect(shouldShowNoShowRiskBadge('HIGH', 'CANCELLED')).toBe(false);
    expect(shouldShowNoShowRiskBadge('HIGH', 'NO_SHOW')).toBe(false);
    expect(shouldShowNoShowRiskBadge('HIGH', 'COMPLETED')).toBe(false);
    expect(shouldShowNoShowRiskBadge('LOW', 'CONFIRMED')).toBe(false);
    expect(shouldShowNoShowRiskBadge('BOGUS', 'CONFIRMED')).toBe(false);
  });
});

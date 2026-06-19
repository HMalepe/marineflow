import { describe, expect, it } from 'vitest';
import { formatRevPerHour } from '@/components/ServiceRow';

describe('formatRevPerHour', () => {
  it('computes hourly rate from price and duration', () => {
    expect(formatRevPerHour(25000, 60)).toBe('R 250/hr');
    expect(formatRevPerHour(15000, 30)).toBe('R 300/hr');
  });

  it('returns dash for invalid duration', () => {
    expect(formatRevPerHour(10000, 0)).toBe('—');
  });
});

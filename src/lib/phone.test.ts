import { describe, expect, it } from 'vitest';
import { toSouthAfricanLocalCellNumber } from './phone.js';

describe('toSouthAfricanLocalCellNumber', () => {
  it('converts a 27-prefixed SA mobile number to local 0-prefixed format', () => {
    expect(toSouthAfricanLocalCellNumber('27821234567')).toBe('0821234567');
  });

  it('strips non-digit characters before converting', () => {
    expect(toSouthAfricanLocalCellNumber('+27 82 123 4567')).toBe('0821234567');
  });

  it('returns null for non-SA numbers', () => {
    expect(toSouthAfricanLocalCellNumber('14155552671')).toBeNull();
  });

  it('returns null for already-local or malformed input', () => {
    expect(toSouthAfricanLocalCellNumber('0821234567')).toBeNull();
    expect(toSouthAfricanLocalCellNumber('erased_abc123')).toBeNull();
  });
});

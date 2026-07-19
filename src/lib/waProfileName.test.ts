import { describe, expect, it } from 'vitest';
import { firstNameFromWaProfile } from './waProfileName.js';

describe('firstNameFromWaProfile', () => {
  it('takes the first word of a full WhatsApp name', () => {
    expect(firstNameFromWaProfile('Thabo Molefe')).toBe('Thabo');
    expect(firstNameFromWaProfile('Jane')).toBe('Jane');
  });

  it('strips emoji and punctuation noise', () => {
    expect(firstNameFromWaProfile('✨ Lerato ✨')).toBe('Lerato');
    expect(firstNameFromWaProfile("O'Connor")).toBe("O'Connor");
  });

  it('returns null for empty or unusable values', () => {
    expect(firstNameFromWaProfile(null)).toBeNull();
    expect(firstNameFromWaProfile('')).toBeNull();
    expect(firstNameFromWaProfile('   ')).toBeNull();
    expect(firstNameFromWaProfile('12345')).toBeNull();
  });
});
